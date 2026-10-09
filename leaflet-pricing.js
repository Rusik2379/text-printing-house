/* Sheet printing quotes retain the customer's workbook formulas and rounding. */
(() => {
  'use strict';
  const data=globalThis.TEXT_LEAFLET_DATA,Engine=globalThis.TEXT_COPYCENTER_ENGINE;
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const quantityCell=id=>id==='3.1'?'B6':['3.3','3.4','3.5'].includes(id)?'B8':id==='3.10'?'B9':'B10';
  function defaults(id){
    const v=Object.fromEntries(data[id].schema.fields.map(f=>[f.cell,f.value]));
    if(id==='3.1')v.B6=100;
    if(id==='3.2')Object.assign(v,{B7:120,B10:100});
    if(['3.6','3.7','3.8','3.9'].includes(id))v.B10=100;
    return v;
  }
  function engine(id,v){
    const {schema,book}=data[id];
    return new Engine(book,Object.fromEntries(schema.fields.map(f=>[schema.sheet+'!'+f.cell,v[f.cell]])));
  }
  function options(id,f,v){
    if(!f.validation)return null;
    const formula=f.validation.f1;
    const result=formula.startsWith('"')?formula.slice(1,-1).split(','):engine(id,v).formula(formula,data[id].schema.sheet);
    let choices=[result].flat(Infinity).filter(x=>x!==null&&x!=='').map(String);
    // The current technical profile limits leaflets to these four paper weights.
    if(id==='3.2'&&f.cell==='B7')choices=choices.filter(x=>['120','160','250','300'].includes(x));
    return choices;
  }
  const individual=v=>String(v.B4).toUpperCase()==='ИНДИВИДУАЛЬНЫЙ';
  function minimum(id,v){
    if(id==='3.1')return 100;
    if(['3.2','3.6'].includes(id))return ({A6:50,A5:25,A4:5})[v.B4]||1;
    if(id==='3.3'||['3.7','3.8','3.9'].includes(id))return v.B4==='A4'?5:1;
    if(['3.4','3.5'].includes(id))return v.B4==='A5'?5:1;
    return 1;
  }
  function normalize(id,configuration={}){
    const allowed=new Set(data[id].schema.fields.map(f=>f.cell));
    const v={...defaults(id),...Object.fromEntries(Object.entries(configuration).filter(([cell])=>allowed.has(cell)))};
    for(const f of data[id].schema.fields){const choices=options(id,f,v);if(choices&&!choices.includes(String(v[f.cell])))v[f.cell]=choices[0];}
    return v;
  }
  function fields(id,configuration={}){
    const v={...defaults(id),...configuration};
    return data[id].schema.fields.filter(f=>!['B5','B6'].includes(f.cell)||id==='3.1'||['3.3','3.4','3.5'].includes(id)||individual(v)).map(f=>{
      const choices=options(id,f,v),size=!choices&&['B5','B6'].includes(f.cell),pages=['3.4','3.5'].includes(id)&&f.cell==='B7';
      return {...f,label:size?(f.cell==='B5'?'Ширина, мм':'Высота, мм'):pages?'Страниц с обложкой':f.label,options:choices,locked:choices?.length===1,
        min:f.cell===quantityCell(id)?minimum(id,v):pages?4:size&&id==='3.10'?30:size?0:1,
        positive:size,step:pages?4:size?'any':id==='3.1'&&f.cell==='B6'?100:1};
    });
  }
  function quote(id,configuration={}){
    if(!data[id])return {valid:false,error:'Неизвестная услуга.'};
    const v={...defaults(id),...configuration};
    try{
      for(const f of fields(id,v)){
        const x=v[f.cell];
        if(f.options){
          if(!f.options.includes(String(x)))return {valid:false,error:'Выберите допустимый вариант: '+f.label+'.',cell:f.cell};
          if(typeof f.value==='number')v[f.cell]=Number(x);
        }else{
          if(!['number','string'].includes(typeof x)||String(x).trim()===''||!Number.isFinite(Number(x))||Number(x)<f.min||(f.positive&&Number(x)<=0)||(f.step!=='any'&&(!Number.isSafeInteger(Number(x))||Number(x)%f.step!==0)))
            return {valid:false,error:f.label+': '+(f.step===4?'укажите число от 4, кратное четырём.':f.positive?(f.min>0?'укажите размер от '+f.min+' мм.':'укажите размер больше нуля.'):'укажите целое число от '+f.min+'.'),cell:f.cell};
          v[f.cell]=Number(x);
        }
      }
      const calc=engine(id,v),{schema}=data[id],get=c=>calc.get(schema.sheet,c);
      for(const cell of schema.statuses){const status=get(cell);if(status&&status!=='OK')return {valid:false,error:String(status)};}
      const price=get(schema.total);
      if(typeof price!=='number'||!Number.isFinite(price)||price<=0||price>Number.MAX_SAFE_INTEGER/100)return {valid:false,error:'Для этих параметров нужен индивидуальный расчёт. Напишите нам.'};
      const details=schema.outputs.filter(f=>f.cell!==schema.total).map(f=>({label:f.label.replace('каталога','экземпляра').replace('Цена по ЛИСТОВКАМ','Цена печати до обработки'),value:get(f.cell)})).filter(f=>f.value!==null&&f.value!=='');
      if(['3.4','3.5'].includes(id))details.push({label:'Предпечатная подготовка, ₽',value:get('E20')});
      if(id==='3.10')details.push({label:'Минимальный чек, ₽',value:1000});
      return {valid:true,price:round(price),upper:round(price),range:false,days:Math.max(1,Math.ceil(price/15000)),configuration:v,
        description:fields(id,v).map(f=>f.label+': '+v[f.cell]).join(' · '),details};
    }catch{return {valid:false,error:'Проверьте параметры. Если расчёт недоступен, напишите нам.'};}
  }
  globalThis.TEXT_LEAFLET_PRICING={defaults,normalize,fields,quote,quantityCell};
})();
