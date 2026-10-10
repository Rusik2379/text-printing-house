// Optional DOM integration test: npm install --no-save --package-lock=false jsdom
// No browser, server, network resources or customer storage are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'uv-content.json'),'utf8'));
const reference=new JSDOM(fs.readFileSync(path.join(root,'kopitsentr/pechat-dokumentov/index.html'),'utf8'));
const sharedSelectors=['.cc-hero','.cc-benefits','.cc-heading','.cc-result','.cc-example','.cc-variant','.cc-step','.cc-reading a'];
const componentShape=element=>element?`${element.tagName}.${element.className}(${[...element.children].map(componentShape).join(',')})`:null;
const referenceShapes=Object.fromEntries(sharedSelectors.map(s=>[s,componentShape(reference.window.document.querySelector(s))]));
reference.window.close();
let checks=0;
function setup(service,query='',cart=[]){
  const html=fs.readFileSync(path.join(root,service.path,'index.html'),'utf8');
  const dom=new JSDOM(html,{url:'https://example.invalid/text-printing-house/'+service.path+query,runScripts:'outside-only'});
  const w=dom.window;
  for(const selector of sharedSelectors)assert.equal(componentShape(w.document.querySelector(selector)),referenceShapes[selector],service.id+' shares the Copy Center component: '+selector);
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.ResizeObserver=w.IntersectionObserver=class{observe(){} disconnect(){}};
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem('text-print-cart-v1',JSON.stringify(cart));
  let currentScript;
  Object.defineProperty(w.document,'currentScript',{configurable:true,get:()=>currentScript});
  for(const script of w.document.querySelectorAll('script[src]')){
    const file=path.basename(new URL(script.src).pathname);
    if(['consent.js','faq.js'].includes(file))continue;
    currentScript=script;
    w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  }
  currentScript=null;
  return {dom,w,d:w.document,click:s=>{const button=w.document.querySelector(s);assert.ok(button,s);button.click();},input:(s,v)=>{const input=w.document.querySelector(s);assert.ok(input,s);input.value=String(v);input.dispatchEvent(new w.Event('input',{bubbles:true}));}};
}
async function submit(t){
  t.d.querySelector('#copycenter-form').dispatchEvent(new t.w.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  return t.w.TEXT_APP.getCart();
}
for(const service of content.services){
  const t=setup(service);
  assert.equal(t.d.querySelector('[data-cc-error]').hidden,true,service.id);
  assert.equal(t.d.querySelector('[data-cc-add]').disabled,false,service.id);
  const items=await submit(t);
  assert.equal(items.length,1,service.id);
  assert.equal(items[0].price,t.w.TEXT_UV_PRICING.quote(service.id).price);
  assert.equal(t.d.querySelector('dialog').open,false,'Adding a calculation does not open the cart');
  await submit(t);assert.equal(t.w.TEXT_APP.getCart().length,2,'New calculations are separate positions');
  t.click('[data-action="cart"]');assert.equal(t.d.querySelector('dialog').open,true);
  assert.ok([...t.d.querySelectorAll('dialog button')].some(b=>/PDF/.test(b.textContent)),'The shared cart includes PDF download');
  const saved=t.w.TEXT_APP.getCart()[0];
  const editing=setup(service,'?edit='+saved.key,t.w.TEXT_APP.getCart());
  assert.equal(editing.d.querySelector('[data-cc-add]').textContent,'Сохранить изменения');
  await submit(editing);assert.equal(editing.w.TEXT_APP.getCart().length,2,'Editing does not duplicate a position');
  const link=setup(service,'?calc='+encodeURIComponent(JSON.stringify(saved.configuration)));
  assert.equal(link.d.querySelector('[data-cc-error]').hidden,true);
  const linkedItems=await submit(link);assert.equal(linkedItems[0].price,saved.price);
  assert.equal(t.d.querySelectorAll('.uv-preparation-details details').length,4);
  assert.ok(t.d.querySelector('.cc-requirements .cc-file-guide'));
  for(const value of [service.technical.fileSpec,service.technical.preflight,service.technical.note,...service.technical.critical,...service.technical.mistakes])assert.ok(t.d.body.textContent.includes(value),'Full technical requirements are visible');
  for(const instance of [t,editing,link])instance.dom.window.close();
  checks++;
}


const find=id=>content.services.find(s=>s.id===id);
const uv=setup(find('6.1'));
uv.click('[data-cc-choice="B4"][data-cc-value="ПЭТ"]');
assert.deepEqual([...uv.d.querySelectorAll('[data-cc-choice="B5"]')].map(b=>b.dataset.ccValue),['0.5','1','1.5']);
assert.equal(uv.d.querySelector('[data-cc-choice="B5"][aria-pressed="true"]').dataset.ccValue,'0.5');
uv.input('[data-cc-cell="B7"]',401);assert.equal(uv.d.querySelector('[data-cc-add]').disabled,true);
uv.click('[data-cc-reset]');assert.equal(uv.d.querySelector('[data-cc-add]').disabled,false);
uv.click('.nav-item[data-menu="UV-печать и резка"]');
assert.equal(uv.d.querySelectorAll('.mega-links a[href*="/uv-pechat-i-rezka/"]').length,9);
assert.ok([...uv.d.querySelectorAll('#footer-services a')].some(a=>a.href.endsWith('/uv-pechat-i-rezka/')));
uv.dom.window.close();

const laser=setup(find('6.3'));
assert.ok(laser.d.body.textContent.includes('работы без стоимости материала'));
laser.click('[data-cc-choice="B4"][data-cc-value="Картон"]');
assert.deepEqual([...laser.d.querySelectorAll('[data-cc-choice="B5"]')].map(b=>b.dataset.ccValue),['1','2','3']);
assert.equal(laser.d.querySelector('[data-cc-cell="B8"]'),null,'The preliminary cut length is an output, not an editable input');
laser.dom.window.close();

const engraving=setup(find('6.4'));
assert.equal(engraving.d.querySelector('[data-cc-cell="B8"]').min,'10');
assert.equal(engraving.d.querySelector('.uv-fill-guide dl').children.length,5);
engraving.input('[data-cc-cell="B8"]',101);assert.equal(engraving.d.querySelector('[data-cc-add]').disabled,true);
engraving.click('[data-cc-choice="B5"][data-cc-value="КОНТУРНАЯ"]');
assert.equal(engraving.d.querySelector('[data-cc-cell="B8"]'),null);assert.equal(engraving.d.querySelector('.uv-fill-guide'),null);
assert.equal(engraving.d.querySelector('[data-cc-add]').disabled,false,'Contour does not use the invalid hidden fill');
engraving.click('[data-cc-choice="B5"][data-cc-value="ПЛОЩАДНАЯ"]');
assert.equal(engraving.d.querySelector('[data-cc-cell="B8"]').value,'20');
engraving.dom.window.close();

const keys=setup(find('6.6'));
keys.click('[data-cc-choice="B13"][data-cc-value="ВЫБОРОЧНЫЙ ЛАК"]');
keys.click('[data-cc-choice="B5"][data-cc-value="Акрил зеркальный"]');
assert.equal(keys.d.querySelectorAll('[data-cc-choice="B7"]').length,1);
assert.equal(keys.d.querySelector('[data-cc-choice="B7"]').dataset.ccValue,'ГРАВИРОВКА 1 СТОРОНА');
assert.equal(keys.d.querySelectorAll('[data-cc-choice="B13"]').length,1);
assert.equal(keys.d.querySelector('[data-cc-choice="B13"]').dataset.ccValue,'БЕЗ ЛАКА');
assert.equal(keys.d.querySelector('[data-cc-add]').disabled,false);
keys.dom.window.close();

const metal=setup(find('6.8'));
assert.deepEqual([...metal.d.querySelectorAll('[data-cc-choice="B4"]')].map(b=>b.dataset.ccValue),['Алюминий','Нержавейка AISI']);
metal.dom.window.close();

const numbers=setup(find('6.9'));
assert.equal(numbers.d.querySelectorAll('.uv-number-grid li').length,50);
assert.equal(numbers.d.querySelector('.uv-number-grid li').textContent,'001');
assert.equal([...numbers.d.querySelectorAll('.uv-number-grid li')].at(-1).textContent,'050');
assert.equal(numbers.d.querySelectorAll('[data-cc-choice="B12"]').length,1);
assert.equal(numbers.d.querySelector('[data-cc-choice="B12"]').dataset.ccValue,'Без фурнитуры');
numbers.dom.window.close();

const files=setup(find('6.1')),savedFiles=new Map();
files.w.TEXT_FILES.save=async(key,file)=>savedFiles.set(key,file);
files.w.TEXT_FILES.remove=async key=>savedFiles.delete(key);
const fileInput=files.d.querySelector('[data-cc-file]');
Object.defineProperty(fileInput,'files',{configurable:true,value:[new files.w.File(['%PDF fixture'],'uv-layout.pdf',{type:'application/pdf'})]});
fileInput.dispatchEvent(new files.w.Event('change',{bubbles:true}));
files.d.querySelector('[data-cc-comment]').value='WHITE в отдельном слое';
const fileItem=(await submit(files))[0];assert.equal(fileItem.fileName,'uv-layout.pdf');assert.equal(fileItem.comment,'WHITE в отдельном слое');
assert.equal(savedFiles.get(fileItem.key).name,'uv-layout.pdf');
let copied='';Object.defineProperty(files.w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
files.click('[data-cc-copy]');await new Promise(resolve=>setImmediate(resolve));
assert.ok(copied.includes('WHITE в отдельном слое'));assert.ok(copied.includes('uv-layout.pdf'));
const copiedLink=copied.split('\n').find(s=>s.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length);
assert.equal(new URL(copiedLink).pathname,'/text-printing-house/'+find('6.1').path);
files.dom.window.close();

const landing=new JSDOM(fs.readFileSync(path.join(root,'uv-pechat-i-rezka/index.html'),'utf8'));
assert.equal(landing.window.document.querySelectorAll('.cc-service-card').length,9);
assert.equal(landing.window.document.querySelectorAll('link[href*="service-calculator.css"]').length,1);
landing.window.close();
console.log(`UV DOM: ${checks} service flows, plus dependent materials, fill guide, full number sequence, menus, cart, editing, sharing, files and copying passed.`);
