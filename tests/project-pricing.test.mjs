import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../project-pricing-data.js';
import '../copycenter-engine.js';
import '../project-pricing.js';
const api=globalThis.TEXT_PROJECT_PRICING;
const tariffs=JSON.parse(fs.readFileSync(new URL('./fixtures/project-tariffs.json',import.meta.url)));
let checks=0;
const equal=(id,config,expected)=>{const q=api.quote(id,config);assert.equal(q.valid,true,JSON.stringify(q));assert.equal(q.price,expected,JSON.stringify({id,config,q}));checks++;return q;};
const bad=(id,config)=>{assert.equal(api.quote(id,config).valid,false,JSON.stringify({id,config}));checks++;};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
// Rate table checks cover every supported engineering format and colour, including long sheets.
for(const [colour,format,,,first,,,,,,fold] of tariffs.engineering){
  for(const id of ['2.1','2.5']){
    equal(id,{rows:[{B:format,C:colour,D:1}]},first);
    equal(id,{rows:[{B:format,C:colour,D:1}],B4:'Под A4'},first+fold);
    equal(id,{rows:[{B:format,C:colour,D:1}],B4:'Под A3'},first+(['A4','A3'].includes(format)?0:fold));
  }
}
// Discount tier is selected using the initial print amount for the entire mixed order.
for(const n of [1,76,77,192,193,384,385,769,770,1538,1539]){
  const base=130*n,index=[10000,25000,50000,100000,200000,Infinity].findIndex(limit=>base<=limit);
  equal('2.1',{rows:[{B:'A1',C:'Ч/Б',D:n}]},n*[130,104,96,72,64,58][index]);
}
equal('2.1',{rows:[{B:'A1',C:'Ч/Б',D:5},{B:'A2',C:'Цвет',D:10}],B4:'Под A4'},1590);
const full=equal('2.1',{rows:[{B:'A1',C:'Ч/Б',D:20}],B4:'Под A4',B5:'Да',B6:'Пластик',B7:'A4',B8:'10–12 мм (до 80 л.)',B9:1},3264);
assert.equal(full.details.find(v=>v.label==='Заполнено строк').value,1);
bad('2.1',{B4:'Под A3',B5:'Да',B7:'A4'});
// Project binding must apply 1.15 to the correct tier, rounded per item before multiplying.
for(const [spring,format,diameter,...rates] of tariffs.binding)for(const n of [1,10,11,25,26]){
  equal('2.2',{B4:spring,B5:format,B6:'Проектная документация',B7:diameter,B8:n},round(round(rates[n<=10?0:n<=25?1:2]*1.15)*n));
}
bad('2.2',{B6:'Форматные документы'});
for(const [format,rate] of tariffs.fold)for(const n of [1,10])equal('2.3',{B4:format,B5:n},rate*n);
// Scan A4/A3, hand and automatic feeding: values from the original price table.
for(const [format,from,to,manual,auto] of tariffs.scan){
  for(const n of [from,to].filter(Number.isFinite))for(const [feed,rate] of [['ДА',manual],['НЕТ',auto]])equal('2.4',{B5:format,B6:feed,B7:n},rate*n);
}
bad('2.4',{B4:'ТЕКСТОВЫЙ'});bad('2.4',{B5:'A1'});
for(const [format,paper,bw,colour] of tariffs.design)for(const [color,rate] of [['Ч/Б',bw],['Цвет',colour]]){
  equal('2.6',{B4:'Нет',rows:[{B:format,C:paper,D:color,E:10}]},rate*10);
}
equal('2.6',{rows:[{B:'A3',C:'Стандартная (80 г/м²)',D:'Ч/Б',E:20},{B:'A3',C:'Color Copy 200 г/м²',D:'Цвет',E:10}]},1200);
// All rows are total sheets for the order; changing album count changes binding, not print quantity.
equal('2.6',{B4:'Нет',B8:2,rows:[{B:'A4',C:'Стандартная (80 г/м²)',D:'Цвет',E:10}]},150);
equal('2.7',{},361);equal('2.7',{B4:600,B5:1000,B7:2},344);
for(const [colour,...rates] of tariffs.patterns)for(const n of [1,27,28,69,70,138,139,277,278,553,554]){
  const area=1.2615,initial=Math.round(area*rates[0])*n,index=[10000,25000,50000,100000,200000,Infinity].findIndex(limit=>initial<=limit);
  equal('2.7',{B4:841,B5:1500,B6:colour,B7:n},Math.round(area*rates[index])*n);
}
for(const [cell,value] of [['B4',842],['B5',18001],['B4',0],['B5',-1],['B7',1.5],['B7',''],['B4',Infinity]])bad('2.7',{[cell]:value});
for(const id of ['2.1','2.5','2.6']){
  const v=api.defaults(id),col=id==='2.6'?'E':'D';
  for(const value of [0,-1,1.5,'',null,Infinity])bad(id,{rows:[{...v.rows[0],[col]:value}]});
  bad(id,{rows:[]});bad(id,{rows:'bad'});bad(id,{rows:[{...v.rows[0],B:'A100'}]});
  const max=id==='2.6'?5:20;
  assert.equal(api.quote(id,{...v,rows:Array.from({length:max},()=>({...v.rows[0]}))}).valid,true);
  bad(id,{rows:Array.from({length:max+1},()=>({...v.rows[0]}))});
  const q=api.quote(id,v),linked=api.quote(id,api.normalize(id,JSON.parse(JSON.stringify(q.configuration))));
  assert.equal(linked.price,q.price);checks++;
}
for(const id of Object.keys(TEXT_PROJECT_DATA)){
  assert.equal(api.quote(id).valid,true,id);
  assert.equal(api.normalize(id,{unexpected:'drop'}).unexpected,undefined);
}
console.log(`Project pricing: ${checks} checks passed against original Excel tariff tables, thresholds, mixed rows and technical limits.`);
