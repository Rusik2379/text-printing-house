import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{},URL,URLSearchParams};vm.createContext(context);
for(const f of ['stickerpack-pricing.js','sticker-pricing.js','sticker-services.js','stickerpack-calculator.js','stickerpack-sharing.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),context);
const {TEXT_STICKER_SERVICES:services,TEXT_STICKERPACK_SHARING:sharing}=context.window;
for(const s of Object.values(services)){
  const c={...s.defaults,quantity:780};
  const url=new URL(sharing.url(c,'https://example.org/text-printing-house/',s.id));
  assert.equal(url.pathname,'/text-printing-house/'+s.path,'Each service must share its own page');
  assert.equal(url.hash,'#calculator');assert.equal(url.searchParams.get('quantity'),'780');
  assert.deepEqual(JSON.parse(JSON.stringify(sharing.read(url.searchParams,s.id))),c);
  const text=sharing.text(c,'https://example.org/text-printing-house/',s.id);
  assert.ok(text.includes('780 шт - '));assert.ok(text.endsWith(url.href));
  assert.ok(text.includes('Материал: Белая плёнка'));
}
assert.equal(sharing.read(new URLSearchParams('width=45&height=90'),'4.2').height,45,'Circle uses a diameter');
assert.equal(sharing.read(new URLSearchParams('print=vinyl&material=holographic'),'4.8').print,'uv');
assert.equal(sharing.read(new URLSearchParams('material=holographic'),'4.9').material,'white');
assert.equal(sharing.read(new URLSearchParams('print=vinyl&material=transparent'),'4.1').material,'white');
assert.equal(sharing.text({...services['4.1'].defaults,width:0},'https://example.org/','4.1'),null);
console.log('Seven service URLs, GitHub Pages prefix, shared quote text, defaults, diameter and material constraints verified.');
