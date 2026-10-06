import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['stickerpack-pricing.js','sticker-pricing.js','stickerpack-calculator.js']){
  const path=new URL('../'+file,import.meta.url);if(existsSync(path))vm.runInContext(readFileSync(path,'utf8'),ctx);
}
const calculate=ctx.window.TEXT_CALCULATE_STICKERS;
assert.equal(typeof calculate,'function','A shared calculator must support flat, pack and 3D products');
const cases=JSON.parse(readFileSync(new URL('./sticker-cases.json',import.meta.url),'utf8'));
for(const c of cases){const actual=calculate(c.args);assert.ok(actual,JSON.stringify(c.args));for(const key of ['unit','subtotal','total'])assert.ok(Math.abs(actual[key]-c[key])<0.000001,JSON.stringify({args:c.args,key,actual:actual[key],expected:c[key]}));}
assert.equal(calculate({...cases[1].args,kind:'invalid'}),null);
assert.equal(calculate({...cases[1].args,kind:'3d',material:'holographic'}),null);
assert.equal(calculate({...cases[1].args,kind:'flat',print:'vinyl',material:'transparent'}),null);
assert.equal(calculate({...cases[1].args,quantity:1.5}),null);
const totals=ctx.window.TEXT_STICKER_CART_TOTAL([{pricingGroup:'stickers',price:200},{pricingGroup:'stickers',price:300},{pricingGroup:'stickers3d',price:400},{pricingGroup:'stickers3d',price:500},{price:50}]);
assert.equal(totals.total,1650);assert.equal(totals.surcharge,200);
const breakdown=ctx.window.TEXT_STICKER_CART_BREAKDOWN([{pricingGroup:'stickers',price:300},{pricingGroup:'stickers3d',price:500}]);
assert.equal(breakdown.surcharges.stickers,300);assert.equal(breakdown.surcharges.stickers3d,500);
console.log(cases.length+' flat / pack / 3D calculations match independent Excel arithmetic; two cart minimum groups verified.');
