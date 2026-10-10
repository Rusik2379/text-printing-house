// Optional DOM integration test: npm install --no-save --package-lock=false jsdom
// No browser, server, network resources or customer storage are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'leaflet-content.json'),'utf8'));
const reference=new JSDOM(fs.readFileSync(path.join(root,'kopitsentr/pechat-dokumentov/index.html'),'utf8'));
const sharedSelectors=['.cc-hero','.cc-benefits','.cc-heading','.cc-result','.cc-file-guide','.cc-example','.cc-variant','.cc-step','.cc-reading a'];
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
  assert.equal(items[0].price,t.w.TEXT_LEAFLET_PRICING.quote(service.id).price);
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
  assert.equal(t.d.querySelectorAll('.leaflet-preparation-details details').length,4);
  assert.ok(t.d.querySelector('.cc-requirements .cc-file-guide'));
  for(const value of [service.technical.fileSpec,service.technical.preflight,...service.technical.critical,...service.technical.mistakes])assert.ok(t.d.body.textContent.includes(value),'Full technical requirements are visible');
  for(const instance of [t,editing,link])instance.dom.window.close();
  checks++;
}

// The shared controller must keep the nine existing Copy Center calculators working.
const copycenter=JSON.parse(fs.readFileSync(path.join(root,'copycenter-content.json'),'utf8'));
for(const service of copycenter.services){
  const t=setup(service);assert.equal(t.d.querySelector('[data-cc-add]').disabled,false);
  const cart=await submit(t);assert.equal(cart[0].price,t.w.TEXT_COPYCENTER_PRICING.quote(service.id).price);
  assert.equal(t.d.querySelector('dialog').open,false);t.dom.window.close();checks++;
}
const cards=setup(content.services.find(s=>s.id==='3.1'));
cards.click('[data-cc-quantity="custom"]');
const quantity=cards.d.querySelector('select[data-cc-cell="B6"]');
assert.equal(quantity.options.length,10,'Only the supplied 100–1000 quantities are offered');
quantity.value='400';quantity.dispatchEvent(new cards.w.Event('change',{bubbles:true}));
const cardItem=(await submit(cards))[0];assert.equal(cardItem.configuration.B6,400);
assert.equal(cardItem.price,cards.w.TEXT_LEAFLET_PRICING.quote('3.1',{B6:400}).price);
assert.ok([...cards.d.querySelectorAll('#footer-services a')].some(a=>a.href.endsWith('/text-printing-house/listovaya-poligrafiya/')));
cards.click('.nav-item[data-menu="Листовая полиграфия"]');
assert.equal(cards.d.querySelectorAll('.mega-links a[href*="/listovaya-poligrafiya/"]').length,10);
cards.dom.window.close();

const leaflets=setup(content.services.find(s=>s.id==='3.2'));
leaflets.click('[data-cc-choice="B4"][data-cc-value="Индивидуальный"]');
leaflets.input('[data-cc-cell="B5"]',90);leaflets.input('[data-cc-cell="B6"]',50);
const selected=(await submit(leaflets))[0];assert.equal(selected.configuration.B5,90);assert.equal(selected.configuration.B6,50);
const linked=setup(content.services.find(s=>s.id==='3.2'),'?calc='+encodeURIComponent(JSON.stringify(selected.configuration)));
assert.equal(linked.d.querySelector('[data-cc-cell="B5"]').value,'90');assert.equal(linked.d.querySelector('[data-cc-error]').hidden,true);
leaflets.input('[data-cc-cell="B5"]',500);assert.equal(leaflets.d.querySelector('[data-cc-add]').disabled,true,'An oversized product cannot be ordered');
leaflets.dom.window.close();linked.dom.window.close();

const brochure=setup(content.services.find(s=>s.id==='3.4'));
brochure.input('[data-cc-cell="B7"]',17);assert.equal(brochure.d.querySelector('[data-cc-add]').disabled,true);
brochure.input('[data-cc-cell="B7"]',20);assert.equal(brochure.d.querySelector('[data-cc-add]').disabled,false);
brochure.dom.window.close();

const files=setup(content.services[0]),savedFiles=new Map();
files.w.TEXT_FILES.save=async(key,file)=>savedFiles.set(key,file);
files.w.TEXT_FILES.remove=async key=>savedFiles.delete(key);
const fileInput=files.d.querySelector('[data-cc-file]');
Object.defineProperty(fileInput,'files',{configurable:true,value:[new files.w.File(['%PDF fixture'],'print.pdf',{type:'application/pdf'})]});
fileInput.dispatchEvent(new files.w.Event('change',{bubbles:true}));
files.d.querySelector('[data-cc-comment]').value='Проверить ориентацию оборота';
const fileItem=(await submit(files))[0];assert.equal(fileItem.fileName,'print.pdf');assert.equal(fileItem.comment,'Проверить ориентацию оборота');
assert.equal(savedFiles.get(fileItem.key).name,'print.pdf');
let copied='';Object.defineProperty(files.w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
files.click('[data-cc-copy]');await new Promise(resolve=>setImmediate(resolve));
assert.ok(copied.includes('Проверить ориентацию оборота'));assert.ok(copied.includes('print.pdf'));
const copiedLink=copied.split('\n').find(s=>s.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length);
assert.equal(new URL(copiedLink).pathname,'/text-printing-house/'+content.services[0].path);
files.dom.window.close();
console.log(`Sheet printing DOM: ${checks} service and regression flows, plus quantities, custom sizes, pages, menu links, cart, editing, sharing, files and copying passed.`);
