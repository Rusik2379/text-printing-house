(() => {
  'use strict';
  const labels={
    print:{vinyl:'Виниловая',uv:'УФ-печать',digital:'Цифровая печать'},
    material:{white:'Белая плёнка',transparent:'Прозрачная плёнка',holographic:'Голографическая плёнка',paper:'Самоклеящаяся бумага UPM Raflatac',transfer:'UV-DTF трансфер'},
    shape:{rectangle:'Прямоугольная',round:'Круглая',figure:'Фигурная'},cut:{yes:'С контурной резкой',no:'Без контурной резки'}
  };
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const dimension=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(value/10);
  const fallback={path:'nakleyki-i-stikery/stikerpaki/',kind:'pack',shape:'rectangle',defaults:{print:'uv',material:'white',width:100,height:150,quantity:50},materials:['white','transparent','holographic'],quantities:[50,100,200,500,1000,5000]};
  const service=id=>window.TEXT_STICKER_SERVICES?.[id]||fallback;
  const calculate=(c,s)=>window.TEXT_QUOTE_STICKER_SERVICE?window.TEXT_QUOTE_STICKER_SERVICE(s.id,c):window.TEXT_CALCULATE_STICKERS?window.TEXT_CALCULATE_STICKERS({...c,kind:s.kind,shape:s.shape}):window.TEXT_CALCULATE_STICKERPACKS(c);
  const printLabel=(c,s)=>s.prints?.[c.print]||(['3d','3d-pack'].includes(s.kind)?'Печать с 3D-покрытием':labels.print[c.print]);
  function read(params,id='4.4'){
    const s=service(id),defaults=s.defaults;
    const c={...defaults};
    for(const key of ['print','material','shape','cut'])if(Object.hasOwn(defaults,key)&&Object.hasOwn(labels[key],params.get(key)))c[key]=params.get(key);
    for(const key of ['width','height','quantity','stickerWidth','stickerHeight','perPack'].filter(k=>Object.hasOwn(defaults,k))){
      const value=Number(params.get(key));
      if(Number.isFinite(value)&&value>0&&(!['quantity','perPack'].includes(key)||Number.isSafeInteger(value)))c[key]=value;
    }
    if(['3d','3d-pack'].includes(s.kind))c.print='uv';
    if(s.prints&&!Object.hasOwn(s.prints,c.print))c.print=defaults.print;
    if(!s.materials.includes(c.material))c.material=defaults.material;
    if(c.print==='vinyl')c.material='white';
    if((s.variableShape?c.shape:s.shape)==='round')c.height=c.width;
    if(!calculate(c,s))Object.assign(c,defaults);
    return c;
  }
  function url(c,origin,id='4.4'){
    const link=new URL(service(id).path,origin);
    const values={print:c.print,material:c.material,width:String(c.width),height:String(c.height),quantity:String(c.quantity)};
    for(const key of ['shape','cut','stickerWidth','stickerHeight','perPack'])if(Object.hasOwn(service(id).defaults,key))values[key]=String(c[key]);
    link.search=new URLSearchParams(values).toString();
    link.hash='calculator';
    return link.href;
  }
  function text(c,origin,id='4.4'){
    const s=service(id);
    if(!calculate(c,s)||c.quantity<1)return null;
    const quantities=[...new Set([...s.quantities,c.quantity])].sort((a,b)=>a-b);
    const rows=quantities.map(quantity=>`${format(quantity)} шт - ${format(calculate({...c,quantity},s).total)} ₽`);
    const size=(s.variableShape?c.shape:s.shape)==='round'?`Диаметр: ${dimension(c.width)} см`:`Размер: ${dimension(c.width)} x ${dimension(c.height)} см`;
    const extras=s.kind==='paper'?[`Резка: ${labels.cut[c.cut]}`]:s.kind==='3d-pack'?[`Размер стикера внутри: ${dimension(c.stickerWidth)} x ${dimension(c.stickerHeight)} см`,`Стикеров в наборе: ${format(c.perPack)}`]:s.variableShape?[`Форма: ${labels.shape[c.shape]}`]:[];
    return [`Материал: ${labels.material[c.material]}`,size,`Печать: ${printLabel(c,s)}`,...extras,...(s.kind==='pack'?[]:[`Услуга: ${s.name}`]),'Количество:',...rows,'','Посмотреть цены на другие тиражи, размеры и опции, а также оформить заказ вы можете, перейдя по этой ссылке:',url(c,origin,id)].join('\n');
  }
  window.TEXT_STICKERPACK_SHARING={labels,read,url,text};
})();
