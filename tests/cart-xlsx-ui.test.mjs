// Local DOM integration: no browser, network or customer storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  const dom=new JSDOM(read('index.html'),{url:'https://example.invalid/text-printing-house/',runScripts:'outside-only'}),w=dom.window;
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.ResizeObserver=w.IntersectionObserver=class{observe(){} disconnect(){}};
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem('text-print-cart-v1',JSON.stringify([
    {key:'doc-1',id:'1.1',price:250,description:'Ч/Б · A4',configuration:{B7:25},fileName:'Первый.pdf'},
    {key:'doc-2',id:'1.1',price:350,description:'Цвет · A4',configuration:{B7:10}}
  ]));
  let currentScript;
  Object.defineProperty(w.document,'currentScript',{get:()=>currentScript});
  for(const script of w.document.querySelectorAll('script[src]')){
    const file=path.basename(new URL(script.src).pathname);
    if(['consent.js','faq.js'].includes(file))continue;
    currentScript=script;w.eval(read(file));
  }
  currentScript=null;
  return {dom,w,d:w.document};
}

const t=setup();
assert.ok(!t.d.querySelector('script[src*="order-template"]'),'Workbook template is not loaded on page opening');
t.w.TEXT_APP.openCart();
const button=t.d.querySelector('#download-cart-xlsx');
assert.ok(button);assert.ok(t.d.querySelector('#download-cart-pdf'),'Existing PDF export remains available');
assert.equal(t.d.querySelectorAll('.cart-row').length,2);
let downloads=0,exported,finish;
t.w.TEXT_CART_XLSX.download=async model=>{downloads++;exported=model;await new Promise(resolve=>finish=resolve);};
button.click();
assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
button.click();assert.equal(downloads,1,'Busy button does not duplicate the export');
assert.equal(exported.cart.length,2);assert.equal(exported.cart[0].quantity,25);assert.equal(exported.cart[1].quantity,10);
assert.equal(exported.lower,600);assert.ok(exported.cart[0].description.includes('Первый.pdf'));
finish();await tick();
assert.equal(button.disabled,false);assert.equal(button.hasAttribute('aria-busy'),false);
assert.ok(t.d.querySelector('#cart-xlsx-status').textContent.includes('Excel скачан'));
assert.equal(t.w.TEXT_APP.getCart().length,2,'Downloading preserves the basket');
t.w.TEXT_CART_XLSX.download=async()=>{throw Error('Load failure');};
button.click();await tick();
assert.equal(button.disabled,false);assert.ok(t.d.querySelector('#cart-xlsx-status').textContent.includes('Не удалось'));
t.w.TEXT_CART_XLSX.download=async()=>{downloads++;};
button.click();await tick();assert.equal(downloads,2,'Export can be retried after a failure');
let pdfDownloads=0;t.w.TEXT_CART_PDF.download=async model=>{pdfDownloads++;assert.equal(model.rows.length,2);};
t.d.querySelector('#download-cart-pdf').click();await tick();assert.equal(pdfDownloads,1);
t.dom.window.close();

// Lazy loader shares one script, recovers from a failed script, and downloads real XLSX MIME.
for(const failure of ['network','missing-module']){
  const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://example.invalid/text-printing-house/company/about/',runScripts:'outside-only'}),w=dom.window;
  Object.defineProperty(w.document,'currentScript',{value:{src:'https://example.invalid/text-printing-house/cart-xlsx.js?v=1'}});
  w.eval(read('cart-xlsx.js'));
  const failed=w.TEXT_CART_XLSX.download({cart:[]}),reject=assert.rejects(failed);
  const bad=w.document.querySelector('script');
  assert.equal(bad.src,'https://example.invalid/text-printing-house/vendor/xlsx/order-template.js?v=20261009-2');
  if(failure==='network')bad.onerror();else bad.onload();
  await reject;assert.equal(w.document.querySelector('script'),null);
  const links=[],blobs=[];
  w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-test';};
  w.URL.revokeObjectURL=()=>{};w.setTimeout=()=>0;
  w.HTMLAnchorElement.prototype.click=function(){links.push({name:this.download,href:this.href});};
  const first=w.TEXT_CART_XLSX.download({cart:[]}),second=w.TEXT_CART_XLSX.download({cart:[]});
  assert.equal(w.document.querySelectorAll('script').length,1);
  w.TEKST_XLSX=()=>new w.Uint8Array([80,75,3,4]);w.document.querySelector('script').onload();
  await Promise.all([first,second]);
  assert.equal(links.length,2);assert.ok(links.every(link=>link.name.endsWith('.xlsx')));
  assert.ok(blobs.every(blob=>blob.type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&&blob.size===4));
  dom.window.close();
}

const manifest=JSON.parse(read('business-documents.json'));
for(const page of ['contacts/index.html']){
  const dom=new JSDOM(read(page)),d=dom.window.document;
  assert.equal(d.querySelector('#contacts-documents h2').textContent,'Фирменные документы');
  const links=[...d.querySelectorAll('#contacts-documents a[download]')];assert.equal(links.length,6);
  for(const item of manifest.documents){
    assert.ok(links.some(link=>link.getAttribute('href').endsWith(item.path)&&link.textContent.includes(item.name)));
    const bytes=fs.readFileSync(path.join(root,item.path));
    assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  }
  dom.window.close();
}
console.log('Cart Excel UI: quantities and files, busy state, recovery/retry, preserved PDF and basket, lazy loader, download MIME and six original Contacts documents passed.');
