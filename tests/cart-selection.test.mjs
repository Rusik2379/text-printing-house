// Exercise the shipped cart against isolated browser storage and file records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';

const root=new URL('../',import.meta.url),read=file=>readFileSync(new URL(file,root),'utf8');
const dom=new JSDOM(read('index.html'),{url:'https://example.invalid/text-printing-house/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.ResizeObserver=w.IntersectionObserver=class{observe(){} disconnect(){}};
w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
const rows=[
 {key:'print-a',id:'1.1',price:250,description:'A4 · Ч/Б',fileName:'a.pdf'},
 {key:'print-b',id:'1.1',price:350,description:'A3 · Цвет'},
 {key:'stickers',id:'4.1',price:100,minimumGroup:'stickers',description:'Круглые стикеры',fileName:'stickers.pdf'}
];
w.localStorage.setItem('text-print-cart-v1',JSON.stringify(rows));
let currentScript;
Object.defineProperty(d,'currentScript',{get:()=>currentScript});
for(const script of d.querySelectorAll('script[src]')){
 const file=path.basename(new URL(script.src).pathname);
 if(['consent.js','faq.js'].includes(file))continue;
 currentScript=script;w.eval(read(file));
}
const deleted=[];w.TEXT_FILES.remove=async key=>deleted.push(key);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const change=(selector,checked)=>{const input=d.querySelector(selector);assert.ok(input);input.checked=checked;input.dispatchEvent(new w.Event('change',{bubbles:true}));};
w.TEXT_APP.openCart();
assert.equal(d.querySelectorAll('[data-cart-select]').length,3);
assert.equal(d.querySelector('[data-cart-remove-selected]').disabled,true);
change('[data-cart-select="print-a"]',true);
assert.equal(d.querySelector('[data-cart-select-all]').indeterminate,true);
assert.equal(d.querySelectorAll('.cart-row.is-selected').length,1);
assert.equal(d.querySelector('[data-cart-selected-count]').textContent,'Выбрано: 1');
change('[data-cart-select="stickers"]',true);
d.querySelector('[data-cart-remove-selected]').click();await tick();
assert.deepEqual(Array.from(w.TEXT_APP.getCart(),row=>row.key),['print-b']);
assert.deepEqual(deleted.sort(),['print-a','stickers']);
assert.equal(d.querySelectorAll('.cart-row').length,1);
assert.equal(d.querySelector('.cart-summary strong').textContent,'350 ₽');
assert.equal(d.querySelector('[data-cart-remove-selected]').disabled,true);
assert.equal(d.querySelector('[data-cart-selected-count]').textContent,'Выбрано: 0');
assert.ok(d.querySelector('#download-cart-pdf')&&d.querySelector('#download-cart-xlsx'));
change('[data-cart-select-all]',true);
assert.equal(d.querySelector('[data-cart-select]').checked,true);
change('[data-cart-select-all]',false);
assert.equal(d.querySelector('[data-cart-select]').checked,false);
assert.equal(d.querySelector('[data-cart-remove-selected]').disabled,true);
d.querySelector('[data-cart-remove-all]').click();await tick();
assert.equal(w.TEXT_APP.getCart().length,1,'Confirmation keeps the basket intact');
d.querySelector('[data-cancel-cart-clear]').click();
assert.equal(d.querySelectorAll('.cart-row').length,1);
d.querySelector('[data-cart-remove-all]').click();
d.querySelector('[data-confirm-cart-clear]').click();await tick();
assert.equal(w.TEXT_APP.getCart().length,0);
assert.equal(d.querySelectorAll('.cart-row').length,0);
assert.ok(d.querySelector('.cart-empty'));
assert.equal(d.querySelector('#cart-count').textContent,'0');
assert.deepEqual(JSON.parse(w.localStorage.getItem('text-print-cart-v1')),[]);
assert.deepEqual(deleted.sort(),['print-a','print-b','stickers']);
dom.window.close();
console.log('Cart bulk actions: selection, select all, partial deletion, file cleanup, totals, persistence and empty state passed.');
