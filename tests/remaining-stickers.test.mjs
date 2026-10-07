import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{},URL,URLSearchParams};vm.createContext(context);
for(const file of ['stickerpack-pricing','sticker-pricing','sticker-services','stickerpack-calculator','sticker-special-calculator','stickerpack-sharing'])vm.runInContext(await readFile(new URL('../'+file+'.js',import.meta.url),'utf8'),context);
const w=context.window;
const cases=JSON.parse(await readFile(new URL('./remaining-stickers-cases.json',import.meta.url),'utf8'));
for(const {kind,c,expected} of cases){
 const id={'paper':'4.7','uv-dtf':'4.6','3d-pack':'4.11'}[kind];
 const actual=w.TEXT_QUOTE_STICKER_SERVICE(id,c);
 if(!expected){assert.equal(actual,null,JSON.stringify(c));continue;}
 for(const [key,value] of Object.entries(expected))assert.ok(Math.abs(actual[key]-value)<.000001,`${kind} ${JSON.stringify(c)} ${key}: ${actual[key]} != ${value}`);
}
for(const id of ['4.5','4.6','4.7','4.11']){
 const s=w.TEXT_STICKER_SERVICES[id],c={...s.defaults};
 const url=w.TEXT_STICKERPACK_SHARING.url(c,'https://example.test/project/',id);
 assert.ok(url.startsWith('https://example.test/project/'+s.path));
 assert.deepEqual(JSON.parse(JSON.stringify(w.TEXT_STICKERPACK_SHARING.read(new URL(url).searchParams,id))),c);
 const text=w.TEXT_STICKERPACK_SHARING.text(c,'https://example.test/project/',id);assert.ok(text.includes(url));
 assert.equal(w.TEXT_QUOTE_STICKER_SERVICE(id,{...c,quantity:1.5}),null);
}
for(const shape of ['rectangle','round','figure'])assert.equal(w.TEXT_QUOTE_STICKER_SERVICE('4.6',{...w.TEXT_STICKER_SERVICES['4.6'].defaults,width:50,height:50,shape}).total,13807.3);
assert.equal(w.TEXT_QUOTE_STICKER_SERVICE('4.7',{...w.TEXT_STICKER_SERVICES['4.7'].defaults}).total,3264);
const cart=w.TEXT_STICKER_CART_BREAKDOWN([{pricingGroup:'stickers',price:200},{pricingGroup:'stickers',price:200},{pricingGroup:'stickers3d',price:200},{pricingGroup:'stickers3d',price:400},{pricingGroup:'uvdtf',price:100},{pricingGroup:'uvdtf',price:100},{pricingGroup:'paper',price:50}]);
assert.equal(cart.total,2550);assert.equal(cart.surcharge,1300);
console.log(`${cases.length} source-workbook cases, four sharing round trips, shape invariance, layout and mixed cart minimums passed.`);
