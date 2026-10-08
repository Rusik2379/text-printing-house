import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const c={window:null,URL,URLSearchParams,Intl};c.window=c;vm.createContext(c);
for(const name of ['copycenter-engine','uv-services','uv-pricing-data','uv-pricing','uv-sharing','stickerpack-pricing','sticker-pricing','wide-format-pricing','stickerpack-calculator'])vm.runInContext(await readFile(new URL('../'+name+'.js',import.meta.url),'utf8'),c);
const origin='https://example.com/text-printing-house/';
for(const id of Object.keys(c.TEXT_UV_SERVICES)){
 const conf=c.TEXT_UV_PRICING.normalize(id,c.TEXT_UV_PRICING.defaults(id)),url=c.TEXT_UV_SHARING.url(conf,origin,id),read=c.TEXT_UV_SHARING.read(new URL(url).searchParams,id);
 assert.deepEqual(JSON.parse(JSON.stringify(read)),JSON.parse(JSON.stringify(conf)));assert.ok(url.startsWith(origin));assert.ok(c.TEXT_UV_SHARING.text(conf,origin,id).includes(url));
 const broken=c.TEXT_UV_SHARING.read(new URLSearchParams('B4=bad&B5=bad&B6=-1&B7=Infinity'),id);assert.ok(c.TEXT_UV_PRICING.quote(id,broken).valid);
}
const result=c.TEXT_STICKER_CART_BREAKDOWN([{price:100,pricingGroup:'uv-direct'},{price:200,pricingGroup:'uv-direct'},{price:100,pricingGroup:'wide-cut'},{price:100,pricingGroup:'wide-cut'},{price:100,pricingGroup:'uv-keychains'}]);
assert.equal(result.total,2400);assert.equal(result.surcharges['uv-direct'],500);assert.equal(result.surcharges['wide-cut'],400);assert.equal(result.surcharges['uv-keychains'],900);
const tiny=c.TEXT_UV_PRICING.quote('6.4',{...c.TEXT_UV_PRICING.defaults('6.4'),B6:1,B7:1,B8:1,B10:1});
assert.equal(tiny.valid,true);assert.equal(tiny.subtotal,0);assert.equal(tiny.total,800);
assert.equal(c.TEXT_STICKER_CART_BREAKDOWN([{price:tiny.subtotal,pricingGroup:'uv-engraving'}]).total,tiny.total,'A zero-rounded valid quote must retain the workbook minimum');
assert.equal(c.TEXT_STICKER_CART_BREAKDOWN([{price:null,pricingGroup:'uv-engraving'}]).total,0,'Unpriced requests must not acquire minimums');
assert.equal(c.TEXT_STICKER_CART_BREAKDOWN([]).total,0);
assert.equal(c.TEXT_STICKER_CART_BREAKDOWN([{price:0}]).total,0,'Ungrouped free items do not acquire a minimum');
assert.equal(c.TEXT_STICKER_CART_BREAKDOWN([{price:0,pricingGroup:'uv-engraving'},{price:0,pricingGroup:'uv-engraving'}]).total,800,'Minimum applies once across zero-rounded rows');
const copy=await readFile(new URL('../uv-content.json',import.meta.url),'utf8');
assert.ok(!/на этой странице|Страница ориентирована|не обещаем|не обещается|предложение страницы|Эта страница/.test(copy),'Editorial instructions must be adapted into customer-facing copy');
console.log('UV sharing: nine round trips, invalid URL recovery and shared workbook cart minimums passed.');
