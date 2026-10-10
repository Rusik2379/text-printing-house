/* Original customer workbook formulas, with the current service restrictions. */
(() => {
  'use strict';
  const data=globalThis.TEXT_UV_DATA,Engine=globalThis.TEXT_COPYCENTER_ENGINE;
  const quantities={'6.1':'B9','6.2':'B7','6.3':'B9','6.4':'B10','6.5':'B9','6.6':'B10','6.7':'B8','6.8':'B8','6.9':'B10'};
  const dimensions={'6.1':['B7','B8'],'6.2':['B5','B6'],'6.3':['B6','B7'],'6.4':['B6','B7'],'6.5':['B7','B8'],'6.6':['B8','B9'],'6.7':['B6','B7'],'6.8':['B6','B7'],'6.9':['B8','B9']};
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function defaults(id){
    const v=Object.fromEntries(data[id].schema.fields.map(f=>[f.cell,f.value]));
    if(id==='6.9')v.B12='Без фурнитуры';
    return v;
  }
  function engine(id,v){
    const {schema,book}=data[id];
    return new Engine(book,Object.fromEntries(schema.fields.map(f=>[schema.sheet+'!'+f.cell,v[f.cell]])));
  }
  function options(id,f,v){
    if(['6.1','6.5'].includes(id)&&f.cell==='B6')return ['УФ'];
    if(id==='6.9'&&f.cell==='B12')return ['Без фурнитуры'];
    if(['6.6','6.9'].includes(id)&&f.cell==='B13'&&!String(v.B7).includes('УФ'))return ['БЕЗ ЛАКА'];
    if(f.validation?.type!=='list')return null;
    const formula=f.validation.f1;
    const result=formula.startsWith('"')?formula.slice(1,-1).split(','):engine(id,v).formula(formula,data[id].schema.sheet);
    let choices=[result].flat(Infinity).filter(x=>x!==null&&x!=='').map(String);
    if(id==='6.8'&&f.cell==='B4')choices=choices.filter(x=>x!=='Пластик двуслойный');
    return choices;
  }
  function normalize(id,configuration={}){
    const allowed=new Set(data[id].schema.fields.map(f=>f.cell));
    const v={...defaults(id),...Object.fromEntries(Object.entries(configuration).filter(([cell])=>allowed.has(cell)))};
    for(const f of data[id].schema.fields){const choices=options(id,f,v);if(choices&&!choices.includes(String(v[f.cell])))v[f.cell]=choices[0];}
    if(id==='6.4'&&v.B5==='КОНТУРНАЯ')v.B8=20;
    return v;
  }
  function fields(id,configuration={}){
    const v={...defaults(id),...configuration};
    return data[id].schema.fields.filter(f=>!(id==='6.4'&&f.cell==='B8'&&v.B5==='КОНТУРНАЯ')).map(f=>{
      const choices=options(id,f,v),size=dimensions[id].includes(f.cell),fill=id==='6.4'&&f.cell==='B8';
      const validation=f.validation;
      return {...f,options:choices,locked:choices?.length===1,
        min:fill?10:validation?.type!=='list'&&validation?.f1?Number(validation.f1):1,
        max:fill?100:validation?.type!=='list'&&validation?.f2?Number(validation.f2):undefined,
        positive:size,step:size||fill?'any':1};
    });
  }
  function quote(id,configuration={}){
    if(!data[id])return {valid:false,error:'Неизвестная услуга.'};
    const v={...defaults(id),...configuration};
    if(id==='6.4'&&v.B5==='КОНТУРНАЯ')v.B8=20;
    try{
      for(const f of fields(id,v)){
        const x=v[f.cell];
        if(f.options){
          if(!f.options.includes(String(x)))return {valid:false,error:'Выберите допустимый вариант: '+f.label+'.',cell:f.cell};
          if(typeof f.value==='number')v[f.cell]=Number(x);
        }else{
          if(!['number','string'].includes(typeof x)||String(x).trim()===''||!Number.isFinite(Number(x))||Number(x)<f.min||(f.max!==undefined&&Number(x)>f.max)||(f.positive&&Number(x)<=0)||(f.step===1&&!Number.isSafeInteger(Number(x))))
            return {valid:false,error:f.label+': укажите '+(f.step===1?'целое число ':'значение ')+'от '+f.min+(f.max!==undefined?' до '+f.max:'')+'.',cell:f.cell};
          v[f.cell]=Number(x);
        }
      }
      const calc=engine(id,v),{schema}=data[id],get=c=>calc.get(schema.sheet,c);
      for(const cell of schema.statuses){const status=get(cell);if(status&&status!=='OK')return {valid:false,error:String(status)};}
      const price=get(schema.total);
      if(typeof price!=='number'||!Number.isFinite(price)||price<=0||price>Number.MAX_SAFE_INTEGER/100)return {valid:false,error:'Для этих параметров нужен индивидуальный расчёт. Напишите нам.'};
      const details=schema.outputs.filter(f=>f.cell!==schema.total).map(f=>({label:f.label,value:get(f.cell)})).filter(f=>f.value!==null&&f.value!=='');
      return {valid:true,price:round(price),upper:round(price),range:false,days:Math.max(1,Math.ceil(price/7000)),configuration:v,
        description:fields(id,v).map(f=>f.label+': '+v[f.cell]).join(' · '),details};
    }catch{return {valid:false,error:'Проверьте параметры. Если расчёт недоступен, напишите нам.'};}
  }
  globalThis.TEXT_UV_PRICING={defaults,normalize,fields,quote,quantityCell:id=>quantities[id]};
})();
