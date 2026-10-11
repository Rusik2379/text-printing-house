import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const content=JSON.parse(fs.readFileSync(new URL('../project-content.json',import.meta.url),'utf8'));
let checks=0;
try{
 for(const id of ['2.1','2.5','2.6']){
  const path=content.services.find(s=>s.id===id).path;
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('text-print-consent-v1',JSON.stringify({version:1,analytics:false,updatedAt:new Date().toISOString()})));
  await page.goto(new URL(path,process.env.PROJECT_TEST_URL||'http://127.0.0.1:4187/').href);
  await page.locator('[data-project-add]').waitFor();await page.evaluate(()=>document.fonts.ready);
  const read=()=>page.evaluate(()=>{
   const wrapper=document.querySelector('.project-reference-layout').getBoundingClientRect(),visual=document.querySelector('.project-service-visual'),image=visual.querySelector('img').getBoundingClientRect(),frame=visual.querySelector('.project-visual-art');
   return {layoutTop:wrapper.top+scrollY,width:wrapper.width,visualTop:visual.getBoundingClientRect().top+scrollY,imageHeight:image.height,framePadding:frame?getComputedStyle(frame).padding:null,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  const initial=await read();
  // Measured from Еговерсия3 at 1440 px: fixed 675 px artwork, 12 px vertical padding, 1360 px layout.
  assert.equal(initial.imageHeight,675,'Desktop artwork keeps the reference height instead of shrinking to a square');
  assert.equal(initial.framePadding,'12px 0px');assert.equal(initial.width,1360);
  await page.evaluate(y=>scrollTo({top:y-153,behavior:'instant'}),initial.layoutTop);
  const start=await read();
  await page.evaluate(y=>scrollTo({top:y-153+120,behavior:'instant'}),initial.layoutTop);
  const scrolled=await read();
  if(id!=='2.6')assert.ok(scrolled.visualTop-start.visualTop<=46.5,'Default engineering artwork moves only within the reference card (26.5 px, allowing typography differences)');
  assert.equal(scrolled.overflow,false);
  for(let i=0;i<3;i++)await page.locator('[data-project-add]').click();
  await page.evaluate(y=>scrollTo({top:y-153+400,behavior:'instant'}),initial.layoutTop);
  const expanded=await read();
  if(id!=='2.6')assert.ok(expanded.visualTop-start.visualTop<=190.5,'With four rows, the picture stays within the reference travel of 170.5 px');
  assert.equal(expanded.overflow,false);
  for(const [width,imageHeight] of [[1600,550],[1024,675],[768,270],[390,260],[320,260]]){
   await page.setViewportSize({width,height:1000});
   const responsive=await read();assert.equal(responsive.imageHeight,imageHeight,`${id} at ${width} px uses the reference image height`);assert.equal(responsive.overflow,false);
   if(width<=850){
    const before=responsive.visualTop;await page.evaluate(()=>scrollTo({top:scrollY+120,behavior:'instant'}));assert.ok(Math.abs((await read()).visualTop-before)<1,'Stacked artwork scrolls with the document');
   }
   checks++;
  }
  await page.close();checks++;
 }
 console.log(`Large calculator layout: ${checks} reference dimension/responsive checks and scroll checks passed across all three services.`);
}finally{await browser.close();}
