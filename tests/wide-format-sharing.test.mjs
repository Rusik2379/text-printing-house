import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const c={window:{},URL,URLSearchParams};vm.createContext(c);
for(const name of ['stickerpack-pricing','sticker-pricing','sticker-services','wide-format-services','wide-format-pricing','stickerpack-calculator','wide-format-calculator','wide-format-sharing'])vm.runInContext(await readFile(new URL('../'+name+'.js',import.meta.url),'utf8'),c);
const w=c.window,share=w.TEXT_WIDE_SHARING;
for(const s of Object.values(w.TEXT_WIDE_SERVICES)){
 for(const [print,mats] of Object.entries(s.materialsByPrint))for(const material of mats){
  const config={...s.defaults,print,material,quantity:17,width:s.kind==='area'?1234:500,height:s.kind==='area'?987:500,...(s.kind==='cut'?{complexity:'simple'}:{}),...(s.model==='pvc'?{thickness:'5'}:{})};
  const url=share.url(config,'https://example.test/project/',s.id);
  assert.ok(url.startsWith('https://example.test/project/'+s.path));
  assert.deepEqual(JSON.parse(JSON.stringify(share.read(new URL(url).searchParams,s.id))),config);
  const text=share.text(config,'https://example.test/project/',s.id);
  assert.ok(text.includes(url));assert.ok(text.includes(s.materials[material]));assert.ok(text.includes('17 шт -'));
  if(s.kind==='mount')assert.ok(text.includes(config.thickness+' мм'));
  if(s.kind==='cut')assert.ok(text.includes('Простая'));
 }
 const fallback=share.read(new URLSearchParams('width=NaN&height=-1&quantity=1.5&material=bad&print=bad'),s.id);
 assert.deepEqual(JSON.parse(JSON.stringify(fallback)),JSON.parse(JSON.stringify(s.defaults)));
 assert.equal(share.text({...s.defaults,width:0},'https://example.test/project/',s.id),null);
}
const mixed=w.TEXT_STICKER_CART_BREAKDOWN([{pricingGroup:'wide-poster',price:100},{pricingGroup:'wide-poster',price:200},{pricingGroup:'wide-cut',price:100},{pricingGroup:'wide-cut',price:100},{pricingGroup:'wide-pvc',price:650},{pricingGroup:'stickers',price:100},{pricingGroup:'stickers3d',price:100},{pricingGroup:'other',price:75}]);
assert.equal(mixed.total,3525);assert.equal(mixed.surcharge,2100);
assert.equal(mixed.surcharges['wide-poster'],300);assert.equal(mixed.surcharges['wide-cut'],400);
console.log('Nine service sharing round trips, option restoration, invalid URLs and mixed cart minimums passed.');
