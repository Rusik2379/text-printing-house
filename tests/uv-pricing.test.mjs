import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={};vm.createContext(context);
for(const name of ['uv-pricing-data','copycenter-engine','uv-pricing'])vm.runInContext(await readFile(new URL('../'+name+'.js',import.meta.url),'utf8'),context);
const api=context.TEXT_UV_PRICING;
// Independent arithmetic against the fixed customer tariff tables, not the formula interpreter.
const round=x=>Math.round((x+1e-8)*100)/100;
function lerp(points,n,extrapolate=false){
  if(n<=points[0][0]&&!extrapolate)return points[0][1];
  for(let i=1;i<points.length;i++)if(n<=points[i][0]){
    const [x,y]=points[i-1],[xx,yy]=points[i];return y+(yy-y)*(n-x)/(xx-x);
  }
  return points.at(-1)[1];
}
let checks=0;
function expect(id,c,value){
  const q=api.quote(id,c);assert.ok(q.valid,id+': '+q.error+' '+JSON.stringify(c));
  assert.equal(q.price,round(value),id+': '+JSON.stringify(c));
  assert.equal(q.days,Math.max(1,Math.ceil(value/7000)));checks++;
}
function reject(id,c){assert.equal(api.quote(id,c).valid,false,id+': '+JSON.stringify(c));checks++;}
const uvMaterials={'ПВХ':{3:1,5:1.3},'Оргстекло':{3:1.1,5:1.42},'Пенокартон':{5:.98},'ПЭТ':{.5:.72,1:.91,1.5:1.1},'АКП':{3:1.1}};
const uvQuantities=[[1,1.35],[2,1.25],[3,1.18],[4,1.14],[5,1.1],[10,1],[15,.96],[20,.93],[30,.89],[40,.86],[50,.84],[100,.78]];
for(const id of ['6.1','6.5'])for(const [material,thicknesses] of Object.entries(uvMaterials))for(const [thick,coef] of Object.entries(thicknesses))for(const n of [1,7,25,101])for(const white of ['Нет','Да']){
  const w=n===1?50:n===7?200:400,h=n===1?50:n===7?200:600;
  expect(id,{B4:material,B5:Number(thick),B7:w,B8:h,B9:n,B10:white},Math.max(800,lerp([[.04,282],[.25,1341.6],[1,4332]],w*h/1e6,true)*lerp(uvQuantities,n)*coef*(white==='Да'?1.3:1)*n));
}
const plotter={
 'БЕЛАЯ':[[1005,866,819,795,777,730,704,665,602],[2000,1853,1787,1773,1710,1595,1511,1386,1209],[3692,3474,3353,3261,3181,2878,2660,2410,2087]],
 'ЦВЕТНАЯ':[[1125,986,936,915,897,850,823,785,722],[2286,2139,2072,2029,1996,1881,1797,1671,1495],[4262,4044,3923,3831,3752,3448,3230,2980,2657]],
 'МЕТАЛЛИЗИРОВАННАЯ':[[1118,979,932,908,889,843,816,778,715],[2269,2122,2055,2012,1979,1863,1779,1654,1477],[4227,4009,3888,3796,3716,3413,3195,2945,2622]]
};
const plotQty=[1,2,3,4,5,10,15,25,50],plotArea=[250000,600000,1200000];
for(const [film,rows] of Object.entries(plotter))for(const [w,h] of [[200,200],[500,500],[600,750],[2000,600]])for(const n of [1,7,25,51])for(const complexity of ['ПРОСТАЯ','СЛОЖНАЯ']){
  const points=rows.map((row,i)=>[plotArea[i],lerp(row.map((x,j)=>[plotQty[j],x]),n)]);
  expect('6.2',{B4:film,B5:w,B6:h,B7:n,B9:complexity},Math.max(600,lerp(points,w*h,true)*(complexity==='ПРОСТАЯ'?.9:1)*n));
}
const cutRates={'Фанера':{3:30,4:35,6:50,8:70,10:100},'МДФ':{3:30,4:35,6:50,8:65},'Акрил / оргстекло':{2:35,3:45,4:55,5:65,6:80,8:120,10:160},'Картон':{1:20,2:20,3:25},'Пластик двухслойный лазерный':{1.5:40}};
const cutCoef=[[1,1],[10,.95],[50,.85],[100,.78],[500,.68],[1000,.62]];
for(const [material,thicknesses] of Object.entries(cutRates))for(const [thick,rate] of Object.entries(thicknesses))for(const n of [1,37,500])for(const complexity of ['ПРОСТАЯ','СЛОЖНАЯ']){
  const meters=2*(400+300)/1000*n;
  expect('6.3',{B4:material,B5:Number(thick),B6:400,B7:300,B9:n,B10:complexity},Math.max(800,meters*rate*lerp(cutCoef,meters)*(complexity==='СЛОЖНАЯ'?1.25:1)));
}
const engraving={'Фанера / дерево':[4,15],'МДФ':[4,15],'Акрил / оргстекло':[4.5,20],'Пластик двухслойный лазерный':[3.5,20]};
const engravingCoef=[[10,1],[100,.95],[500,.85],[1000,.78],[5000,.7]];
for(const [material,[areaRate,contourRate]] of Object.entries(engraving))for(const n of [1,17,100])for(const density of ['СТАНДАРТНАЯ','ПЛОТНАЯ'])for(const fill of [10,37.5,100]){
  const area=200*100/100*fill/100,k=density==='ПЛОТНАЯ'?1.3:1;
  expect('6.4',{B4:material,B6:200,B7:100,B8:fill,B10:n,B11:density},Math.max(800,area*areaRate*k*lerp(engravingCoef,area*n)*n));
  expect('6.4',{B4:material,B5:'КОНТУРНАЯ',B6:200,B7:100,B8:fill,B10:n,B11:density},Math.max(800,.6*contourRate*k*n));
}
const tagArea=[[4,.75],[10,.85],[20,1],[30,1.12],[50,1.32],[70,1.5],[100,1.75],[144,2.05]];
const tagQty=[[1,2.1],[5,1.7],[10,1.45],[25,1.18],[50,1],[100,.88],[300,.76],[500,.7],[1000,.6]];
const tagMat={'Акрил прозрачный':1,'Акрил белый':1.12,'Акрил цветной':1.16,'Акрил зеркальный':1.21,'Фанера':1,'Пластик двухслойный':1};
const tagApplications={'УФ-ПЕЧАТЬ 1 СТОРОНА':1,'УФ-ПЕЧАТЬ 2 СТОРОНЫ':1.25,'ГРАВИРОВКА 1 СТОРОНА':1,'ГРАВИРОВКА 2 СТОРОНЫ':1.28,'УФ 1 СТОРОНА + ГРАВИРОВКА ОБОРОТ':1.45};
const accessories={'Кольцо с цепочкой':10,'Карабин':15,'Шнурок':5,'Усиленная фурнитура':25,'Без фурнитуры':0};
for(const id of ['6.6','6.9'])for(const [material,coef] of Object.entries(tagMat)){
  const fields=api.fields(id,{B5:material}),thicknesses=fields.find(f=>f.cell==='B6').options,applications=fields.find(f=>f.cell==='B7').options;
  for(const thick of thicknesses)for(const app of applications)for(const n of [1,37,500]){
    const furniture=id==='6.9'?'Без фурнитуры':Object.keys(accessories)[n===1?0:n===37?1:3];
    const uv=app.includes('УФ'),effect=uv?'ВЫБОРОЧНЫЙ ЛАК':'БЕЗ ЛАКА';
    const thicknessCoef=material==='Акрил прозрачный'?{2:.95,3:1,5:1.2}[thick]:material==='Фанера'?{3:1,4:1.07,6:1.22}[thick]:1;
    const base=material==='Фанера'?(uv?105:90):material==='Пластик двухслойный'?110:uv?110:95;
    const unit=base*lerp(tagArea,40*50/100)*lerp(tagQty,n)*coef*thicknessCoef*tagApplications[app]*1.05*(uv?1.12:1)+accessories[furniture];
    expect(id,{B5:material,B6:Number(thick),B7:app,B8:40,B9:50,B10:n,B11:'ФИГУРНАЯ',B12:furniture,B13:effect},Math.max(1000,unit*n));
  }
}
const plates={'Алюминий':{.5:2.3,.8:2.6,1:3.1},'Нержавейка AISI':{.5:2.8,.8:3.2,1:3.6},'Пластик двуслойный':{1.5:3.3}};
for(const id of ['6.7','6.8'])for(const [material,thicknesses] of Object.entries(plates)){
  if(id==='6.8'&&material==='Пластик двуслойный')continue;
  for(const [thick,coef] of Object.entries(thicknesses))for(const n of [1,26,100])expect(id,{B4:material,B5:Number(thick),B6:90,B7:110,B8:n},Math.max(1000,99*coef*n));
}
for(const id of Object.keys(context.TEXT_UV_DATA)){
  const quantity=api.quantityCell(id);
  for(const x of [0,-1,1.5,'',null,{},Infinity,Number.MAX_SAFE_INTEGER+1])reject(id,{[quantity]:x});
  const n=api.normalize(id,{ZZ99:'untrusted'});assert.equal(n.ZZ99,undefined);
  assert.ok(api.quote(id,n).valid);
}
for(const id of ['6.1','6.5'])for(const c of [{B7:49},{B7:401},{B8:601},{B4:'ПВХ',B5:4},{B6:'Лазер'}])reject(id,c);
for(const c of [{B5:199},{B6:199},{B5:601,B6:601},{B5:2001},{B4:'bad'},{B8:'Нет'}])reject('6.2',c);
for(const id of ['6.3','6.4']){
  assert.ok(api.quote(id,id==='6.3'?{B6:600,B7:900}:{B6:600,B7:900}).valid);
  reject(id,{B6:601,B7:900});reject(id,{B6:901,B7:600});reject(id,{B4:'ПВХ'});
}
for(const c of [{B8:9},{B8:101}])reject('6.4',c);
assert.equal(api.fields('6.4',{B5:'КОНТУРНАЯ'}).some(f=>f.cell==='B8'),false);
for(const id of ['6.6','6.9']){
  for(const c of [{B8:19},{B9:121},{B5:'Акрил зеркальный',B7:'УФ-ПЕЧАТЬ 1 СТОРОНА'},{B5:'Фанера',B6:5},{B7:'ГРАВИРОВКА 1 СТОРОНА',B13:'ВЫБОРОЧНЫЙ ЛАК'}])reject(id,c);
  const normalized=api.normalize(id,{B5:'Акрил зеркальный',B6:5,B7:'УФ-ПЕЧАТЬ 1 СТОРОНА',B13:'ОБЪЕМНЫЙ ЛАК'});
  assert.equal(normalized.B6,'3');assert.equal(normalized.B7,'ГРАВИРОВКА 1 СТОРОНА');assert.equal(normalized.B13,'БЕЗ ЛАКА');
}
reject('6.9',{B12:'Шнурок'});assert.equal(api.defaults('6.9').B12,'Без фурнитуры');
reject('6.8',{B4:'Пластик двуслойный',B5:1.5});
for(const id of ['6.7','6.8']){assert.ok(api.quote(id,{B6:400,B7:600}).valid);reject(id,{B6:401,B7:600});}
console.log(`UV pricing: ${checks} independent tariff and validation checks passed.`);
