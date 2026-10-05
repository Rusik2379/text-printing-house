import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const web=new URL('../',import.meta.url);
const context={window:{}};
vm.createContext(context);
for(const file of ['stickerpack-pricing.js','stickerpack-calculator.js']) {
  if(existsSync(new URL(file,web))) vm.runInContext(readFileSync(new URL(file,web),'utf8'),context);
}
const calculate=context.window.TEXT_CALCULATE_STICKERPACKS;
assert.equal(typeof calculate,'function','Калькулятор стикерпаков должен быть реализован');
const cases=JSON.parse(readFileSync(new URL('./stickerpack-cases.json',import.meta.url),'utf8'));
for(const c of cases) {
  const result=calculate(c.args);
  for(const field of ['unit','subtotal','total']) assert.equal(result[field],c[field],`${JSON.stringify(c.args)} ${field}`);
  assert.equal(result.days,Math.max(1,Math.ceil(c.total/10000)));
}
for(const args of [{width:0},{height:-1},{quantity:1.5},{quantity:Infinity},{print:'invalid'},{material:'invalid'},{print:'vinyl',material:'transparent'},{width:NaN}]) {
  assert.equal(calculate({width:100,height:150,quantity:50,print:'uv',material:'white',...args}),null);
}
assert.equal(calculate({width:100,height:150,quantity:0,print:'uv',material:'white'}).total,0);
const total=context.window.TEXT_STICKER_CART_TOTAL;
assert.equal(typeof total,'function');
assert.equal(total([{price:100,pricingGroup:'stickers'},{price:200,pricingGroup:'stickers'}]).total,600);
assert.equal(total([{price:100,pricingGroup:'stickers'},{price:800}]).total,1400);
assert.equal(total([{price:700,pricingGroup:'stickers'},{price:800,pricingGroup:'stickers'}]).total,1500);
assert.equal(total([{price:null}]).total,0);
console.log(`${cases.length} расчётов совпали с независимым расчётом по Excel; границы, ошибки и минимальный чек проверены.`);
