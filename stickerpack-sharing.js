(() => {
  'use strict';
  const labels={
    print:{vinyl:'Виниловая',uv:'УФ-печать'},
    material:{white:'Белая плёнка',transparent:'Прозрачная плёнка',holographic:'Голографическая плёнка'}
  };
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const dimension=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(value/10);
  function read(params){
    const defaults={print:'uv',material:'white',width:100,height:150,quantity:50};
    const c={...defaults};
    for(const key of ['print','material'])if(Object.hasOwn(labels[key],params.get(key)))c[key]=params.get(key);
    for(const key of ['width','height','quantity']){
      const value=Number(params.get(key));
      if(Number.isFinite(value)&&value>0&&(key!=='quantity'||Number.isSafeInteger(value)))c[key]=value;
    }
    if(c.print==='vinyl')c.material='white';
    if(!window.TEXT_CALCULATE_STICKERPACKS(c)){c.width=defaults.width;c.height=defaults.height;c.quantity=defaults.quantity;}
    return c;
  }
  function url(c,origin){
    const link=new URL('/nakleyki-i-stikery/stikerpaki/',origin);
    link.search=new URLSearchParams({print:c.print,material:c.material,width:String(c.width),height:String(c.height),quantity:String(c.quantity)}).toString();
    link.hash='calculator';
    return link.href;
  }
  function text(c,origin){
    if(!window.TEXT_CALCULATE_STICKERPACKS(c)||c.quantity<1)return null;
    const quantities=[...new Set([50,100,200,500,1000,5000,c.quantity])].sort((a,b)=>a-b);
    const rows=quantities.map(quantity=>`${format(quantity)} шт - ${format(window.TEXT_CALCULATE_STICKERPACKS({...c,quantity}).total)} ₽`);
    return [`Материал: ${labels.material[c.material]}`,`Размер: ${dimension(c.width)} x ${dimension(c.height)} см`,`Печать: ${labels.print[c.print]}`,'Количество:',...rows,'','Посмотреть цены на другие тиражи, размеры и опции, а также оформить заказ вы можете, перейдя по этой ссылке:',url(c,origin)].join('\n');
  }
  window.TEXT_STICKERPACK_SHARING={labels,read,url,text};
})();
