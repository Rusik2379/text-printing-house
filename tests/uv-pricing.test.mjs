import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const c={window:null};c.window=c;vm.createContext(c);
for(const file of ['copycenter-engine.js','uv-services.js','uv-pricing-data.js','uv-pricing.js'])vm.runInContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),c);
const p=c.TEXT_UV_PRICING,cases=JSON.parse(await readFile(new URL('uv-cases.json',import.meta.url),'utf8'));
for(const expected of cases){const actual=p.quote(expected.id,expected.configuration);assert.equal(actual.valid,true,expected.id+': '+actual.error);assert.ok(Math.abs(actual.total-expected.total)<.001,JSON.stringify({expected,actual}));assert.ok(Math.abs(actual.subtotal-expected.subtotal)<.001);}
for(const id of Object.keys(c.TEXT_UV_SERVICES)){
 const d=p.normalize(id,p.defaults(id)),s=c.TEXT_UV_SERVICES[id];assert.ok(p.quote(id,d).valid,id);
 for(const quantity of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(p.quote(id,{...d,[s.quantityCell]:quantity}).valid,false);
 for(const value of ['',0,-1,NaN,Infinity])assert.equal(p.quote(id,{...d,[s.widthCell]:value}).valid,false);
 assert.equal(p.quote(id,{...d,[p.fields(id,d)[0].cell]:'invalid'}).valid,false);
}
assert.equal(p.quote('6.1',{...p.defaults('6.1'),B9:101}).valid,false);
assert.equal(p.quote('6.1',{...p.defaults('6.1'),B4:'ПЭТ',B5:3}).valid,false);
assert.deepEqual(JSON.parse(JSON.stringify(p.fields('6.1',p.normalize('6.1',{B4:'ПЭТ'})).find(f=>f.cell==='B5').options)),[.5,1,1.5]);
assert.equal(p.quote('6.2',{...p.defaults('6.2'),B5:601,B6:601}).valid,false);
assert.equal(p.quote('6.3',{...p.defaults('6.3'),B6:900,B7:600}).valid,true);
assert.equal(p.quote('6.3',{...p.defaults('6.3'),B6:901,B7:601}).valid,false);
assert.equal(p.quote('6.4',{...p.defaults('6.4'),B8:101}).valid,false);
assert.equal(p.quote('6.8',{...p.defaults('6.8'),B4:'Пластик двуслойный',B5:1.5}).valid,false);
assert.equal(p.defaults('6.9').B12,'Без фурнитуры');assert.equal(p.quote('6.9',{...p.defaults('6.9'),B12:'Карабин'}).valid,false);
assert.equal(p.quote('6.6',{...p.defaults('6.6'),B7:'ГРАВИРОВКА',B13:'ОБЪЕМНЫЙ ЛАК'}).valid,false);
assert.equal(p.quote('missing',{}).valid,false);
console.log('UV pricing:',cases.length,'independent workbook cases and validation boundaries passed.');
