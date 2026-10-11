import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
  for(const width of [320,390,1440]){
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('text-print-consent-v1',JSON.stringify({version:1,analytics:false,updatedAt:'2026-10-11'})));
    await page.goto(process.env.CART_TEST_URL||'http://127.0.0.1:4187/');
    await page.waitForFunction(()=>window.TEXT_APP&&window.TEXT_FILES);
    await page.evaluate(()=>TEXT_APP.openCart());
    const clear=page.getByRole('button',{name:'Очистить корзину',exact:true});
    assert.equal(await clear.count(),0,'An empty basket has no clearing action');
    await page.evaluate(async()=>{
      TEXT_APP.upsertCalculatedItem({key:'clear-doc',id:'1.1',price:250,description:'A4 · Ч/Б · 25 страниц',configuration:{B7:25},fileName:'макет.pdf'});
      TEXT_APP.upsertCalculatedItem({key:'clear-manual',id:'2.1',price:null,description:'Параметры уточнить'});
      await TEXT_FILES.save('clear-doc',new File(['%PDF-1.4'], 'макет.pdf',{type:'application/pdf'}));
      await TEXT_FILES.save('unrelated-draft',new File(['%PDF-1.4'], 'черновик.pdf',{type:'application/pdf'}));
      TEXT_APP.openCart();
    });
    assert.equal(await page.locator('.cart-row').count(),2);
    assert.equal(await clear.count(),1,'A populated basket offers clearing all positions');
    const consent=await page.evaluate(()=>localStorage.getItem('text-print-consent-v1'));
    const rect=await clear.boundingBox();
    assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.height>=44,'Clear action fits the desktop/mobile dialog');
    if(process.env.CART_SCREENSHOTS){
      fs.mkdirSync(process.env.CART_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:`${process.env.CART_SCREENSHOTS}/cart-${width}.png`});
    }
    await clear.click();
    assert.equal(await page.evaluate(()=>TEXT_APP.getCart().length),2,'Opening confirmation preserves all positions');
    assert.equal(await page.evaluate(async()=>!!await TEXT_FILES.get('clear-doc')),true,'Opening confirmation preserves attached files');
    await page.getByRole('button',{name:'Отмена',exact:true}).click();
    assert.equal(await page.locator('.cart-row').count(),2,'Cancel returns to the unchanged basket');
    assert.equal(await page.locator('#cart-count').textContent(),'2');
    assert.equal(await clear.evaluate(el=>el===document.activeElement),true,'Cancel restores focus to the clear action');
    await clear.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>TEXT_APP.getCart().length),2,'Escape dismisses confirmation without clearing');
    await page.evaluate(()=>TEXT_APP.openCart());
    await clear.click();
    if(process.env.CART_SCREENSHOTS)await page.screenshot({path:`${process.env.CART_SCREENSHOTS}/confirmation-${width}.png`});
    await page.getByRole('button',{name:'Очистить',exact:true}).click();
    assert.equal(await page.evaluate(()=>TEXT_APP.getCart().length),0,'Clearing removes priced and manual positions');
    assert.equal(await page.locator('.cart-row,.cart-summary').count(),0,'Rows and old total disappear');
    assert.equal(await page.locator('.cart-empty').count(),1,'The dialog shows its empty state');
    assert.equal(await page.locator('#cart-count').textContent(),'0');
    assert.equal(await page.locator('#mobile-cart-count').textContent(),'0');
    assert.equal(await clear.count(),0);
    await page.waitForFunction(async()=>!await TEXT_FILES.get('clear-doc'));
    assert.equal(await page.evaluate(async()=>!!await TEXT_FILES.get('unrelated-draft')),true,'Other draft files remain available');
    assert.equal(await page.evaluate(()=>localStorage.getItem('text-print-consent-v1')),consent,'Clearing the basket preserves site preferences');
    await page.reload();await page.waitForFunction(()=>window.TEXT_APP);
    await page.evaluate(()=>TEXT_APP.openCart());
    assert.equal(await page.locator('.cart-empty').count(),1,'The cleared basket stays empty after reload');
    await page.evaluate(()=>{
      TEXT_APP.upsertCalculatedItem({key:'new-order',id:'1.1',price:10,description:'A4 · 1 страница'});
      TEXT_APP.openCart();
    });
    assert.equal(await page.locator('.cart-row').count(),1,'Adding a new order still works after clearing');
    assert.equal(await clear.count(),1);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('Cart clearing: confirmation, cancel, Escape, desktop/mobile, storage, file cleanup and new orders passed.');
}finally{await browser.close();}
