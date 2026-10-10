import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MERGE_TEST_URL||'http://127.0.0.1:4187/';
const out=process.env.MERGE_SCREENSHOTS||'../.work/merge-friend-20261010/browser/';await mkdir(out,{recursive:true});
const services=JSON.parse(await readFile(new URL('../uv-content.json',import.meta.url),'utf8')).services;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const goto=p=>page.goto(new URL(p,base).href,{waitUntil:'networkidle'});
const money=text=>Number(text.replace(/[^\d,.-]/g,'').replace(',','.'));
try{
 await goto('');await page.locator('[data-cookie-choice="necessary"]').click();
 await goto('shirokiy-format/nakatka-na-pvh/');await page.locator('[data-sp-group="quantity"][data-sp-value="custom"]').click();await page.locator('#sp-quantity').fill('7');
 const wideTotal=money(await page.locator('#sp-total').textContent());await page.locator('#sp-add').click();
 assert.equal((await page.evaluate(()=>TEXT_APP.getCart()))[0].configuration.quantity,7);
 for(const s of services){
  await goto(s.path);assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('[data-cc-add]').isDisabled(),false);
  assert.equal(money(await page.locator('[data-cc-total]').textContent()),await page.evaluate(id=>TEXT_UV_PRICING.quote(id).price,s.id));
  await page.locator('[data-cc-quantity="custom"]').click();const q=await page.evaluate(id=>TEXT_UV_PRICING.quantityCell(id),s.id);
  await page.locator('[data-cc-cell="'+q+'"]').fill('7');await page.locator('[data-cc-comment]').fill('Совместный заказ <логотип>');
  await page.locator('[data-cc-file]').setInputFiles({name:'maket-'+s.id+'.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF test')});
  await page.locator('[data-cc-copy]').click();const copy=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copy.includes('Совместный заказ <логотип>'));
  const link=copy.split('\n').find(v=>v.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length);assert.ok(link.includes('calc='));
  const download=page.waitForEvent('download');await page.locator('[data-cc-download]').click();assert.ok((await download).suggestedFilename().endsWith('.txt'));
  const total=money(await page.locator('[data-cc-total]').textContent());await page.locator('[data-cc-add]').click();
  await page.waitForFunction(id=>TEXT_APP.getCart().some(row=>row.id===id),s.id);assert.equal(await page.locator('#dialog').evaluate(n=>n.open),false);
  await page.locator('.cart-button').click();const rows=await page.evaluate(()=>TEXT_APP.getCart()),row=rows.at(-1);assert.equal(row.id,s.id);assert.equal(Number(row.configuration[q]),7);assert.equal(row.price,total);
  const edit=await page.locator('.cart-edit-link').last().getAttribute('href');await goto(edit);assert.equal(await page.locator('[data-cc-comment]').inputValue(),'Совместный заказ <логотип>');
  await page.waitForFunction(()=>!document.querySelector('[data-cc-add]').disabled);assert.equal(await page.locator('[data-cc-file-label]').textContent(),'maket-'+s.id+'.pdf');
  await page.locator('[data-cc-cell="'+q+'"]').fill('8');await page.locator('[data-cc-add]').click();assert.equal((await page.evaluate(()=>TEXT_APP.getCart())).length,rows.length);
  await goto(link);assert.equal(await page.locator('[data-cc-cell="'+q+'"]').inputValue(),'7');
  if(s.id==='6.1'){await page.screenshot({path:out+'uv-hero.png'});await page.locator('#calculator').scrollIntoViewIfNeeded();await page.screenshot({path:out+'uv-calculator.png'});}
  console.log('Friend UV flow passed:',s.id);
 }
 await goto('');await page.locator('[data-menu="Широкий формат"]').hover();assert.equal(await page.locator('.mega-links a[href*="shirokiy-format/"]').count(),9);
 await page.locator('[data-menu="UV-печать и резка"]').hover();assert.equal(await page.locator('.mega-links a[href*="uv-pechat-i-rezka/"]').count(),9);
 await page.locator('.cart-button').click();assert.ok(!(await page.locator('.cart-panel').textContent()).includes('undefined'));
 const combined=await page.evaluate(()=>{const rows=TEXT_APP.getCart();return {rows,totals:TEXT_STICKER_CART_BREAKDOWN(rows),excel:TEXT_CART_XLSX.model(rows,TEXT_CATALOG,TEXT_STICKER_CART_BREAKDOWN(rows))};});
 assert.equal(combined.excel.cart[0].quantity,7);assert.equal(combined.totals.total,combined.excel.lower);
 assert.ok(combined.totals.total>=wideTotal);assert.equal(money(await page.locator('.cart-summary strong').textContent()),combined.totals.total);
 for(const [selector,name] of [['#download-cart-pdf','mixed-order.pdf'],['#download-cart-xlsx','mixed-order.xlsx']]){const event=page.waitForEvent('download');await page.locator(selector).click();await (await event).saveAs(out+name);}
 await goto('uv-pechat-i-rezka/gravirovka-co2/');await page.locator('[data-cc-cell="B8"]').fill('101');assert.equal(await page.locator('[data-cc-add]').isDisabled(),true);
 await page.locator('[data-cc-choice="B5"][data-cc-value="КОНТУРНАЯ"]').click();assert.equal(await page.locator('[data-cc-cell="B8"]').count(),0);assert.equal(await page.locator('[data-cc-add]').isDisabled(),false);
 await goto('uv-pechat-i-rezka/pryamaya-uv-pechat/');await page.locator('[data-cc-choice="B4"][data-cc-value="ПЭТ"]').click();assert.deepEqual(await page.locator('[data-cc-choice="B5"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.ccValue)),['0.5','1','1.5']);
 await goto('uv-pechat-i-rezka/pechat-na-metalle/');assert.deepEqual(await page.locator('[data-cc-choice="B4"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.ccValue)),['Алюминий','Нержавейка AISI']);
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:950});
  for(const path of ['uv-pechat-i-rezka/',...services.map(s=>s.path)]){await goto(path);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' @'+width);if(width===390&&path.includes('pryamaya-uv-pechat/'))await page.screenshot({path:out+'uv-mobile.png'});}
 }
 await page.setViewportSize({width:1440,height:1000});const prefix='http://127.0.0.1:4190/text-printing-house/';
 await context.route(prefix+'**',async route=>{const response=await route.fetch({url:new URL(route.request().url().slice(prefix.length),base).href});await route.fulfill({response});});
 for(const s of services){await page.goto(prefix+s.path,{waitUntil:'networkidle'});assert.equal(await page.locator('[data-cc-add]').isDisabled(),false);await page.locator('[data-menu="Широкий формат"]').hover();assert.ok((await page.locator('.mega-links a').first().getAttribute('href')).startsWith(prefix));}
 assert.deepEqual(errors,[]);console.log('Merged UV: nine desktop flows, 30 responsive pages, nine prefix routes, mixed PDF/Excel; no browser/resource errors.');
}finally{await browser.close();}
