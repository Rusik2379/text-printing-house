import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const ctx={window:{},URL,URLSearchParams};vm.createContext(ctx);
for(const name of ['wide-format-services','wide-format-pricing','wide-format-calculator'])vm.runInContext(await readFile(new URL('../'+name+'.js',import.meta.url),'utf8'),ctx);
const w=ctx.window,cases=JSON.parse(await readFile(new URL('./wide-format-cases.json',import.meta.url),'utf8'));
for(const {id,c,expected} of cases){
 const actual=w.TEXT_QUOTE_WIDE_SERVICE(id,c);
 if(!expected){assert.equal(actual,null,id+' '+JSON.stringify(c));continue;}
 assert.ok(actual,id+' '+JSON.stringify(c));
 for(const [key,value] of Object.entries(expected))assert.ok(Math.abs(actual[key]-value)<.000001,`${id} ${JSON.stringify(c)} ${key}: ${actual[key]} != ${value}`);
}
for(const s of Object.values(w.TEXT_WIDE_SERVICES)){
 for(const patch of [{quantity:0},{quantity:1.5},{quantity:Infinity},{width:0},{height:NaN},{material:'missing'},{print:'missing'}])assert.equal(w.TEXT_QUOTE_WIDE_SERVICE(s.id,{...s.defaults,...patch}),null);
 if(s.kind==='cut')assert.equal(w.TEXT_QUOTE_WIDE_SERVICE(s.id,{...s.defaults,complexity:'missing'}),null);
 if(s.kind==='mount')assert.equal(w.TEXT_QUOTE_WIDE_SERVICE(s.id,{...s.defaults,thickness:'4'}),null);
}
assert.equal(w.TEXT_QUOTE_WIDE_SERVICE('5.5',{...w.TEXT_WIDE_SERVICES['5.5'].defaults,material:'clearMatte'}),null);
assert.equal(w.TEXT_QUOTE_WIDE_SERVICE('5.1',{...w.TEXT_WIDE_SERVICES['5.1'].defaults}).total,1445);
assert.equal(w.TEXT_QUOTE_WIDE_SERVICE('5.8',{...w.TEXT_WIDE_SERVICES['5.8'].defaults}).total,1026.33);
assert.equal(w.TEXT_QUOTE_WIDE_SERVICE('5.9',{...w.TEXT_WIDE_SERVICES['5.9'].defaults}).total,44029);
console.log(`${cases.length} wide-format source cases and invalid-input checks passed.`);
