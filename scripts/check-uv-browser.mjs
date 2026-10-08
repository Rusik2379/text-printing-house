import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import vm from 'node:vm';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.env.UV_TEST_URL||'http://127.0.0.1:4187/';
const shots=process.env.UV_SCREENSHOTS||'../.work/uv-20261008/screenshots/';await mkdir(shots,{recursive:true});
const c={window:{}};vm.createContext(c);vm.runInContext(await readFile(new URL('../uv-services.js',import.meta.url),'utf8'),c);const services=c.window.TEXT_UV_SERVICES;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const goto=p=>page.goto(new URL(p,base).href,{waitUntil:'networkidle'});
const number=t=>Number(t.replace(/[^\d,.-]/g,'').replace(',','.'));
const styles=selector=>page.locator(selector).evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundImage,radius:s.borderRadius,font:s.fontSize,height:s.minHeight};});
try{
 await goto('');await page.locator('[data-cookie-choice="necessary"]').click();const shared=await styles('.hero-actions .button-primary');
 await page.locator('[data-menu="UV-печать и резка"]').hover();assert.equal(await page.locator('.mega-links a[href*="uv-pechat-i-rezka/"]').count(),9);await page.locator('.mega-title a').click();assert.equal(await page.locator('.wide-category-grid>a').count(),9);
 await goto('uv-pechat-i-rezka/gravirovka-co2/');
 for(const [cell,value] of Object.entries({B6:1,B7:1,B8:1}))await page.locator('#uv-'+cell).fill(String(value));
 await page.locator('#uv-custom-count').click();await page.locator('#sp-quantity').fill('1');
 assert.equal(number(await page.locator('#sp-total').textContent()),800);
 await page.locator('#sp-add').click();
 assert.equal(number(await page.locator('.cart-summary strong').textContent()),800,'Rounded zero subtotal retains the minimum in the cart');
 const tinyPdf=await page.evaluate(()=>{const rows=TEXT_APP.getCart();return TEXT_CART_PDF.model(rows,TEXT_CATALOG,TEXT_STICKER_CART_BREAKDOWN(rows));});
 assert.equal(tinyPdf.lower,800);assert.ok(tinyPdf.surcharges[0].name.includes('гравировка'));
 await page.locator('[data-remove]').click();assert.equal((await page.evaluate(()=>TEXT_APP.getCart())).length,0);
 for(const s of Object.values(services)){
  await goto(s.path);assert.equal(await page.locator('h1').count(),1);assert.deepEqual(await styles('.sp-hero-actions .button-primary'),shared);
  assert.equal(await page.locator('.wide-checklist>li').count(),6);
  assert.equal(number(await page.locator('#sp-total').textContent()),await page.evaluate(id=>TEXT_UV_PRICING.quote(id,TEXT_UV_PRICING.defaults(id)).total,s.id));
  await page.screenshot({path:shots+s.id+'-hero.png'});
  const copyBox=await page.locator('#sp-copy').boundingBox(),panelBox=await page.locator('.sp-options-panel').boundingBox();assert.ok(Math.abs(copyBox.x+copyBox.width-(panelBox.x+panelBox.width))<50,'Copy control at the top right');
  await page.locator('.faq-list summary').first().click();await page.waitForFunction(()=>document.querySelector('.faq-list details').dataset.faqExpanded==='true');assert.equal(await page.locator('.faq-list details[open]').count(),1);await page.locator('.faq-list summary').first().click();await page.waitForFunction(()=>!document.querySelector('.faq-list details').open);assert.equal(await page.locator('.faq-list details[open]').count(),0);
  for(const input of await page.locator('#uv-fields select').all()){
   const values=await input.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));if(values.length>1)await input.selectOption(values.at(-1));
  }
  const state=await page.evaluate(id=>{const c=TEXT_UV_PRICING.defaults(id);for(const el of document.querySelectorAll('#uv-fields [data-uv-input]'))c[el.dataset.uvInput]=el.value;for(const el of document.querySelectorAll('#uv-fields [data-uv-cell][aria-pressed="true"]'))c[el.dataset.uvCell]=el.dataset.uvValue;return c;},s.id);
  assert.ok(await page.evaluate(({id,c})=>TEXT_UV_PRICING.quote(id,c).valid,{id:s.id,c:state}));
  await page.locator('#uv-custom-count').click();await page.locator('#sp-quantity').fill('7');assert.equal(await page.locator('#uv-error').textContent(),'');
  await page.locator('#sp-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('7 шт -'));const link=copied.split('\n').at(-1);assert.ok(link.includes('#calculator'));
  const download=page.waitForEvent('download');await page.locator('#sp-download').click();assert.ok((await download).suggestedFilename().endsWith('.txt'));
  await page.locator('#sp-comment').fill('Проверка заказа <логотип>');
  await page.locator('#sp-file').setInputFiles({name:'maket.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF test')});
  await page.locator('#calculator').scrollIntoViewIfNeeded();await page.screenshot({path:shots+s.id+'-calculator.png'});
  await page.locator('#sp-add').click();assert.ok(await page.locator('.cart-row').last().textContent().then(t=>t.includes('maket.pdf')));
  const cart=await page.evaluate(()=>TEXT_APP.getCart());const row=cart.at(-1);assert.equal(row.id,s.id);assert.equal(Number(row.configuration[s.quantityCell]),7);assert.equal(row.comment,'Проверка заказа <логотип>');
  assert.ok(!await page.locator('.cart-panel').textContent().then(t=>t.includes('undefined')));
  const edit=await page.locator('.cart-edit-link').last().getAttribute('href');await goto(edit);assert.equal(await page.locator('#sp-comment').inputValue(),'Проверка заказа <логотип>');await page.waitForFunction(()=>!document.querySelector('#sp-add').disabled);assert.equal(await page.locator('#sp-file-label').textContent(),'maket.pdf');
  await page.locator('#sp-quantity').fill('8');await page.locator('#sp-add').click();assert.equal((await page.evaluate(()=>TEXT_APP.getCart())).length,cart.length);
  await goto(link);assert.equal(await page.locator('#sp-quantity').inputValue(),'7');
  await page.locator('#sp-quantity').fill('0');assert.equal(await page.locator('#sp-add').isDisabled(),true);
  await page.locator('#sp-manual').click();assert.ok(await page.locator('#request-comment').inputValue().then(v=>v.includes('Индивидуальный расчёт')));assert.ok(!await page.locator('#request-comment').inputValue().then(v=>v.includes('undefined')));
  console.log('Desktop service passed:',s.id,s.name);
 }
 await goto('uv-pechat-i-rezka/pryamaya-uv-pechat/');await page.locator('#uv-B4').selectOption('ПЭТ');assert.deepEqual(await page.locator('[data-field="B5"] [data-uv-value]').evaluateAll(n=>n.map(e=>e.dataset.uvValue)),['0.5','1','1.5']);
 await goto('uv-pechat-i-rezka/plotternaya-rezka/');for(const slug of ['samokleyashchayasya-plenka','nakleyki-na-avto','nakleyki-na-steklo'])assert.equal(await page.locator('.sp-related a[href*="'+slug+'"]').count(),1,'Related wide service '+slug);
 await goto('uv-pechat-i-rezka/pechat-na-metalle/');assert.deepEqual(await page.locator('[data-field="B4"] [data-uv-value]').evaluateAll(n=>n.map(e=>e.dataset.uvValue)),['Алюминий','Нержавейка AISI']);
 await goto('uv-pechat-i-rezka/garderobnye-nomerki/');assert.equal(await page.locator('[data-field="B12"] [data-uv-value]').getAttribute('data-uv-value'),'Без фурнитуры');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900});
  for(const path of ['uv-pechat-i-rezka/',...Object.values(services).map(s=>s.path)]){
   await goto(path);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+path);
   if(path.includes('breloki/')){await page.evaluate(()=>document.querySelectorAll('img').forEach(img=>img.loading='eager'));await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));await page.screenshot({path:shots+'mobile-'+width+'.png',fullPage:true});if(width===390){await page.screenshot({path:shots+'mobile-hero.png'});await page.locator('#calculator').scrollIntoViewIfNeeded();await page.screenshot({path:shots+'mobile-calculator.png'});}}
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 const prefix='http://127.0.0.1:4188/text-printing-house/';
 await context.route(prefix+'**',async route=>{const url=route.request().url(),response=await route.fetch({url:new URL(url.slice(prefix.length),base).href});await route.fulfill({response});});
 for(const s of Object.values(services)){await page.goto(prefix+s.path,{waitUntil:'networkidle'});assert.ok(await page.locator('#sp-total').textContent().then(t=>t.includes('₽')));await page.locator('#sp-copy').click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes(prefix));}
 assert.deepEqual(errors,[]);console.log('UV browser: nine desktop flows, 30 responsive pages, nine deployment prefix routes; no console/resource errors.');
}finally{await browser.close();}
