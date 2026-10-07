import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import vm from 'node:vm';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WIDE_TEST_URL||'http://127.0.0.1:4187/';
const shots=process.env.WIDE_SCREENSHOTS||'../.work/wide-format-20261007/screenshots/';await mkdir(shots,{recursive:true});
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(await readFile(new URL('../wide-format-services.js',import.meta.url),'utf8'),ctx);const services=ctx.window.TEXT_WIDE_SERVICES;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const goto=path=>page.goto(new URL(path,base).href,{waitUntil:'networkidle'});
const number=s=>Number(s.replace(/[^\d,.-]/g,'').replace(',','.'));
const header=()=>page.locator('.topbar,#header').evaluateAll(nodes=>nodes.map(n=>({html:n.innerHTML.replace(/http:\/\/127\.0\.0\.1:\d+\//g,'').replace(/(?:\.\.\/)*assets\//g,'assets/').replace(/\.\.\/|#main/g,'').replace(/class="cart-count(?: has-items)?" id="cart-count">\d+/g,'class="cart-count" id="cart-count">0'),height:n.getBoundingClientRect().height})));
const option=(group,value)=>page.locator(`[data-sp-group="${group}"][data-sp-value="${value}"]`);
async function custom(width,height,quantity){await option('size','custom').click();await page.locator('#sp-width').fill(String(width));await page.locator('#sp-height').fill(String(height));await option('quantity','custom').click();await page.locator('#sp-quantity').fill(String(quantity));}
try{
 await goto('');const homeHeader=await header();
 const homeButton=await page.locator('.hero-actions .button-primary').evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundImage,radius:s.borderRadius,font:s.fontSize,height:s.minHeight};});
 await page.locator('[data-menu="Широкий формат"]').hover();
 assert.equal(await page.locator('.mega-links a[href*="shirokiy-format/"]').count(),9);
 for(const s of Object.values(services))assert.equal(await page.locator('.mega-links a[href$="'+s.path+'"]').count(),1);
 await page.locator('.mega-title a').click();assert.equal(new URL(page.url()).pathname,'/shirokiy-format/');assert.equal(await page.locator('.wide-category-grid>a').count(),9);
 for(const s of Object.values(services)){
  await goto(s.path);assert.deepEqual(await header(),homeHeader,'Shared header '+s.id);
  const button=await page.locator('.sp-hero-actions .button-primary').evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundImage,radius:s.borderRadius,font:s.fontSize,height:s.minHeight};});assert.deepEqual(button,homeButton,'Shared button '+s.id);
  assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('.wide-checklist>li').count(),6);
  assert.equal(number(await page.locator('#sp-total').textContent()),await page.evaluate(id=>TEXT_QUOTE_WIDE_SERVICE(id,TEXT_WIDE_SERVICES[id].defaults).total,s.id));
  assert.equal(await page.locator('.faq-list>details').count(),s.model==='canvas'?6:5);
  await page.locator('.faq-list summary').first().click();await page.waitForTimeout(320);assert.equal(await page.locator('.faq-list details[open]').count(),1);
  await page.locator('.faq-list summary').first().click();await page.waitForTimeout(320);assert.equal(await page.locator('.faq-list details[open]').count(),0);
  const schema=await page.locator('script[type="application/ld+json"]').allTextContents();assert.ok(schema.some(t=>JSON.parse(t)['@graph']?.some(g=>g['@type']==='FAQPage'&&g.mainEntity.length===(s.model==='canvas'?6:5))));
  for(const group of ['print','material','thickness','complexity']){
   const enabled=page.locator(`[data-sp-group="${group}"]:not(:disabled)`);if(await enabled.count())await enabled.last().click();
  }
  if(s.model==='film'){
   await option('material','clearMatte').click();await option('print','interior').click();assert.equal(await option('material','clearMatte').isDisabled(),true);assert.equal(await option('material','matte').getAttribute('aria-pressed'),'true');await option('print','uv').click();await option('material','clearGloss').click();
  }
  await custom(555,401,17);assert.equal(await page.locator('#sp-add').isDisabled(),false);
  await page.locator('#sp-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('17 шт -'));assert.ok(copied.includes('width=555&height=401&quantity=17'));
  const quote=await page.locator('#sp-total').textContent();await page.goto(copied.split('\n').at(-1),{waitUntil:'networkidle'});assert.equal(await page.locator('#sp-total').textContent(),quote);
  assert.equal(await page.locator('#sp-width').inputValue(),'555');assert.equal(await page.locator('#sp-height').inputValue(),'401');
  if(s.id==='5.1'){
   await page.locator('#sp-file').setInputFiles({name:'Баннер-макет.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest')});
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#sp-download').click()]);const text=await readFile(await download.path(),'utf8');assert.ok(text.includes('555 × 401 мм'));assert.ok(text.includes('С проклейкой и люверсами'));assert.ok(text.includes('Баннер-макет.pdf'));
  }
  await page.locator('#sp-comment').fill('Проверка '+s.id);await page.locator('#sp-add').click();await page.locator('.cart-edit-link').last().waitFor();
  const edit=await page.locator('.cart-edit-link').last().getAttribute('href');assert.ok(edit.includes(s.path));await page.goto(edit,{waitUntil:'networkidle'});assert.equal(await page.locator('#sp-total').textContent(),quote);assert.equal(await page.locator('#sp-comment').inputValue(),'Проверка '+s.id);
  if(s.id==='5.1')await page.waitForFunction(()=>document.querySelector('#sp-file-label').textContent==='Баннер-макет.pdf');
  const count=await page.evaluate(()=>TEXT_APP.getCart().length);await page.locator('#sp-add').click();await page.locator('.cart-edit-link').last().waitFor();assert.equal(await page.evaluate(()=>TEXT_APP.getCart().length),count,'Editing replaces the existing row');await page.locator('#dialog-close').click();
  await option('quantity','custom').click();await page.locator('#sp-quantity').fill('1.5');assert.equal(await page.locator('#sp-add').isDisabled(),true);await page.locator('#sp-quantity').fill('17');
  if(s.kind==='mount'){await page.locator('#sp-width').fill('1451');assert.equal(await page.locator('#sp-add').isDisabled(),true);await page.locator('#sp-width').fill('555');await page.locator('#sp-quantity').fill('10000');assert.equal(await page.locator('#sp-add').isDisabled(),true);assert.equal(await page.locator('#sp-manual').isVisible(),true);await page.locator('#sp-quantity').fill('17');}
  if(s.kind==='cut'){await page.locator('#sp-width').fill('601');await page.locator('#sp-height').fill('601');assert.equal(await page.locator('#sp-add').isDisabled(),true);await page.locator('#sp-width').fill('2000');await page.locator('#sp-height').fill('600');assert.equal(await page.locator('#sp-add').isDisabled(),false);}
  await page.locator('.sp-hero-section').screenshot({path:shots+s.id+'-hero.png'});await page.locator('#calculator').screenshot({path:shots+s.id+'-calculator.png'});
  for(const selector of ['.sp-hero-actions .button-primary','#sp-add']){await page.locator(selector).scrollIntoViewIfNeeded();const before=await page.locator(selector).boundingBox();await page.locator(selector).hover();await page.waitForTimeout(220);assert.deepEqual(await page.locator(selector).boundingBox(),before,'Stable button '+selector);}
  console.log('Desktop controls, sharing, files/cart editing and shared styles passed:',s.id);
 }
 await goto('');await page.evaluate(()=>localStorage.removeItem('text-print-cart-v1'));
 for(const id of ['5.1','5.2','5.3','5.6']){
  await goto(services[id].path);await custom(id==='5.6'?200:100,id==='5.6'?200:100,1);await page.locator('#sp-add').click();await page.locator('#dialog[open]').waitFor();
 }
 await goto('');await page.locator('[data-action="cart"]').first().click();assert.equal(number(await page.locator('.cart-summary strong').textContent()),1800);
 assert.ok((await page.locator('.cart-minimum-note').textContent()).includes('постеров и плакатов'));assert.ok(!(await page.locator('.cart-minimum-note').textContent()).includes('undefined'));
 for(const width of [320,390,768])for(const path of ['shirokiy-format/',...Object.values(services).map(s=>s.path)]){
  await page.setViewportSize({width,height:950});await goto(path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow '+path+' @'+width);
  await page.evaluate(()=>document.querySelectorAll('img').forEach(img=>img.loading='eager'));await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  if(width===390&&['shirokiy-format/','shirokiy-format/samokleyashchayasya-plenka/','shirokiy-format/nakatka-na-pvh/'].includes(path))await page.screenshot({path:shots+path.split('/').filter(Boolean).at(-1)+'-390.png',fullPage:true});
 }
 console.log('30 responsive cases passed.');
 await page.setViewportSize({width:1440,height:1000});
 const prefix='http://127.0.0.1:4188/text-printing-house/';
 await context.route(prefix+'**',async route=>{const url=route.request().url(),response=await route.fetch({url:new URL(url.slice(prefix.length),base).href});await route.fulfill({response});});
 for(const s of Object.values(services)){
  await page.goto(prefix+s.path,{waitUntil:'networkidle'});assert.ok((await page.locator('#sp-total').textContent()).includes('₽'));await page.locator('[data-menu="Широкий формат"]').hover();assert.ok((await page.locator('.mega-links a').first().getAttribute('href')).startsWith(prefix));
 }
 await page.locator('#sp-copy').click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes(prefix));
 assert.deepEqual(errors,[]);console.log('Nine deployment-prefix routes and copy links passed; no browser errors or missing resources.');
}finally{await browser.close();}
