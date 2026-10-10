// Capture the rendered individual diagrams from a locally served reference.
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2],output=process.argv[3];
if(!base||!output)throw new Error('Usage: node scripts/export-service-reference.mjs http://127.0.0.1:4188/ reference-data.json');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try{
 const page=await browser.newPage();await page.goto(new URL('kopitsentr/pechat-dokumentov/',base).href,{waitUntil:'networkidle'});
 const data=await page.evaluate(()=>({requirements:TEKST_REQUIREMENTS,services:TEKST_DATA.services,schemes:Object.fromEntries(TEKST_DATA.services.map(service=>{const node=document.createElement('div');node.innerHTML=TEKST_TECH_UI.service(service);return [service.id,node.querySelector('.req-scheme').outerHTML];}))}));
 if(data.services.length!==55)throw new Error('Expected 55 reference services');
 await writeFile(output,JSON.stringify(data,null,2)+'\n');console.log('Exported 55 reference requirements and diagrams.');
}finally{await browser.close();}
