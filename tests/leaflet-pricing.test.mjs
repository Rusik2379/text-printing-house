import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={};vm.createContext(context);
for(const name of ['leaflet-pricing-data','copycenter-engine','leaflet-pricing'])vm.runInContext(await readFile(new URL('../'+name+'.js',import.meta.url),'utf8'),context);
const api=context.TEXT_LEAFLET_PRICING;
const source=JSON.parse(await readFile(new URL('./fixtures/leaflet-tariffs.json',import.meta.url),'utf8'));
// Positive decimal money rounds half upward, including source values such as 4.725.
const round=(x,n=2)=>Math.round((x+1e-10)*10**n)/10**n;
function interpolate(points,n){
  if(n<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++)if(n<=points[i][0]){
    const [x0,y0]=points[i-1],[x1,y1]=points[i];return y0+(y1-y0)*(n-x0)/(x1-x0);
  }
  return points.at(-1)[1];
}
const imposed=(w,h)=>Math.max(Math.floor(297/w)*Math.floor(422/h),Math.floor(297/h)*Math.floor(422/w));
function flatPrice(format,paper,n,two=false,lamination=0,w=100,h=100){
  const fit={A6:8,A5:4,A4:2,A3:1}[format]||imposed(w,h),sheets=Math.ceil(n/fit);
  const base=format==='custom'?interpolate(source.flatPoints.A3,sheets)/fit:interpolate(source.flatPoints[format],n);
  const unit=round((round(base,4)+(source.paperCosts[paper]-8.808)/fit)*(two?1.35:1));
  return round(round((unit*n+sheets*40*lamination)/n)*n);
}
let checks=0;
function expect(id,c,price){
  const q=api.quote(id,c);assert.ok(q.valid,id+': '+q.error+' '+JSON.stringify(c));
  assert.equal(q.price,price,id+': '+JSON.stringify(c));assert.equal(q.days,Math.max(1,Math.ceil(price/15000)));checks++;
}
function reject(id,c){assert.equal(api.quote(id,c).valid,false,id+': '+JSON.stringify(c));checks++;}
// Constant source tables, independent of the workbook evaluator.
for(const [paper,n,one,two] of source.businessCards)for(const lam of [false,true])for(const corners of [false,true]){
  expect('3.1',{B4:paper,B5:'односторонние',B6:n,B7:lam?'да':'нет',B8:corners?'да':'нет'},round(round(one*(lam?1.35:1)*(corners?1.2:1))*n));
  expect('3.1',{B4:paper,B5:'двусторонние',B6:n,B7:lam?'да':'нет',B8:corners?'да':'нет'},round(round(two*(lam?1.35:1)*(corners?1.2:1))*n));
}
for(const id of ['3.2','3.6','3.7','3.8','3.9']){
  const formats=id==='3.2'?['A6','A5','A4','A3']:id==='3.6'?['A6','A5']:['A4','A3'];
  const papers=api.fields(id).find(f=>f.cell==='B7').options;
  for(const format of formats){
    const min={A6:50,A5:25,A4:5,A3:1}[format];
    const amounts=[...new Set([min,min+1,...source.flatPoints[format].flatMap(([n])=>[n,n+1]),1200])].filter(n=>n>=min);
    for(const [i,n] of amounts.entries())for(const paper of papers){
      const two=i%2===0,lam=i%3,uppercase=id!=='3.2';
      expect(id,{B4:format,B7:paper,B8:uppercase?(two?'ДВУСТОРОННЯЯ':'ОДНОСТОРОННЯЯ'):(two?'Двусторонняя':'Односторонняя'),B9:uppercase?['БЕЗ ЛАМИНАЦИИ','1 СТОРОНА','2 СТОРОНЫ'][lam]:['Без ламинации','1 сторона','2 стороны'][lam],B10:n},flatPrice(format,paper,n,two,lam));
    }
    reject(id,{B4:format,B10:min-1});
  }
  for(const [w,h] of [[37.5,80],[90,50],[50,90],[297,422],[422,297]]){
    const fmt=id==='3.2'?'Индивидуальный':'ИНДИВИДУАЛЬНЫЙ';
    expect(id,{B4:fmt,B5:w,B6:h,B7:300,B8:id==='3.2'?'Двусторонняя':'ДВУСТОРОННЯЯ',B9:id==='3.2'?'2 стороны':'2 СТОРОНЫ',B10:73},flatPrice('custom',300,73,true,2,w,h));
  }
  for(const [w,h] of [[0,100],[298,423],[423,298],[300,300]])reject(id,{B4:id==='3.2'?'Индивидуальный':'ИНДИВИДУАЛЬНЫЙ',B5:w,B6:h});
}
for(const [key,points] of Object.entries(source.bookletPoints)){
  const [format,paper]=key.split('/');
  for(const n of [5,10,11,25,37,50,99,100,150,151,500,501]){
    // The supplied booklet workbook extrapolates its first interval for A4 5–9.
    // Preserve the supplied prices rather than substituting a different calculator.
    const below=n<points[0][0],[[x0,y0],[x1,y1]]=points;
    const unit=below?y0+(y1-y0)*(n-x0)/(x1-x0):interpolate(points,n);
    for(const fold of [1,2,3])expect('3.3',{B4:format,B5:paper,B7:fold,B8:n},round((round(unit)+fold*5)*n));
  }
}
for(const id of ['3.4','3.5'])for(const format of ['A4','A5'])for(const cover of [200,250,300,350])for(const inside of [120,160,200]){
  const printFormat=format==='A4'?'A3':'A4';
  for(const [pages,n] of [[4,5],[8,10],[16,37],[20,100],[40,501]]){
    const block=(pages/4-1)*n;
    const coverPrice=round(round(interpolate(source.catalogPoints[printFormat+'/'+cover],n))*n);
    const blockPrice=block?round(round(interpolate(source.catalogPoints[printFormat+'/'+inside],block))*block):0;
    expect(id,{B4:format,B5:cover,B6:inside,B7:pages,B8:n},round(coverPrice+blockPrice+pages/4*n*5+n*50+500));
  }
}
for(const [w,h] of [[30,30],[40,40],[50,90],[105,148],[148,105]])for(const paper of [200,300])for(const n of [1,50,199,500,1000]){
  const fit=imposed(w,h),sheets=Math.ceil(n/fit),base=round(interpolate(source.flatPoints.A3,sheets)/fit,4);
  const unit=round(round((base+(source.paperCosts[paper]-8.808)/fit)*1.35)*1.25);
  expect('3.10',{B5:w,B6:h,B7:paper,B8:'ДВУСТОРОННЯЯ',B9:n},Math.max(1000,round(unit*n)));
}
reject('3.1',{B6:150});reject('3.1',{B6:1100});reject('3.2',{B7:200});reject('3.2',{B7:350});
reject('3.3',{B4:'A4',B8:4});reject('3.3',{B7:4});reject('3.3',{B6:'ОДНОСТОРОННЯЯ'});
for(const id of ['3.4','3.5'])for(const pages of [0,3,5,15])reject(id,{B7:pages});
for(const id of ['3.4','3.5'])reject(id,{B4:'A5',B8:4});
for(const [w,h] of [[29,40],[40,29],[106,149],[149,106],[110,110]])reject('3.10',{B5:w,B6:h});
for(const id of Object.keys(context.TEXT_LEAFLET_DATA))for(const n of [0,-1,1.5,'',null,Infinity,true,{},Number.MAX_SAFE_INTEGER+1])reject(id,{[api.quantityCell(id)]:n});
assert.ok(!api.fields('3.2').some(f=>f.cell==='B5'));
assert.ok(api.fields('3.2',{B4:'Индивидуальный'}).some(f=>f.cell==='B5'));
assert.equal(api.normalize('3.2',{B7:200}).B7,'120');
console.log(`Sheet printing pricing: ${checks} independent tariff, interpolation, imposition, rounding, finishing and input checks passed.`);
