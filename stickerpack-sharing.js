(() => {
  'use strict';
  const labels={
    print:{vinyl:'Виниловая',uv:'УФ-печать'},
    material:{white:'Белая плёнка',transparent:'Прозрачная плёнка',holographic:'Голографическая плёнка'}
  };
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const dimension=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(value/10);
  const fallback={path:'nakleyki-i-stikery/stikerpaki/',kind:'pack',shape:'rectangle',defaults:{print:'uv',material:'white',width:100,height:150,quantity:50},materials:['white','transparent','holographic'],quantities:[50,100,200,500,1000,5000]};
  const service=id=>window.TEXT_STICKER_SERVICES?.[id]||fallback;
  const calculate=(c,s)=>window.TEXT_CALCULATE_STICKERS?window.TEXT_CALCULATE_STICKERS({...c,kind:s.kind,shape:s.shape}):window.TEXT_CALCULATE_STICKERPACKS(c);
  function read(params,id='4.4'){
    const s=service(id),defaults=s.defaults;
    const c={...defaults};
    for(const key of ['print','material'])if(Object.hasOwn(labels[key],params.get(key)))c[key]=params.get(key);
    for(const key of ['width','height','quantity']){
      const value=Number(params.get(key));
      if(Number.isFinite(value)&&value>0&&(key!=='quantity'||Number.isSafeInteger(value)))c[key]=value;
    }
    if(s.kind==='3d')c.print='uv';
    if(!s.materials.includes(c.material)||c.print==='vinyl')c.material='white';
    if(s.shape==='round')c.height=c.width;
    if(!calculate(c,s)){c.width=defaults.width;c.height=defaults.height;c.quantity=defaults.quantity;}
    return c;
  }
  function url(c,origin,id='4.4'){
    const link=new URL(service(id).path,origin);
    link.search=new URLSearchParams({print:c.print,material:c.material,width:String(c.width),height:String(c.height),quantity:String(c.quantity)}).toString();
    link.hash='calculator';
    return link.href;
  }
  function text(c,origin,id='4.4'){
    const s=service(id);
    if(!calculate(c,s)||c.quantity<1)return null;
    const quantities=[...new Set([...s.quantities,c.quantity])].sort((a,b)=>a-b);
    const rows=quantities.map(quantity=>`${format(quantity)} шт - ${format(calculate({...c,quantity},s).total)} ₽`);
    const size=s.shape==='round'?`Диаметр: ${dimension(c.width)} см`:`Размер: ${dimension(c.width)} x ${dimension(c.height)} см`;
    return [`Материал: ${labels.material[c.material]}`,size,`Печать: ${s.kind==='3d'?'Печать с 3D-покрытием':labels.print[c.print]}`,...(s.kind==='pack'?[]:[`Услуга: ${s.name}`]),'Количество:',...rows,'','Посмотреть цены на другие тиражи, размеры и опции, а также оформить заказ вы можете, перейдя по этой ссылке:',url(c,origin,id)].join('\n');
  }
  window.TEXT_STICKERPACK_SHARING={labels,read,url,text};
})();
