import assert from 'node:assert/strict';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
// Use URL references for Windows paths and source data.
const {fileURLToPath}=await import('node:url');const siteRoot=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(await readFile(new URL('../service-enrichment.json',import.meta.url),'utf8'));
async function routes(dir=siteRoot){const all=[];for(const n of await readdir(dir,{withFileTypes:true})){if(n.name.startsWith('.')||['preview','node_modules'].includes(n.name))continue;const p=resolve(dir,n.name);if(n.isDirectory())all.push(...await routes(p));else if(n.name==='index.html')all.push(relative(siteRoot,p).replaceAll('\\','/').replace(/index.html$/,''));}return all;}
const base=process.env.SITE_TEST_URL||'http://127.0.0.1:4187/',out=process.env.SITE_SCREENSHOTS||'../.work/seo-mobile-20261010/browser/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const goto=path=>page.goto(new URL(path,base).href,{waitUntil:'load'});
try{
 await goto('kopitsentr/pechat-dokumentov/');await page.locator('[data-cookie-choice="necessary"]').click();
 assert.equal(await page.locator('.geo-answer-card').count(),5);assert.equal(await page.locator('.req-inline').count(),1);
 await page.locator('[data-header-search]').fill('прямоугольные');assert.equal(await page.locator('#header-search-results a').count(),2);
 await page.locator('[data-header-search]').press('ArrowUp');assert.equal(await page.locator('#header-search-results a').last().getAttribute('aria-selected'),'true');
 await page.locator('[data-header-search]').press('ArrowDown');await page.locator('[data-header-search]').press('Enter');await page.waitForURL('**/nakleyki-i-stikery/pryamougolnye-stikery/');
 assert.equal(await page.locator('[data-menu="Широкий формат"] .icon').isVisible(),true);
 await page.locator('[data-menu="Широкий формат"]').hover();assert.equal(await page.locator('.mega-links a').count(),9);await page.locator('[data-menu="Широкий формат"]').press('Escape');
 await page.locator('[data-menu="Широкий формат"]').press('ArrowDown');await page.setViewportSize({width:1024,height:1000});await page.waitForFunction(()=>document.querySelector('#mega-menu').hidden);await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>scrollTo(0,1800));await page.waitForFunction(()=>!document.querySelector('.back-to-top').hidden);await page.locator('.back-to-top').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>scrollY===0);assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
 await page.evaluate(()=>{window.__printCalled=0;window.print=()=>window.__printCalled++;});await page.locator('[data-print-requirements]').click();assert.equal(await page.evaluate(()=>window.__printCalled),1);
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.sp-hero-section').isVisible(),false);assert.equal(await page.locator('.req-inline').isVisible(),true);assert.equal(await page.locator('.geo-answer').isVisible(),false);assert.equal(await page.locator('.chrome-header').isVisible(),false);
 await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.sp-hero-section').isVisible(),true);
 await goto('kopitsentr/pechat-dokumentov/');await page.evaluate(()=>{window.print=()=>{};});await page.locator('[data-print-requirements]').click();await page.emulateMedia({media:'print'});assert.equal(await page.locator('.req-inline').isVisible(),true);assert.equal(await page.locator('.cc-hero').isVisible(),false);await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'desktop-header.png'});await page.locator('.req-inline').scrollIntoViewIfNeeded();await page.screenshot({path:out+'desktop-requirements.png'});await page.locator('.geo-answer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'desktop-geo.png'});await page.locator('.intent-block').scrollIntoViewIfNeeded();await page.screenshot({path:out+'desktop-intent.png'});
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:900});await goto('');await page.locator('#mobile-menu-button').click();assert.equal(await page.locator('#mobile-menu-button').getAttribute('aria-expanded'),'true');
  await page.locator('[data-menu="Наклейки и стикеры"]').press('ArrowDown');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-menu-button');
  await page.locator('#mobile-menu-button').click();await page.locator('[data-menu="Наклейки и стикеры"]').click();assert.equal(await page.locator('.mega-links a').count(),11);await page.locator('.mega-links a[href*="pryamougolnye-stikery/"]').click();await page.waitForURL('**/nakleyki-i-stikery/pryamougolnye-stikery/');assert.equal(await page.locator('#mobile-menu-button').getAttribute('aria-expanded'),'false');
  if(width<=700){await page.locator('[data-header-search-toggle]').click();await page.locator('[data-header-search]').fill('инженерная');assert.ok(await page.locator('#header-search-results a').count());await page.locator('[data-header-search]').press('Escape');assert.equal(await page.locator('[data-header-search-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-header-search-toggle')),true);}
  await page.evaluate(()=>scrollTo(0,1500));await page.waitForFunction(()=>!document.querySelector('.back-to-top').hidden);await page.locator('.back-to-top').click();await page.waitForFunction(()=>scrollY===0);
  if(width===390){await page.screenshot({path:out+'mobile-header.png'});await page.locator('.req-inline').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.sp-mobile-total').classList.contains('is-visible'));await page.waitForFunction(()=>document.querySelector('.back-to-top').getBoundingClientRect().bottom<=document.querySelector('.sp-mobile-total').getBoundingClientRect().top-8);await page.screenshot({path:out+'mobile-requirements.png'});}
 }
 console.log('Header/search/mobile links, keyboard controls, top button and print isolation passed.');
 const plainContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000}}),plainPage=await plainContext.newPage();
 await plainPage.goto(new URL('kopitsentr/pechat-dokumentov/',base).href);assert.equal(await plainPage.locator('.geo-answer-card').count(),5);assert.equal(await plainPage.locator('.req-inline').isVisible(),true);
 await plainPage.locator('.nav-category-link[href*="nakleyki-i-stikery/"]').click();assert.equal(await plainPage.locator('main .featured-card').count(),11);await plainContext.close();
 await page.setViewportSize({width:1440,height:1000});const prefix='http://127.0.0.1:4190/text-printing-house/';
 await context.route(prefix+'**',async route=>{const response=await route.fetch({url:new URL(route.request().url().slice(prefix.length),base).href});await route.fulfill({response});});
 await page.goto(prefix+'kopitsentr/pechat-dokumentov/');await page.locator('[data-header-search]').fill('стикерпаки');assert.ok((await page.locator('#header-search-results a').first().getAttribute('href')).startsWith(prefix));await page.locator('#header-search-results a').first().click();await page.waitForURL(prefix+'nakleyki-i-stikery/stikerpaki/');
 assert.ok((await page.locator('.nav-category-link').first().getAttribute('href')).includes('../../company/'));console.log('Static content without JavaScript and header/search under a deployment prefix passed.');
 const failures=[],all=process.env.SITE_TEST_INTERACTIONS_ONLY?[]:await routes();
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900});
  for(let i=0;i<all.length;i++){
   const path=all[i];await goto(path);await page.evaluate(()=>document.fonts.ready);
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('main *,header *')].map(n=>{const r=n.getBoundingClientRect();return {tag:n.tagName,class:n.className,right:r.right,left:r.left,width:r.width};}).filter(n=>n.width&&n.right>innerWidth+2).slice(0,8)}));
   if(overflow.scroll>width+2){failures.push({path,width,...overflow});console.log('OVERFLOW',path,width,overflow.scroll,JSON.stringify(overflow.nodes));}
   if((i+1)%50===0)console.log(`${width}px: ${i+1}/${all.length} pages checked`);
  }
 }
 await import('node:fs/promises').then(fs=>fs.writeFile(out+'overflow-report.json',JSON.stringify(failures,null,2)));
 assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
 if(all.length)console.log(`All ${all.length*3} mobile page cases passed; no browser errors or missing resources.`);
}finally{await browser.close();}
