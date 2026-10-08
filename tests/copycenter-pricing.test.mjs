import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context={};vm.createContext(context);
for(const file of ['copycenter-pricing-data','copycenter-engine','copycenter-pricing'])
  vm.runInContext(await readFile(new URL('../'+file+'.js',import.meta.url),'utf8'),context);
const api=context.TEXT_COPYCENTER_PRICING;
let checked=0;
function expect(id,configuration,price,upper=price){
  const q=api.quote(id,configuration);assert.ok(q.valid,`${id}: ${q.error}`);
  assert.equal(q.price,price,`${id}: ${JSON.stringify(configuration)}`);assert.equal(q.upper,upper);
  assert.equal(q.days,Math.max(1,Math.ceil(upper/10000)));checked++;
}
function reject(id,c){assert.equal(api.quote(id,c).valid,false,`${id} accepted ${JSON.stringify(c)}`);checked++;}
// Customer workbook reference examples, independently recorded before implementation.
for(const [i,price] of [100,250,1152,500,2112,1405,40,1590,11650].entries())expect('1.'+(i+1),{},price);
// Tariff thresholds and an odd last page: second-side factor applies to full pairs only.
for(const [n,rate] of [[1,10],[10,10],[11,7],[50,7],[51,6],[100,6],[101,5],[500,5],[501,4],[1000,4],[1001,3.5]]){
  expect('1.1',{B7:n},n*rate);
  assert.equal(api.quote('1.1',{B7:n}).details.find(item=>item.label==='Тариф за одну сторону, ₽').value,rate,'Breakdown must show the monetary rate, not the quantity band');
  expect('1.1',{B7:n,B6:'двусторонняя'},Math.round((Math.floor(n/2)*rate*1.5+(n%2)*rate)*100)/100);
}
expect('1.1',{B4:'А3',B7:501},5511);
expect('1.1',{B4:'А3',B5:'цветная',B7:300},9000,13500);
expect('1.1',{B4:'А3',B5:'цветная',B6:'двусторонняя',B7:3,B8:'Color Copy 200 г/м²'},129,166.5);
for(const rate of [15,20,25,30])expect('1.1',{B5:'цветная',B7:3,B6:'двусторонняя',B8:'Color Copy 120 г/м²',colorRate:rate},rate*2.5+16);
reject('1.1',{B4:'А3',B8:'IQ Color'});reject('1.1',{B5:'цветная',colorRate:16});
for(const [format,color,feed,rate] of [['A4','Ч/Б','Со стекла',10],['A4','Ч/Б','С автоподатчика',8],['A4','Цвет','Со стекла',20],['A4','Цвет','С автоподатчика',15],['A3','Ч/Б','Со стекла',20],['A3','Ч/Б','С автоподатчика',18],['A3','Цвет','Со стекла',35],['A3','Цвет','С автоподатчика',30]])expect('1.2',{B4:format,B5:color,B6:feed,B7:13},13*rate);
for(const [n,rate] of [[10,35],[11,32],[50,32],[51,29],[100,29],[101,27]])expect('1.3',{B8:n},rate*n);
expect('1.3',{B4:'A2',B5:'Матовая',B8:2},800);expect('1.3',{B4:'A1',B5:'Сатин',B8:2},2600);
expect('1.3',{B4:'Индивидуальный',B5:'Матовая',B6:300,B7:400,B8:3},576);
reject('1.3',{B4:'A6',B5:'Матовая'});reject('1.3',{B4:'Индивидуальный',B6:0});
expect('1.4',{B4:'A4',B5:'75 мкм',B6:1},60);
expect('1.4',{B4:'A4',B5:'100 мкм',B6:19},950);expect('1.4',{B4:'A4',B5:'100 мкм',B6:20},800);
for(const [format,rates] of [['A6',[15,20,25]],['A5',[25,30,40]],['A4',[40,50,60]],['A3',[70,90,110]]])
  for(const [i,thickness] of ['75 мкм','100 мкм','125 мкм'].entries())expect('1.4',{B4:format,B5:thickness,B6:25},rates[i]*25*.8);
for(const [n,rate] of [[10,170],[11,153],[25,153],[26,138]])expect('1.5',{B4:'Металл',B5:'A4',B7:'10 мм (до 80 л.)',B8:n},n*rate);
reject('1.5',{B4:'Металл',B7:'45–51 мм (до 500 л.)'});reject('1.5',{B6:'Проектная документация'});
expect('1.6',{B6:'двусторонняя'},1189);
for(const [n,hard,soft] of [[15,550,250],[60,550,250],[61,575,280],[120,575,280],[121,600,310],[190,600,310],[191,625,340],[260,625,340],[261,650,370],[300,650,370]]){
  expect('1.6',{B5:'ПЕЧАТЬ ВАША',B7:n,B13:0},hard);
  expect('1.6',{B4:'Мягкий',B5:'ПЕЧАТЬ ВАША',B7:n,B12:'Белый',B13:0},soft);
}
expect('1.6',{B5:'ПЕЧАТЬ ВАША',B7:50,B11:2,B13:3,B14:'Разжатие / повторное сжатие с заменой канала'},1510);
reject('1.6',{B5:'ПЕЧАТЬ ВАША',B7:14});reject('1.6',{B5:'ПЕЧАТЬ ВАША',B7:301});reject('1.6',{B4:'Мягкий',B12:'Красный'});
for(const [n,rate] of [[10,10],[11,8],[50,8],[51,7],[100,7],[101,6],[500,6],[501,5.5],[1000,5.5],[1001,5]])
  for(const [format,stitched,multiplier] of [['A4','НЕТ',1],['A4','ДА',2],['A3','НЕТ',2],['A3','ДА',4]])expect('1.7',{B5:format,B6:stitched,B7:n},n*rate*multiplier);
reject('1.7',{B4:'ЧЕРТЕЖ'});
for(const [n,rate] of [[50,5],[200,5],[201,4],[500,4],[501,3]])expect('1.8',{B7:n},rate*n);
reject('1.8',{B7:49});reject('1.8',{B6:'60×40 мм'});
expect('1.9',{B8:10,B7:'БЕЛАЯ'},1750);
expect('1.9',{B4:20,B5:4,B8:50,B7:'БЕЛАЯ'},7500);
reject('1.9',{B8:9});reject('1.9',{B4:25});reject('1.9',{B4:0,B5:0});
for(const [id,cell] of [['1.1','B7'],['1.2','B7'],['1.3','B8'],['1.4','B6'],['1.5','B8'],['1.6','B11'],['1.7','B7'],['1.8','B7'],['1.9','B8']])
  for(const value of [0,-1,1.5,'',null,Infinity,Number.MAX_SAFE_INTEGER+1,true,{}])reject(id,{[cell]:value});
expect('1.3',{B4:'Индивидуальный',B6:37.5,B7:50,B8:1},4.88);
// Changing dependencies must clear an incompatible selection instead of quoting it.
assert.equal(api.normalize('1.3',{B4:'A6',B5:'Матовая'}).B5,'Сатин');
assert.equal(api.normalize('1.6',{B4:'Мягкий',B12:'Красный'}).B12,'Белый');
assert.equal(api.normalize('1.5',{B4:'Металл',B7:'45–51 мм (до 500 л.)'}).B7,'6 мм (до 35 л.)');
assert.ok(!api.fields('1.3',api.defaults('1.3')).some(field=>field.cell==='B6'));
assert.ok(!api.fields('1.6',{B5:'ПЕЧАТЬ ВАША'}).some(field=>field.cell==='B8'));
console.log(`Passed ${checked} reference prices, tariff boundaries and invalid inputs across 9 services, plus dependent field checks.`);
