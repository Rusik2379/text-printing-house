// Optional DOM integration test: npm install --no-save --package-lock=false jsdom
// No browser, server, network resources or customer storage are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'project-content.json'),'utf8'));
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
  for(const selector of sharedSelectors){
    if(['2.1','2.5','2.6'].includes(service.id)&&['.cc-hero','.cc-heading','.cc-result'].includes(selector))continue;
    assert.equal(componentShape(w.document.querySelector(selector)),referenceShapes[selector],service.id+' shares the Copy Center component: '+selector);
  }
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
  return {dom,w,d:w.document,click:s=>{const button=w.document.querySelector(s);assert.ok(button,s);button.click();},input:(s,v)=>{const input=w.document.querySelector(s);assert.ok(input,s);input.value=String(v);input.dispatchEvent(new w.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));}};
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
  assert.equal(items[0].price,t.w.TEXT_PROJECT_PRICING.quote(service.id).price);
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
  assert.equal(t.d.querySelectorAll('.project-preparation-details details').length,4);
  assert.ok(t.d.querySelector('.cc-requirements .cc-file-guide'));
  for(const value of [service.technical.fileSpec,service.technical.preflight,...service.technical.critical,...service.technical.mistakes])assert.ok(t.d.body.textContent.includes(value),'Full technical requirements are visible');
  for(const instance of [t,editing,link])instance.dom.window.close();
  checks++;
}
for(const id of ['2.1','2.5','2.6']){
  const service=content.services.find(s=>s.id===id),t=setup(service),countCol=id==='2.6'?'E':'D',colourCol=id==='2.6'?'D':'C';
  assert.equal(t.d.querySelectorAll('[data-project-row="0"] select').length,id==='2.6'?3:2,'The first row uses the same compact controls as the rest');
  t.input(`[data-project-index="0"][data-project-row-cell="${countCol}"]`,25);
  const preset=t.w.TEXT_PROJECT_PRICING.quote(id,{...t.w.TEXT_PROJECT_PRICING.defaults(id),rows:[{...t.w.TEXT_PROJECT_PRICING.defaults(id).rows[0],[countCol]:25}]});
  const formatted=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(preset.price)+' ₽';
  assert.equal(t.d.querySelector('[data-cc-total]').textContent,formatted);
  t.input(`[data-project-index="0"][data-project-row-cell="${countCol}"]`,10);
  if(id!=='2.6'){
    t.input('[data-project-index="0"][data-project-row-cell="B"]','A4x3');
    const extended=(await submit(t))[0];assert.equal(extended.configuration.rows[0].B,'A4x3','Extended formats remain available');
    const restored=setup(service,'?calc='+encodeURIComponent(JSON.stringify(extended.configuration)));
    assert.equal(restored.d.querySelector('[data-project-row-cell="B"]').value,'A4x3');restored.dom.window.close();
    t.w.localStorage.setItem('text-print-cart-v1','[]');
    t.input('[data-project-index="0"][data-project-row-cell="B"]','A1');
    t.input('[data-project-select="B4"]','Под A4');
    t.input('[data-project-select="B5"]','Да');
    assert.ok(t.d.querySelector('[data-project-select="B6"]'),'Binding reveals its dependent options');
    const processed=(await submit(t))[0];
    assert.equal(processed.configuration.B4,'Под A4');assert.equal(processed.configuration.B5,'Да');
    const restoredProcessing=setup(service,'?calc='+encodeURIComponent(JSON.stringify(processed.configuration)));
    assert.equal(restoredProcessing.d.querySelector('[data-project-select="B5"]').value,'Да');
    restoredProcessing.dom.window.close();
    t.w.localStorage.setItem('text-print-cart-v1','[]');t.click('[data-cc-reset]');
  }
  t.input(`[data-project-index="0"][data-project-row-cell="${countCol}"]`,10);
  t.click('[data-project-add]');
  assert.equal(t.d.querySelectorAll('[data-project-row]').length,2);
  t.input(`[data-project-index="1"][data-project-row-cell="${countCol}"]`,5);
  t.input(`[data-project-index="1"][data-project-row-cell="${colourCol}"]`,'Цвет');
  const rows=(await submit(t))[0].configuration.rows;
  assert.equal(rows[0][countCol],10,'Added rows are independent');
  assert.equal(rows[1][countCol],5);assert.equal(rows[1][colourCol],'Цвет');
  t.input(`[data-project-index="1"][data-project-row-cell="${countCol}"]`,0);
  assert.equal(t.d.querySelector('[data-cc-add]').disabled,true,'Invalid sheets cannot be ordered');
  t.click('[data-project-remove="1"]');assert.equal(t.d.querySelectorAll('[data-project-row]').length,1);
  assert.equal(t.d.querySelector('[data-cc-add]').disabled,false);
  const limit=id==='2.6'?5:20;
  for(let i=1;i<limit;i++)t.click('[data-project-add]');
  assert.equal(t.d.querySelector('[data-project-add]').disabled,true);
  assert.equal(t.d.querySelectorAll('[data-project-duplicate]').length,0);
  t.dom.window.close();checks++;
}
const fold=setup(content.services.find(s=>s.id==='2.3'));
const select=fold.d.querySelector('[data-project-select="B4"]');select.value='A4';select.dispatchEvent(new fold.w.Event('change',{bubbles:true}));
assert.equal(fold.d.querySelector('[data-cc-add]').disabled,true,'Unnecessary A4 folding cannot be ordered');
assert.equal(fold.d.querySelector('[data-cc-download]').disabled,false,'A zero-price explanation can be saved');
assert.equal(fold.d.querySelector('[data-cc-range-note]').hidden,false);
fold.dom.window.close();

const files=setup(content.services[0]),savedFiles=new Map();
files.w.TEXT_FILES.save=async(key,file)=>savedFiles.set(key,file);
files.w.TEXT_FILES.remove=async key=>savedFiles.delete(key);
const fileInput=files.d.querySelector('[data-cc-file]');
Object.defineProperty(fileInput,'files',{configurable:true,value:[new files.w.File(['%PDF test fixture'],'project.pdf',{type:'application/pdf'})]});
fileInput.dispatchEvent(new files.w.Event('change',{bubbles:true}));
files.d.querySelector('[data-cc-comment]').value='Сохранить порядок страниц';
const fileItem=(await submit(files))[0];
assert.equal(fileItem.fileName,'project.pdf');assert.equal(savedFiles.get(fileItem.key).name,'project.pdf');
assert.equal(fileItem.comment,'Сохранить порядок страниц');
let copied='';
Object.defineProperty(files.w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
files.click('[data-cc-copy]');await new Promise(resolve=>setImmediate(resolve));
assert.ok(copied.includes('Сохранить порядок страниц'));assert.ok(copied.includes('project.pdf'));
const copiedLink=copied.split('\n').find(line=>line.startsWith('Ссылка на расчёт: ')).slice('Ссылка на расчёт: '.length);
assert.equal(new URL(copiedLink).pathname,'/text-printing-house/'+content.services[0].path);
assert.ok(new URL(copiedLink).searchParams.has('calc'));
const fileEdit=setup(content.services[0],'?edit='+fileItem.key,[fileItem]);
fileEdit.w.TEXT_FILES.remove=async key=>savedFiles.delete(key);
fileEdit.click('[data-cc-remove-file]');
const removedFile=(await submit(fileEdit))[0];assert.equal(removedFile.fileName,undefined);assert.equal(savedFiles.has(fileItem.key),false);
files.dom.window.close();fileEdit.dom.window.close();
console.log(`Project DOM integration: ${checks+2} service flows passed, including grouped sheets, limits, cart, editing, shared links, file metadata, comments, copying and technical content.`);
