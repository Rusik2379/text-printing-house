/* Browser regression checks for compact navigation and touch controls. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_TEST_URL||'http://127.0.0.1:4187/';
const output=process.env.SITE_SCREENSHOTS;
if(output)await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const routes=['','company/about/','kopitsentr/pechat-dokumentov/','proektnaya-dokumentatsiya/inzhenernaya-pechat/','listovaya-poligrafiya/vizitki/','nakleyki-i-stikery/stikerpaki/','shirokiy-format/bannery/','uv-pechat-i-rezka/pryamaya-uv-pechat/'];
const widths=[320,360,390,414,580,581,680,700,701,768,1024,1100,1101,1280,1281,1366,1440,1920];
try{
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  for(const path of routes){
   await page.goto(new URL(path,base).href);
   if(width===320&&path===''&&await page.locator('[data-cookie-choice="necessary"]').isVisible())await page.locator('[data-cookie-choice="necessary"]').click();
   if(output&&path==='kopitsentr/pechat-dokumentov/'&&[320,390,768,1440].includes(width))await page.screenshot({path:output+`header-${width}.png`});
   const state=await page.evaluate(()=>{
    const header=document.querySelector('#header'),top=document.querySelector('.topbar'),visible=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0;
    const nodes=[...document.querySelectorAll('.topbar *,#header *')].filter(visible);
    const count=document.querySelector('.chrome-header .cart-count'),badge=count.getBoundingClientRect();
    return {count:{text:count.textContent,width:badge.width,height:badge.height},badges:visible(document.querySelector('.chrome-map-links')),topHeight:top.getBoundingClientRect().height,totalHeight:top.getBoundingClientRect().height+header.getBoundingClientRect().height,overflow:nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2;}).map(n=>n.className),logos:[...document.querySelectorAll('.social-mini')].map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,radius:parseFloat(getComputedStyle(n).borderRadius),source:n.querySelector('img')?.getAttribute('src')})),controls:[...document.querySelectorAll('[data-header-search-toggle],.chrome-header .cart-button,#mobile-menu-button')].filter(visible).map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,center:r.top+r.height/2};})};
   });
   assert.equal(state.badges,width>1280,`${path} at ${width}: ratings must be hidden on compact screens`);
   assert.ok(state.topHeight<=(width<=700?44:width<=1280?48:58),`${path} at ${width}: contact strip must stay on one compact row`);
   if(width<=700)assert.ok(state.totalHeight<=116,`${path} at ${width}: collapsed mobile header is too tall`);
   assert.deepEqual(state.overflow,[],`${path} at ${width}: header overflow`);
   assert.equal(state.logos.length,2);
   for(const logo of state.logos){assert.equal(logo.width,logo.height,'Messenger buttons must be round');assert.ok(logo.radius>=logo.width/2);assert.match(logo.source||'',/assets\/(?:max|telegram)\.svg$/,'Use the approved messenger logos');}
   if(width<=700){assert.equal(state.controls.length,3);if(state.count.text.length===1)assert.equal(state.count.width,state.count.height,'Single-digit cart badge must remain round');for(const c of state.controls){assert.ok(c.width>=40&&c.height>=40,'Touch controls must have enough space');assert.ok(Math.abs(c.center-state.controls[0].center)<1,'Touch controls must align');}}
  }
  await page.goto(new URL('kopitsentr/pechat-dokumentov/',base).href);
  if(width<=700){
   await page.locator('[data-header-search-toggle]').click();
   await page.locator('[data-header-search]').fill('стикерпаки');
   assert.ok(await page.locator('#header-search-results a').count());
   if(output&&width===390)await page.screenshot({path:output+'mobile-search.png'});
   await page.locator('[data-header-search-close]').click();
   assert.equal(await page.locator('[data-header-search-toggle]').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('[data-header-search]').isVisible(),false);
  }
  if(width<=1100){await page.locator('#mobile-menu-button').click();await page.locator('[data-menu="Наклейки и стикеры"]').click();assert.equal(await page.locator('#mega-menu a').count(),11);await page.keyboard.press('Escape');}
  else{await page.locator('[data-menu="Широкий формат"]').hover();assert.equal(await page.locator('#mega-menu a').count(),9);await page.keyboard.press('Escape');}
  console.log(`${width}px: eight templates, messenger logos, compact rows and navigation passed`);
 }
 assert.deepEqual(errors,[]);console.log(`All ${widths.length*routes.length} header layouts passed without browser errors or missing assets.`);
}finally{await browser.close();}
