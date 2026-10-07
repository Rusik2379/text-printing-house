(() => {
  'use strict';
  const round=(value,digits)=>{
    const scale=10**digits;
    return Math.round(value*scale+Number.EPSILON*Math.abs(value*scale))/scale;
  };
  window.TEXT_CALCULATE_STICKERS=({width,height,quantity,print,material,kind='flat',shape='rectangle'}={})=>{
    if(!['flat','pack','3d','uv-dtf'].includes(kind)||!['rectangle','round','figure'].includes(shape))return null;
    const r=kind==='3d'?window.TEXT_STICKER_PRICING?.threeD:window.TEXT_STICKER_PRICING?.flat||window.TEXT_STICKERPACK_PRICING;
    if(!r||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isSafeInteger(quantity)||quantity<0)return null;
    if(kind==='pack'&&shape!=='rectangle')return null;
    if(kind==='3d'&&(print!=='uv'||!['white','transparent'].includes(material)))return null;
    if(kind==='uv-dtf'&&(print!=='uv'||material!=='transfer'))return null;
    const selected=r.coefficients[print]?.[material];
    const coefficient=kind==='uv-dtf'?2.3562:kind==='3d'?r.coefficients[shape]:typeof selected==='number'?selected*({rectangle:1,round:.9,figure:1.1}[shape]):selected?.[shape];
    if(!coefficient)return null;
    const area=Math.max(width*height,r.areas[0]);
    const count=Math.min(Math.max(quantity,r.quantities[0]),r.quantities.at(-1));
    const row=Math.min(r.areas.findLastIndex(a=>a<=area),r.areas.length-2);
    const col=r.quantities.findLastIndex(q=>q<=count),next=Math.min(col+1,r.quantities.length-1);
    const areaRatio=(area-r.areas[row])/(r.areas[row+1]-r.areas[row]);
    const quantityRatio=next===col?0:(count-r.quantities[col])/(r.quantities[next]-r.quantities[col]);
    const low=r.rates[row][col]+(r.rates[row][next]-r.rates[row][col])*quantityRatio;
    const high=r.rates[row+1][col]+(r.rates[row+1][next]-r.rates[row+1][col])*quantityRatio;
    const base=round(low+(high-low)*areaRatio,4);
    const unit=round(base*coefficient*(kind==='pack'?r.packFactor:1),4);
    const subtotal=round(unit*quantity,2);
    const total=quantity?Math.max(subtotal,kind==='uv-dtf'?800:r.minimum):0;
    if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)return null;
    const capacity=window.TEXT_STICKER_PRICING?.capacityPerDay||window.TEXT_STICKERPACK_PRICING?.capacityPerDay||10000;
    return {unit,subtotal,total,surcharge:round(total-subtotal,2),effectiveUnit:quantity?total/quantity:0,days:Math.max(1,Math.ceil(total/capacity))};
  };
  window.TEXT_CALCULATE_STICKERPACKS=c=>window.TEXT_CALCULATE_STICKERS({...c,kind:'pack',shape:'rectangle'});
  window.TEXT_STICKER_CART_BREAKDOWN=items=>{
    const minimums={stickers:window.TEXT_STICKER_PRICING?.flat.minimum||window.TEXT_STICKERPACK_PRICING.minimum,stickers3d:window.TEXT_STICKER_PRICING?.threeD.minimum||1000,uvdtf:800,paper:150};
    const subtotals=Object.fromEntries(Object.keys(minimums).map(k=>[k,0])),surcharges={...subtotals};let other=0;
    for(const item of items){
      if(!Number.isFinite(item.price)||item.price<0)continue;
      if(Object.hasOwn(subtotals,item.pricingGroup))subtotals[item.pricingGroup]+=item.price;else other+=item.price;
    }
    for(const group of Object.keys(subtotals))if(subtotals[group]>0)surcharges[group]=round(Math.max(0,minimums[group]-subtotals[group]),2);
    const surcharge=round(Object.values(surcharges).reduce((a,b)=>a+b,0),2);
    return {total:round(other+Object.values(subtotals).reduce((a,b)=>a+b,0)+surcharge,2),surcharge,surcharges};
  };
  window.TEXT_STICKER_CART_TOTAL=items=>{const {total,surcharge}=window.TEXT_STICKER_CART_BREAKDOWN(items);return {total,surcharge};};
})();
