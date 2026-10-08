/* Customer workbook formulas with service-specific input validation.
 * See copycenter-content.json for source and copycenter-pricing-data.js for rates.
 */
(() => {
  'use strict';
  const data=globalThis.TEXT_COPYCENTER_DATA;
  const Engine=globalThis.TEXT_COPYCENTER_ENGINE;
  const round=value=>Math.round((value+Number.EPSILON)*100)/100;
  function defaults(id){
    const values=Object.fromEntries(data[id].schema.fields.map(field=>[field.cell,field.value]));
    if(id==='1.1')Object.assign(values,{B4:'А4',B5:'чб',B6:'односторонняя',B7:10,colorRate:20});
    if(id==='1.7')values.B4='ТЕКСТОВЫЙ';
    if(id==='1.5')values.B6='Форматные документы';
    return values;
  }
  function engine(id,values){
    const {schema,book}=data[id];
    return new Engine(book,Object.fromEntries(schema.fields.map(field=>[schema.sheet+'!'+field.cell,values[field.cell]])));
  }
  function options(id,field,values){
    if(!field.validation)return null;
    const formula=field.validation.f1;
    let items=formula.startsWith('"')?formula.slice(1,-1).split(','):engine(id,values).formula(formula,data[id].schema.sheet);
    items=[items].flat(Infinity).filter(value=>value!==null&&value!=='').map(String);
    if(id==='1.1'&&field.cell==='B8'&&values.B4==='А3')items=items.filter(value=>value!=='IQ Color');
    if(id==='1.3'&&field.cell==='B5'&&!['A2','A1','Индивидуальный'].includes(values.B4))items=['Сатин'];
    if(id==='1.6'&&field.cell==='B12')items=values.B4==='Твердый'?['Красный','Синий','Черный']:['Белый'];
    if(id==='1.7'&&field.cell==='B4')items=['ТЕКСТОВЫЙ'];
    if(id==='1.5'&&field.cell==='B6')items=['Форматные документы'];
    return items;
  }
  function active(id,cell,values){
    if(id==='1.3'&&['B6','B7'].includes(cell))return values.B4==='Индивидуальный';
    if(id==='1.6'){
      if(cell==='B7')return values.B5==='ПЕЧАТЬ ВАША';
      if(['B6','B8','B9'].includes(cell))return values.B5==='ПЕЧАТАЕМ';
    }
    return true;
  }
  function normalize(id,configuration={}){
    const values={...defaults(id),...configuration};
    for(let pass=0;pass<2;pass++)for(const field of data[id].schema.fields){
      const choices=options(id,field,values);
      if(choices&&!choices.includes(String(values[field.cell])))values[field.cell]=choices[0];
    }
    if(id==='1.1'&&![15,20,25,30].includes(Number(values.colorRate)))values.colorRate=20;
    return values;
  }
  function fields(id,configuration={}){
    const values={...defaults(id),...configuration};
    return data[id].schema.fields.filter(field=>active(id,field.cell,values)).map(field=>{
      const choices=options(id,field,values);
      const zero=(id==='1.6'&&['B8','B9','B13'].includes(field.cell))||(id==='1.9'&&['B4','B5'].includes(field.cell));
      const size=id==='1.3'&&['B6','B7'].includes(field.cell);
      const min=id==='1.8'&&field.cell==='B7'?50:id==='1.9'&&field.cell==='B8'?10:zero||size?0:1;
      return {...field,options:choices,locked:choices?.length===1,min,positive:size,step:size?'any':1};
    });
  }
  function quote(id,configuration={}){
    if(!data[id])return {valid:false,error:'Неизвестная услуга.'};
    const values={...defaults(id),...configuration};
    try{
      for(const field of fields(id,values)){
        const value=values[field.cell];
        if(field.options){
          if(!field.options.includes(String(value)))return {valid:false,error:'Выберите допустимый вариант: '+field.label+'.',cell:field.cell};
        }else{
          const number=Number(value);
          if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(number)||number<field.min||(field.positive&&number===0)||(field.step===1&&!Number.isSafeInteger(number)))
            return {valid:false,error:`${field.label}: укажите ${field.step===1?'целое ':''}число ${field.positive?'больше нуля':'от '+field.min}.`,cell:field.cell};
          values[field.cell]=number;
        }
      }
      if(id==='1.1'&&values.B4==='А4'&&values.B5==='цветная'&&![15,20,25,30].includes(Number(values.colorRate)))
        return {valid:false,error:'Выберите тариф цветной печати A4.'};
      const calc=engine(id,values),{schema}=data[id],get=cell=>calc.get(schema.sheet,cell);
      for(const cell of schema.statuses){
        const status=get(cell);
        if(status&&status!=='OK')return {valid:false,error:String(status)};
      }
      let price=get(schema.total),upper=price;
      if(id==='1.1'){
        if(values.B4==='А4'&&values.B5==='цветная')price=get({15:'I13',20:'I14',25:'I15',30:'I16'}[Number(values.colorRate)]);
        upper=values.B4==='А3'&&values.B5==='цветная'?get('E11'):price;
      }
      if(typeof price!=='number'||!Number.isFinite(price)||price<=0||!Number.isFinite(upper)||upper<price||upper>Number.MAX_SAFE_INTEGER/100)
        return {valid:false,error:'Для этих параметров нужен индивидуальный расчёт. Напишите нам.'};
      const details=[];
      if(id==='1.1'){
        const sheets=get('E8');
        details.push({label:'Физических листов',value:sheets});
        if(values.B5==='чб')details.push({label:'Тариф за одну сторону, ₽',value:get('E6')});
        else details.push({label:values.B4==='А3'?'Тариф за одну сторону, ₽':'Выбранный тариф за сторону, ₽',value:values.B4==='А3'?'30–45':Number(values.colorRate)});
        if(values.B6==='двусторонняя')details.push({label:'Печать двух сторон листа',value:get('I2')+' × тариф за сторону'});
        details.push({label:'Доплата за бумагу на лист, ₽',value:get('E9')});
      }else{
        for(const output of schema.outputs){
          if(output.cell===schema.total||/ИТОГО|ИТОГОВАЯ|ВСЕГО В ДИПЛОМЕ/i.test(output.label))continue;
          const value=get(output.cell);
          if(value==null||value==='')continue;
          details.push({label:output.label,value:output.label==='Скидка'?Math.round(value*100)+' %':value});
        }
      }
      const description=fields(id,values).map(field=>field.label+': '+values[field.cell]).join(' · ')
        +(id==='1.1'&&values.B4==='А4'&&values.B5==='цветная'?` · Тариф за сторону: ${values.colorRate} ₽`:'');
      return {valid:true,price:round(price),upper:round(upper),range:upper>price,days:Math.max(1,Math.ceil(upper/10000)),configuration:values,description,details};
    }catch(error){
      return {valid:false,error:'Проверьте параметры. Если расчёт недоступен, напишите нам.'};
    }
  }
  globalThis.TEXT_COPYCENTER_PRICING={defaults,normalize,fields,quote};
})();
