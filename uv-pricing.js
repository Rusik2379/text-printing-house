/* Source workbook formulas evaluated as data by the existing safe Excel engine. */
(() => {
  'use strict';
  const data=window.TEXT_UV_DATA,services=window.TEXT_UV_SERVICES,Engine=window.TEXT_COPYCENTER_ENGINE;
  const round=v=>Math.round((v+Number.EPSILON)*100)/100;
  function defaults(id){
    const d=data[id];if(!d)return {};
    const c=Object.fromEntries(d.schema.fields.map(f=>[f.cell,f.value]));
    if(id==='6.9')c.B12='Без фурнитуры';return c;
  }
  function engine(id,c){const {schema,book}=data[id];return new Engine(book,Object.fromEntries(schema.fields.map(f=>[schema.sheet+'!'+f.cell,c[f.cell]])));}
  function options(id,f,c){
    if(['6.1','6.5'].includes(id)&&f.cell==='B6')return ['УФ'];
    if(id==='6.9'&&f.cell==='B12')return ['Без фурнитуры'];
    if(['6.6','6.9'].includes(id)&&f.cell==='B13'&&!String(c.B7).includes('УФ'))return ['БЕЗ ЛАКА'];
    if(f.validation?.type!=='list')return null;
    const formula=f.validation.f1;
    let result=formula.startsWith('"')?formula.slice(1,-1).split(','):[engine(id,c).formula(formula,data[id].schema.sheet)].flat(Infinity).filter(v=>v!==null&&v!=='');
    if(id==='6.8'&&f.cell==='B4')result=result.filter(v=>v!=='Пластик двуслойный');
    if(/Толщина/.test(f.label))result=result.map(Number);return result;
  }
  function normalize(id,configuration={}){
    const c={...defaults(id),...configuration};if(!data[id])return c;
    for(let pass=0;pass<3;pass++)for(const f of data[id].schema.fields){
      const choices=options(id,f,c);
      if(choices){const found=choices.find(v=>String(v)===String(c[f.cell]));c[f.cell]=found??choices[0];}
    }
    return c;
  }
  function fields(id,configuration={}){
    const c={...defaults(id),...configuration},s=services[id];if(!s)return [];
    return data[id].schema.fields.map(f=>{
      const choices=options(id,f,c),v=f.validation;
      const quantity=f.cell===s.quantityCell;
      const min=v?.type==='list'?undefined:Number(v?.f1)||1;
      let max=v?.type==='list'||!v?.f2?undefined:Number(v.f2)||undefined;
      if(quantity&&['6.1','6.5'].includes(id))max=100;
      return {...f,label:id==='6.9'&&f.cell==='B11'?'Форма номерка':f.label,options:choices,locked:choices?.length===1,min,max,step:quantity?1:'any'};
    });
  }
  const errors={'ОШИБКА РАЗМЕРА':'Проверьте размер изделия.','ОШИБКА ТИРАЖА':'Укажите целое количество от 1 штуки.','ВЫБЕРИТЕ ДОПУСТИМУЮ ТОЛЩИНУ':'Выберите допустимую толщину для этого материала.','ПРЕВЫШЕН ФОРМАТ':'Размер превышает рабочий формат. Для большего изделия запросите расчёт.','РАЗМЕР МЕНЬШЕ МИНИМУМА':'Минимальный размер — 200 × 200 мм.','ЛАК ТОЛЬКО ДЛЯ УФ-ПЕЧАТИ':'Лак доступен только с УФ-печатью.'};
  function quote(id,configuration={}){
    if(!data[id])return {valid:false,error:'Выберите услугу.'};
    const c={...defaults(id),...configuration},s=services[id];
    try{
      for(const f of fields(id,c)){
        const value=c[f.cell];
        if(f.options){if(!f.options.some(v=>String(v)===String(value)))return {valid:false,error:'Выберите допустимый вариант: '+f.label+'.',cell:f.cell};if(typeof f.options[0]==='number')c[f.cell]=Number(value);}
        else{
          const n=Number(value);
          if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(n)||n<f.min||(f.max!==undefined&&n>f.max)||(f.step===1&&!Number.isSafeInteger(n)))return {valid:false,error:f.label+': укажите '+(f.step===1?'целое ':'')+'число от '+f.min+(f.max?' до '+f.max:'')+'.',cell:f.cell};
          c[f.cell]=n;
        }
      }
      const e=engine(id,c),schema=data[id].schema,get=cell=>e.get(schema.sheet,cell);
      for(const cell of schema.statuses){const status=get(cell);if(status&&status!=='OK')return {valid:false,error:errors[status]||String(status)};}
      const total=get(schema.total),find=label=>get(schema.outputs.find(f=>f.label===label).cell),subtotal=find('Расчетная стоимость, ₽');
      if(!Number.isFinite(total)||total<=0||!Number.isFinite(subtotal)||subtotal<=0||total>Number.MAX_SAFE_INTEGER/100)return {valid:false,error:'Для этих параметров нужен индивидуальный расчёт.'};
      const details=schema.outputs.filter(f=>/Площадь|Длина|Общая длина|Эффективная площадь|Коэффициент сложности/.test(f.label)).map(f=>({label:f.label,value:get(f.cell)}));
      const quantity=Number(c[s.quantityCell]);
      return {valid:true,total:round(total),subtotal:round(subtotal),unit:subtotal/quantity,effectiveUnit:total/quantity,surcharge:round(total-subtotal),minimum:s.minimum,days:Math.max(1,Math.ceil(total/7000)),configuration:c,details};
    }catch{return {valid:false,error:'Проверьте параметры или запросите индивидуальный расчёт.'};}
  }
  window.TEXT_UV_PRICING={defaults,normalize,fields,quote};
})();
