(() => {
  'use strict';
  const p=window.TEXT_UV_PRICING,format=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(v),money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v)+' ₽';
  function description(c,id){return p.fields(id,c).map(f=>`${f.label}: ${typeof c[f.cell]==='number'?format(c[f.cell]):c[f.cell]}`).join(' · ');}
  function url(c,origin,id){const link=new URL(window.TEXT_UV_SERVICES[id].path,origin);link.search=new URLSearchParams(Object.fromEntries(p.fields(id,c).map(f=>[f.cell,String(c[f.cell])]))).toString();link.hash='calculator';return link.href;}
  function read(params,id){
    const d=p.defaults(id),c={...d};
    for(const key of Object.keys(d))if(params.has(key)){
      const v=params.get(key);c[key]=typeof d[key]==='number'?Number(v):v;
    }
    const normalized=p.normalize(id,c);return p.quote(id,normalized).valid?normalized:p.normalize(id,d);
  }
  function text(c,origin,id){
    if(!p.quote(id,c).valid)return null;
    const s=window.TEXT_UV_SERVICES[id],rows=[...new Set([...s.quantities,Number(c[s.quantityCell])])].sort((a,b)=>a-b).map(q=>{const r=p.quote(id,{...c,[s.quantityCell]:q});return `${format(q)} шт - ${r.valid?money(r.total):'индивидуальный расчёт'}`;});
    return [`Услуга: ${s.name}`,...p.fields(id,c).filter(f=>f.cell!==s.quantityCell).map(f=>`${f.label}: ${typeof c[f.cell]==='number'?format(c[f.cell]):c[f.cell]}`),'Количество:',...rows,'','Посмотреть цены на другие тиражи, размеры и опции, а также оформить заказ вы можете, перейдя по этой ссылке:',url(c,origin,id)].join('\n');
  }
  window.TEXT_UV_SHARING={description,url,read,text};
})();
