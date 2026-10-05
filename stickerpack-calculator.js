(() => {
  'use strict';
  const round=(value,digits)=>{
    const scale=10**digits;
    return Math.round(value*scale+Number.EPSILON*Math.abs(value*scale))/scale;
  };
  window.TEXT_CALCULATE_STICKERPACKS=({width,height,quantity,print,material})=>{
    const r=window.TEXT_STICKERPACK_PRICING;
    const coefficient=r.coefficients[print]?.[material];
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isSafeInteger(quantity)||quantity<0||!coefficient)return null;
    const area=Math.max(width*height,r.areas[0]);
    const count=Math.min(Math.max(quantity,r.quantities[0]),r.quantities.at(-1));
    const row=Math.min(r.areas.findLastIndex(a=>a<=area),r.areas.length-2);
    const col=r.quantities.findLastIndex(q=>q<=count),next=Math.min(col+1,r.quantities.length-1);
    const areaRatio=(area-r.areas[row])/(r.areas[row+1]-r.areas[row]);
    const quantityRatio=next===col?0:(count-r.quantities[col])/(r.quantities[next]-r.quantities[col]);
    const low=r.rates[row][col]+(r.rates[row][next]-r.rates[row][col])*quantityRatio;
    const high=r.rates[row+1][col]+(r.rates[row+1][next]-r.rates[row+1][col])*quantityRatio;
    const base=round(low+(high-low)*areaRatio,4);
    const unit=round(base*coefficient*r.packFactor,4);
    const subtotal=round(unit*quantity,2);
    const total=quantity?Math.max(subtotal,r.minimum):0;
    if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)return null;
    return {unit,subtotal,total,surcharge:round(total-subtotal,2),effectiveUnit:quantity?total/quantity:0,days:Math.max(1,Math.ceil(total/r.capacityPerDay))};
  };
  window.TEXT_STICKER_CART_TOTAL=items=>{
    let stickers=0,other=0,hasStickers=false;
    for(const item of items){
      if(!Number.isFinite(item.price)||item.price<0)continue;
      if(item.pricingGroup==='stickers'){stickers+=item.price;hasStickers=true;}else other+=item.price;
    }
    const surcharge=hasStickers&&stickers>0?round(Math.max(0,window.TEXT_STICKERPACK_PRICING.minimum-stickers),2):0;
    return {total:round(stickers+other+surcharge,2),surcharge};
  };
})();
