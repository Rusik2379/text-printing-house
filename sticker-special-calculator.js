(() => {
  'use strict';
  const round=(v,n=2)=>{const s=10**n;return Math.round(v*s+Number.EPSILON*Math.abs(v*s))/s;};
  const positive=v=>Number.isFinite(v)&&v>0;
  const count=v=>Number.isSafeInteger(v)&&v>0;
  const quote=(subtotal,quantity,minimum,details={})=>{
    const total=Math.max(subtotal,minimum);
    if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)return null;
    return {unit:subtotal/quantity,subtotal,total,surcharge:round(total-subtotal),effectiveUnit:total/quantity,days:Math.max(1,Math.ceil(total/10000)),...details};
  };
  window.TEXT_CALCULATE_PAPER_STICKERS=c=>{
    if(!c||!positive(c.width)||!positive(c.height)||!count(c.quantity)||c.print!=='digital'||c.material!=='paper'||!['yes','no'].includes(c.cut))return null;
    const cut=c.cut==='yes',gap=cut?3:0,workingWidth=cut?280:304,workingHeight=cut?410:434;
    const fit=(w,h)=>Math.floor((workingWidth+gap)/(w+gap))*Math.floor((workingHeight+gap)/(h+gap));
    const normal=fit(c.width,c.height),rotated=fit(c.height,c.width),perSheet=Math.max(normal,rotated);
    if(!Number.isSafeInteger(perSheet)||perSheet<1)return null;
    const sheets=Math.ceil(c.quantity/perSheet),discount=sheets<=3?0:sheets<=6?.05:sheets<=10?.1:sheets<=20?.15:.2;
    const sheetPrice=round((cut?320:150)*(1-discount));
    return quote(round(sheets*sheetPrice),c.quantity,150,{perSheet,sheets,sheetPrice,discount,rotated:rotated>normal,workingWidth,workingHeight,gap});
  };
  window.TEXT_3D_PACK_CAPACITY=c=>positive(c?.width)&&positive(c?.height)&&positive(c?.stickerWidth)&&positive(c?.stickerHeight)?Math.floor(c.width/(c.stickerWidth+10))*Math.floor(c.height/(c.stickerHeight+10)):0;
  window.TEXT_CALCULATE_3D_PACKS=c=>{
    if(!c||!count(c.quantity)||!count(c.perPack)||c.print!=='uv'||!['white','transparent'].includes(c.material))return null;
    const capacity=window.TEXT_3D_PACK_CAPACITY(c),innerQuantity=c.perPack*c.quantity;
    if(!Number.isSafeInteger(capacity)||c.perPack>capacity||!count(innerQuantity))return null;
    const inner=window.TEXT_CALCULATE_STICKERS({width:c.stickerWidth,height:c.stickerHeight,quantity:innerQuantity,print:'uv',material:c.material,kind:'3d',shape:'rectangle'});
    if(!inner)return null;
    // Workbook E22 rounds the contents of one pack before E24 applies 1.2.
    const unit=round(round(inner.unit*c.perPack)*1.2);
    return quote(round(unit*c.quantity),c.quantity,1000,{unit,capacity,innerQuantity,innerUnit:inner.unit});
  };
  window.TEXT_QUOTE_STICKER_SERVICE=(id,c)=>{
    const s=window.TEXT_STICKER_SERVICES?.[id];
    if(!s||!count(c?.quantity))return null;
    if(s.kind==='paper')return window.TEXT_CALCULATE_PAPER_STICKERS(c);
    if(s.kind==='3d-pack')return window.TEXT_CALCULATE_3D_PACKS(c);
    return window.TEXT_CALCULATE_STICKERS({...c,kind:s.kind,shape:s.variableShape?c.shape:s.shape});
  };
})();
