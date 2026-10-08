/* Project quotes use the customer's original workbook formulas and technical limits.
 * Provenance: project-content.json. All row inputs override workbook sample data.
 */
(() => {
  'use strict';
  const data=globalThis.TEXT_PROJECT_DATA,Engine=globalThis.TEXT_COPYCENTER_ENGINE;
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const multi=id=>Boolean(data[id]?.schema.rows);
  function defaults(id){
    const values=Object.fromEntries(data[id].schema.fields.map(f=>[f.cell,f.value]));
    if(id==='2.2')Object.assign(values,{B6:'Проектная документация',B8:1});
    if(id==='2.4')Object.assign(values,{B4:'ЧЕРТЕЖ',B7:10});
    if(['2.1','2.5'].includes(id))Object.assign(values,{B4:'Без фальцовки',B5:'Нет',B7:'A4',B9:1,rows:[{B:'A1',C:'Ч/Б',D:10}]});
    if(id==='2.6')values.rows=[{B:'A3',C:'Стандартная (80 г/м²)',D:'Цвет',E:10}];
    return values;
  }
  function engine(id,values){
    const {schema,book}=data[id],inputs={};
    for(const f of schema.fields)inputs[schema.sheet+'!'+f.cell]=values[f.cell];
    if(schema.rows)for(let n=schema.rows.start;n<=schema.rows.end;n++)for(const col of schema.rows.cols)
      inputs[schema.sheet+'!'+col+n]=values.rows?.[n-schema.rows.start]?.[col]??null;
    return new Engine(book,inputs);
  }
  function list(id,validation,values){
    if(!validation)return null;
    const f=validation.f1,result=f.startsWith('"')?f.slice(1,-1).split(','):engine(id,values).formula(f,data[id].schema.sheet);
    return [result].flat(Infinity).filter(v=>v!==null&&v!=='').map(String);
  }
  function options(id,field,values){
    if(id==='2.2'&&field.cell==='B6')return ['Проектная документация'];
    if(id==='2.4'&&field.cell==='B4')return ['ЧЕРТЕЖ'];
    return list(id,field.validation,values);
  }
  function rowFields(id,values=defaults(id)){
    const {schema,book}=data[id];if(!schema.rows)return [];
    const row=schema.rows.start;
    return schema.rows.cols.map((col,index)=>{
      const cell=col+row,validation=book.sheets[schema.sheet].validations.find(v=>v.sqref.split(' ').some(range=>{
        if(range===cell)return true;
        const m=range.match(/^([A-Z]+)(\d+):\1(\d+)$/);return m&&m[1]===col&&row>=Number(m[2])&&row<=Number(m[3]);
      }));
      return {col,label:schema.rows.labels[index],options:list(id,validation,values)};
    });
  }
  function active(id,cell,values){
    if(['2.1','2.5'].includes(id)&&['B6','B7','B8','B9'].includes(cell))return values.B5==='Да';
    if(id==='2.6'&&['B5','B6','B7'].includes(cell))return values.B4==='Да';
    return true;
  }
  function normalize(id,configuration={}){
    const base=defaults(id),allowed=new Set([...data[id].schema.fields.map(f=>f.cell),'rows']);
    const values={...base,...Object.fromEntries(Object.entries(configuration).filter(([k])=>allowed.has(k)))};
    if(multi(id)&&Array.isArray(values.rows))values.rows=values.rows.map(row=>Object.fromEntries(data[id].schema.rows.cols.map(col=>[col,row?.[col]])));
    for(let pass=0;pass<2;pass++)for(const field of data[id].schema.fields){
      const choices=options(id,field,values);if(choices&&!choices.includes(String(values[field.cell])))values[field.cell]=choices[0];
    }
    return values;
  }
  function fields(id,configuration={}){
    const values={...defaults(id),...configuration};
    return data[id].schema.fields.filter(f=>active(id,f.cell,values)).map(f=>{
      const choices=options(id,f,values),size=id==='2.7'&&['B4','B5'].includes(f.cell);
      return {...f,options:choices,locked:choices?.length===1,min:size?0:1,positive:size,step:size?'any':1,max:size?(f.cell==='B4'?841:18000):undefined};
    });
  }
  function number(value,min,integer){
    return ['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=min&&(!integer||Number.isSafeInteger(Number(value)));
  }
  function quote(id,configuration={}){
    if(!data[id])return {valid:false,error:'Неизвестная услуга.'};
    const values={...defaults(id),...configuration};
    try{
      for(const f of fields(id,values)){
        const v=values[f.cell];
        if(f.options){if(!f.options.includes(String(v)))return {valid:false,error:'Выберите допустимый вариант: '+f.label+'.',cell:f.cell};}
        else{
          if(!number(v,f.min,f.step===1)||(f.positive&&Number(v)<=0))return {valid:false,error:f.label+': укажите '+(f.step===1?'целое число от 1.':'число больше нуля.'),cell:f.cell};
          if(f.max&&Number(v)>f.max)return {valid:false,error:f.label+': максимум '+f.max+' мм.',cell:f.cell};
          values[f.cell]=Number(v);
        }
      }
      if(multi(id)){
        const schema=data[id].schema,limit=schema.rows.end-schema.rows.start+1;
        if(!Array.isArray(values.rows)||!values.rows.length||values.rows.length>limit)return {valid:false,error:'Добавьте от 1 до '+limit+' строк листов.'};
        const defs=rowFields(id,values),clean=[];
        for(let index=0;index<values.rows.length;index++){
          const row=values.rows[index];if(!row||typeof row!=='object'||Array.isArray(row))return {valid:false,error:'Проверьте строку '+(index+1)+'.'};
          const out={};
          for(const f of defs){
            const v=row[f.col];
            if(f.options){if(!f.options.includes(String(v)))return {valid:false,error:`Строка ${index+1}: выберите ${f.label.toLowerCase()}.`,row:index,col:f.col};out[f.col]=String(v);}
            else{if(!number(v,1,true))return {valid:false,error:`Строка ${index+1}: количество листов — целое число от 1.`,row:index,col:f.col};out[f.col]=Number(v);}
          }
          clean.push(out);
        }
        values.rows=clean;
      }
      const calc=engine(id,values),{schema}=data[id],get=cell=>calc.get(schema.sheet,cell);
      for(const cell of schema.statuses){const status=get(cell);if(status&&!['OK','Не требуется'].includes(status))return {valid:false,error:String(status)};}
      const price=get(schema.total);
      if(typeof price!=='number'||!Number.isFinite(price)||price<0||(price===0&&id!=='2.3')||price>Number.MAX_SAFE_INTEGER/100)return {valid:false,error:'Для этих параметров нужен индивидуальный расчёт. Напишите нам.'};
      const details=schema.outputs.filter(f=>f.cell!==schema.total).map(f=>({label:f.label.replace('База печати по 1-й колонке','Печать до скидки').replace('Печать после пересчета','Печать с учётом тиража'),value:get(f.cell)})).filter(f=>f.value!=null&&f.value!=='');
      const scalar=fields(id,values).map(f=>f.label+': '+values[f.cell]).join(' · ');
      const rowText=values.rows?values.rows.map((row,i)=>`${i+1}. `+schema.rows.cols.map((col,n)=>schema.rows.labels[n]+': '+row[col]).join(' · ')).join('\n'):'';
      const rowPrices=values.rows?.map((_,i)=>round(get((id==='2.6'?'G':'I')+(schema.rows.start+i))));
      return {valid:true,price:round(price),upper:round(price),range:false,days:Math.max(1,Math.ceil(price/25000)),configuration:values,description:[rowText,scalar].filter(Boolean).join('\n'),details,rowPrices};
    }catch{return {valid:false,error:'Проверьте параметры. Если расчёт недоступен, напишите нам.'};}
  }
  globalThis.TEXT_PROJECT_PRICING={defaults,normalize,fields,rowFields,quote};
})();
