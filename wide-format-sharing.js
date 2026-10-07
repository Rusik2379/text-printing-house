(() => {
  'use strict';
  const format=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
  const dimension=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(v);
  const labels={complexity:{simple:'Простая',complex:'Сложная'}};
  function read(params,id){
    const s=window.TEXT_WIDE_SERVICES[id],c={...s.defaults};
    for(const key of Object.keys(c)){
      if(!params.has(key))continue;
      const value=params.get(key);
      if(['width','height','quantity'].includes(key)){
        const number=Number(value);if(Number.isFinite(number)&&number>0&&(key!=='quantity'||Number.isSafeInteger(number)))c[key]=number;
      }else if(key==='print'&&Object.hasOwn(s.prints,value))c[key]=value;
      else if(key==='material'&&Object.hasOwn(s.materials,value))c[key]=value;
      else if(key==='complexity'&&Object.hasOwn(labels.complexity,value))c[key]=value;
      else if(key==='thickness'&&(s.model==='pvc'?['3','5']:['5']).includes(value))c[key]=value;
    }
    if(!s.materialsByPrint[c.print].includes(c.material))c.material=s.materialsByPrint[c.print][0];
    return window.TEXT_QUOTE_WIDE_SERVICE(id,c)?c:{...s.defaults};
  }
  function url(c,origin,id){
    const s=window.TEXT_WIDE_SERVICES[id],link=new URL(s.path,origin);
    link.search=new URLSearchParams(Object.fromEntries(Object.keys(s.defaults).map(k=>[k,String(c[k])]))).toString();link.hash='calculator';return link.href;
  }
  function description(c,id){
    const s=window.TEXT_WIDE_SERVICES[id];
    return [`${dimension(c.width)} × ${dimension(c.height)} мм`,s.materials[c.material],s.prints[c.print],...(s.kind==='mount'?[c.thickness+' мм']:[]),...(s.kind==='cut'?[labels.complexity[c.complexity]+' резка','Монтажная плёнка Oratape']:[])].join(' · ');
  }
  function text(c,origin,id){
    if(!window.TEXT_QUOTE_WIDE_SERVICE(id,c))return null;
    const s=window.TEXT_WIDE_SERVICES[id],counts=[...new Set([...s.quantities,c.quantity])].sort((a,b)=>a-b);
    const rows=counts.map(quantity=>{const quote=window.TEXT_QUOTE_WIDE_SERVICE(id,{...c,quantity});return `${format(quantity)} шт - ${quote?format(quote.total)+' ₽':'индивидуальный расчёт'}`;});
    return [`Услуга: ${s.name}`,`Материал: ${s.materials[c.material]}`,`Размер: ${dimension(c.width)} x ${dimension(c.height)} мм`,`Технология: ${s.prints[c.print]}`,...(s.kind==='mount'?[`Толщина: ${c.thickness} мм`]:[]),...(s.kind==='cut'?[`Резка: ${labels.complexity[c.complexity]}`,'Монтажная плёнка: Oratape']:[]),'Количество:',...rows,'','Посмотреть цены на другие тиражи, размеры и опции, а также оформить заказ вы можете, перейдя по этой ссылке:',url(c,origin,id)].join('\n');
  }
  window.TEXT_WIDE_SHARING={labels,read,url,text,description};
})();
