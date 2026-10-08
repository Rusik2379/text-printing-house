import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({window:{},Uint8Array,ArrayBuffer,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,TextDecoder,TextEncoder,setTimeout,clearTimeout});
for(const file of ['vendor/pdf/pdf-lib-1.17.1.min.js','vendor/pdf/fontkit-1.1.1.min.js','cart-pdf.js']) {
  vm.runInContext(await fs.readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const api=context.window.TEXT_CART_PDF,date=new Date('2026-10-08T05:00:00Z');
const catalog=[{id:'copy',name:'Копирование документов'},{id:'stickers',name:'Стикерпаки'},{id:'unknown',name:'Инженерная печать'}];
const items=[
  {id:'copy',description:'A4 · Чёрно-белая печать · 25 прогонов',price:250},
  {id:'copy',description:'A3 · Цветная печать · 50 страниц\nКомментарий: проверить заполнение',price:1250.5,priceUpper:2500.75},
  {id:'stickers',description:'Белая плёнка · 5 × 5 см · 50 шт.',price:100.25,fileName:'макет-для-печати.pdf'},
  {id:'unknown',description:'Параметры нужно согласовать',price:null}
];
const data=api.model(items,catalog,{surcharges:{stickers:499.75}},date);
assert.equal(data.lower,2100.5);assert.equal(data.upper,3350.75);
assert.equal(data.pricedCount,3);assert.equal(data.unknownCount,1);
assert.equal(data.rows[1].priceText,'1 250,5 - 2 500,75 ₽');
assert.equal(data.rows[3].priceText,'Требуется расчёт');
assert.equal(data.rows[2].fileName,'макет-для-печати.pdf');
assert.equal(data.rows.length,4,'Configurations of the same service remain separate rows');
assert.equal(api.model([{id:'unknown',price:null}],catalog,{surcharges:{}},date).totalText,'Требуется расчёт');
assert.equal(api.model([{id:'copy',price:0}],catalog,{surcharges:{}},date).totalText,'0 ₽');
assert.throws(()=>api.model([],catalog,{surcharges:{}},date),/Корзина пуста/);
const uvQuote=api.model([{id:'copy',price:300}],catalog,{surcharges:{'uv-direct':500,'wide-cut':400}},date);
assert.ok(uvQuote.surcharges[0].name.includes('UV-печать'),'UV group must identify the service in a shared quote');
assert.ok(uvQuote.surcharges[1].name.includes('Плоттерная'),'Plotter group must identify the shared service');
const deps={PDFLib:context.PDFLib,fontkit:context.fontkit,
  regularBytes:new Uint8Array(await fs.readFile(path.join(root,'assets/fonts/DejaVuSans.ttf'))),
  boldBytes:new Uint8Array(await fs.readFile(path.join(root,'assets/fonts/DejaVuSans-Bold.ttf')))};
const single=await api.create(data,deps);
const singleDoc=await deps.PDFLib.PDFDocument.load(single);
assert.equal(singleDoc.getPageCount(),1,'A normal short quote fits one A4 page');
assert.equal(singleDoc.getTitle(),'ТЕКСТ - расчёт заказа');
const longItems=[{...items[0],description:'Длинный комментарий: '+('Сохранить порядок страниц и проверить файл. '.repeat(65))+'\n'+'длинноеимяфайла'.repeat(15)},
  ...Array.from({length:13},(_,index)=>({...items[index%items.length],description:items[index%items.length].description+'\nКонтрольная позиция '+(index+1)}))];
const long=await api.create(api.model(longItems,catalog,{surcharges:{stickers:499.75}},date),deps);
const longDoc=await deps.PDFLib.PDFDocument.load(long);
assert.ok(longDoc.getPageCount()>=3,'Long comments and large orders flow across pages');
const outputIndex=process.argv.indexOf('--qa-output');
if(outputIndex!==-1){
  const out=path.resolve(process.argv[outputIndex+1]);await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'cart-single.pdf'),single);await fs.writeFile(path.join(out,'cart-long.pdf'),long);
  console.log('PDF QA files: '+out);
}
console.log('Cart PDF checks passed: ranges, minimum surcharges, unknown/zero prices, duplicate services, Cyrillic fonts, A4 and '+longDoc.getPageCount()+'-page pagination.');
