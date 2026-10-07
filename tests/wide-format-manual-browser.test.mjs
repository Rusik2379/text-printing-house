import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}});
try{
 await page.goto(new URL('shirokiy-format/nakatka-na-penokarton/',process.env.WIDE_TEST_URL||'http://127.0.0.1:4187/').href,{waitUntil:'networkidle'});
 await page.locator('[data-sp-group="print"][data-sp-value="uv"]').click();
 await page.locator('[data-sp-group="quantity"][data-sp-value="custom"]').click();await page.locator('#sp-quantity').fill('10000');
 await page.locator('#sp-comment').fill('Проверить крепление <img src=x onerror=alert(1)>');
 await page.locator('#sp-file').setInputFiles({name:'Панель-макет.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest')});
 assert.equal(await page.locator('#sp-add').isDisabled(),true);await page.locator('#sp-manual').click();
 const comment=await page.locator('#request-comment').inputValue();
 for(const part of ['600 × 1 200 мм','10 000 шт.','УФ-печать','Пенокартон','5 мм','Проверить крепление <img src=x onerror=alert(1)>','индивидуальный расчёт'])assert.ok(comment.includes(part),'Request retains '+part);
 assert.ok((await page.locator('#file-feedback').textContent()).includes('Панель-макет.pdf'));
 assert.equal(await page.locator('.request-form img').count(),0,'Comment remains text');
 await page.locator('[name="name"]').fill('Проверка');await page.locator('[name="phone"]').fill('+79236547896');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-request').click()]);const text=await readFile(await download.path(),'utf8');
 assert.ok(text.includes('600 × 1 200 мм'));assert.ok(text.includes('Макет: Панель-макет.pdf'));assert.ok(text.includes('Стоимость: индивидуальный расчёт'));
 assert.equal(await page.evaluate(()=>TEXT_APP.getCart().length),0,'No fabricated quote is added to cart');
 await page.locator('#dialog-close').click();await page.locator('.sp-production [data-action="request"]').click();
 assert.equal(await page.locator('#request-comment').inputValue(),'Накатка на пенокартон: ');assert.ok(!(await page.locator('#file-feedback').textContent()).includes('Панель-макет.pdf'));
 console.log('Manual quote retains dimensions, quantity, print, material, thickness, comment and artwork; generic requests remain clean.');
}finally{await browser.close();}
