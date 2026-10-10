import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const root=new URL('../',import.meta.url),c={};c.window=c;vm.createContext(c);
for(const n of ['copycenter-pricing-data','copycenter-engine','copycenter-pricing','project-pricing-data','project-pricing','leaflet-pricing-data','leaflet-pricing','uv-pricing-data','uv-pricing','sticker-services','stickerpack-pricing','sticker-pricing','stickerpack-calculator','sticker-special-calculator','wide-format-services','wide-format-pricing','wide-format-calculator'])vm.runInContext(await readFile(new URL(n+'.js',root),'utf8'),c);
const reference=JSON.parse(await readFile(new URL('seo-content.json',root),'utf8')).service_search_terms;
const profiles=JSON.parse(await readFile(new URL('service-enrichment.json',root),'utf8')).services;
const cells={'1.1':'B7','1.3':'B8','1.4':'B6','1.5':'B8','1.6':'B11','1.7':'B7','1.8':'B7','1.9':'B8','2.2':'B8','2.4':'B7','2.7':'B7'};
// These are the configurations named in the visible reference examples.
const patches={'3.2':{B7:300},'4.5':{width:30,height:30},'4.7':{width:152,height:108,cut:'no'},'4.8':{width:50,height:50},'4.9':{width:50,height:50},'4.10':{width:50,height:50},'5.8':{width:210,height:297},'5.9':{width:600,height:1200}};
let count=0;
for(const [id,s] of Object.entries(reference)){
 const override=profiles[id].priceExample;
 const points=override?override.points.map(p=>({qty:p.quantity,total:p.total})):[s.points[0],s.points.at(-1)].filter(Boolean);
 for(const p of points){
  let q;const cfg=patches[id]||{};
  if(id.startsWith('1.'))q=c.TEXT_COPYCENTER_PRICING.quote(id,{...cfg,[cells[id]]:p.qty});
  else if(id==='2.1')q=c.TEXT_PROJECT_PRICING.quote(id,{rows:[{B:'A1',C:'Ч/Б',D:p.qty}]});
  else if(id.startsWith('2.'))q=c.TEXT_PROJECT_PRICING.quote(id,{...cfg,[cells[id]]:p.qty});
  else if(id.startsWith('3.'))q=c.TEXT_LEAFLET_PRICING.quote(id,{...cfg,[c.TEXT_LEAFLET_PRICING.quantityCell(id)]:p.qty});
  else if(id.startsWith('4.'))q=c.TEXT_QUOTE_STICKER_SERVICE(id,{...c.TEXT_STICKER_SERVICES[id].defaults,...cfg,...override?.configuration,quantity:p.qty});
  else if(id.startsWith('5.'))q=c.TEXT_QUOTE_WIDE_SERVICE(id,{...c.TEXT_WIDE_SERVICES[id].defaults,...cfg,quantity:p.qty});
  else if(id.startsWith('6.'))q=c.TEXT_UV_PRICING.quote(id,{...cfg,[c.TEXT_UV_PRICING.quantityCell(id)]:p.qty});
  const actual=q?.price??q?.total;
  assert.ok(Math.abs(actual-p.total)<.03,`${id}: GEO price ${p.total} disagrees with ${actual} at ${p.qty}`);count++;
 }
}
assert.ok(profiles['4.4'].priceExample,'Current stickerpack formula must replace the stale reference example');
const answer=profiles['4.4'].answers.find(a=>a.title==='Сколько стоит').text;
const html=await readFile(new URL(profiles['4.4'].path+'index.html',root),'utf8');
for(const p of profiles['4.4'].priceExample.points){const unit=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(p.unit);assert.ok(answer.includes(unit));assert.ok(html.includes(unit));}
console.log(`${count} GEO example prices across 51 services match the current calculators.`);
