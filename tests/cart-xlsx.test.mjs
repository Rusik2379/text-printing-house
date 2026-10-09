import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const context={TextEncoder,Uint8Array,Uint32Array,atob,Date};context.window=context;vm.createContext(context);
for(const name of ['cart-pdf.js','cart-xlsx.js','vendor/xlsx/order-template.js'])vm.runInContext(await fs.readFile(new URL('../'+name,import.meta.url),'utf8'),context);
const api=context.TEXT_CART_XLSX,date=new Date(2026,9,9,12);
const catalog=[{id:'1.1',name:'Печать документов'},{id:'1.2',name:'Копирование документов'},{id:'2.1',name:'Инженерная печать'},{id:'4.4',name:'Стикерпаки'},{id:'4.1',name:'Фигурные стикеры'},{id:'6.6',name:'Брелоки'},{id:'6.9',name:'Номерки'}];
const row=(id,price,description='Параметры',configuration={})=>({id,price,description,configuration});
const cases={
 regular:[row('1.1',250,'Ч/Б · A4',{B7:25}),row('1.1',350,'Цвет · A4',{B7:10}),row('6.6',9329.98,'Акрил · 25 × 45 мм',{B10:100})],
 unknown:[row('1.2',null,'Тираж и параметры уточнить')],
 mixed:[row('1.1',0,'Фальцовка не требуется',{B7:1}),row('1.2',null,'Требуется расчёт')],
 range:[{...row('1.1',100,'Цветная печать',{B7:10}),priceUpper:200}],
 minimum:[row('4.1',100,'Белая плёнка',{quantity:10}),row('4.4',100,'2 набора',{quantity:2})],
 long:[row('2.1',25000,'20 групп листов\n'+('Длинный комментарий для печати '.repeat(120)),{rows:[{D:100}]})],
 escaping:[row('1.1',1234.56,'<Тест> & "кавычки"\u0000\n=HYPERLINK("https://example.invalid")',{B7:17})]
};
// Parse the stored ZIP entries; Python's zipfile separately verifies CRC and XML validity.
function unzip(bytes){
 const files={};let p=0;
 const u16=o=>bytes[o]|bytes[o+1]<<8,u32=o=>(bytes[o]|bytes[o+1]<<8|bytes[o+2]<<16|bytes[o+3]<<24)>>>0;
 while(u32(p)===0x04034b50){const size=u32(p+18),nameLength=u16(p+26),extra=u16(p+28);assert.equal(u16(p+8),0);const name=new TextDecoder().decode(bytes.slice(p+30,p+30+nameLength)),start=p+30+nameLength+extra;files[name]=bytes.slice(start,start+size);p=start+size;}
 assert.equal(u32(p),0x02014b50,'A real ZIP central directory exists');return files;
}
function sheet(files,n){return new JSDOM(new TextDecoder().decode(files[`xl/worksheets/sheet${n}.xml`]),{contentType:'application/xml'}).window.document;}
function val(doc,ref){const c=doc.querySelector(`c[r="${ref}"]`);if(!c)return null;const value=c.querySelector('v');if(value)return c.getAttribute('t')==='str'?value.textContent:Number(value.textContent);return c.querySelector('t')?.textContent??null;}
function form(doc,ref){return doc.querySelector(`c[r="${ref}"] f`)?.textContent;}
const outputArg=process.argv.indexOf('--qa-output'),output=outputArg<0?null:path.resolve(process.argv[outputArg+1]);
if(output)await fs.mkdir(output,{recursive:true});
for(const [name,items] of Object.entries(cases)){
 const breakdown={surcharges:name==='minimum'?{stickers:400}:{}};
 const model=api.model(items,catalog,breakdown,date,{number:'Т-009',name:'ООО «Тест»',basis:'Заказ № 15'});
 const bytes=context.TEKST_XLSX(model),files=unzip(bytes),receipt=sheet(files,1),act=sheet(files,2);
 assert.ok(files['xl/media/logo.png'].length>1000,'Embedded logo');
 assert.ok(new TextDecoder().decode(files['xl/workbook.xml']).includes('Товарный чек'));
 assert.ok(new TextDecoder().decode(files['xl/workbook.xml']).includes('_xlnm.Print_Titles'));
 assert.ok(receipt.querySelector('col[min="8"][hidden="1"]'));
 assert.equal(receipt.querySelector('pageSetup').getAttribute('paperSize'),'9');
 assert.equal(receipt.querySelector('sheetView').getAttribute('showGridLines'),'0');
 assert.equal(val(receipt,'B7'),'Т-009');assert.equal(val(act,'B7'),'Т-009');assert.equal(typeof val(receipt,'D7'),'number');
 assert.equal(val(receipt,'B9'),'ООО «Тест»');assert.ok(form(act,'B10').includes("'Товарный чек'!$B$9"));
 const totalCell=[...receipt.querySelectorAll('c')].find(c=>c.getAttribute('r').startsWith('F')&&c.querySelector('f')?.textContent.includes('COUNT(F'));
 const totalRef=totalCell.getAttribute('r'),expected=items.filter(i=>i.price!==null).reduce((a,x)=>a+x.price,0)+(name==='minimum'?400:0);
 assert.equal(val(receipt,totalRef),items.every(i=>i.price===null)?'Требуется расчёт':Math.round((expected+1e-8)*100)/100,name);
 assert.ok(form(receipt,'H12').includes('UPPER'));
 assert.ok([...act.querySelectorAll('f')].some(f=>/^'Товарный чек'!A/.test(f.textContent)),'Act links the amount in words');
 if(name==='regular'){assert.equal(val(receipt,'D13'),25);assert.equal(val(receipt,'D15'),100);assert.ok(Math.abs(val(receipt,'E15')-93.2998)<1e-10);assert.equal(val(receipt,'F15'),9329.98);assert.ok(form(receipt,'F15').includes('ROUND(D15*E15,2)'));}
 if(name==='unknown'){assert.equal(val(receipt,'E13'),'Уточнить');assert.equal(val(receipt,'F13'),'');assert.equal(val(receipt,'H12'),'Требуется расчёт');}
 if(name==='mixed'){assert.equal(val(receipt,totalRef),0,'A zero quote is different from an unknown price');}
 if(name==='minimum'){assert.equal(model.cart.length,3);assert.equal(model.cart[1].unit,'набор');assert.equal(model.cart[1].quantity,2);assert.ok(receipt.documentElement.textContent.includes('минимальный чек'));}
 if(name==='range')assert.ok(/100\s*₽?\s*[-–]\s*200\s*₽/.test(receipt.documentElement.textContent),'The price range is preserved');
 if(name==='long'){
  assert.equal(model.cart[0].quantity,1);assert.equal(model.cart[0].unit,'усл.');
  assert.ok([...receipt.querySelectorAll('row')].every(r=>Number(r.getAttribute('ht'))<=210));
  const descriptions=[...receipt.querySelectorAll('c')].filter(c=>/^C\d+$/.test(c.getAttribute('r'))&&c.querySelector('t')).map(c=>c.querySelector('t').textContent).join(' ');
  assert.equal((descriptions.match(/комментарий/g)||[]).length,120,'Long descriptions are not truncated');
 }
 if(name==='escaping'){assert.ok(receipt.documentElement.textContent.includes('<Тест> & "кавычки"'));assert.ok(![...receipt.querySelectorAll('f')].some(f=>f.textContent.includes('HYPERLINK')));}
 if(output)await fs.writeFile(path.join(output,name+'.xlsx'),bytes);
}
assert.throws(()=>api.model([],catalog,{},date));
console.log('Cart XLSX: quantities, duplicate services, precise unit prices, ranges, unknown/zero prices, minimum surcharges, linked act, logo, dates, long descriptions and XML escaping passed.');
