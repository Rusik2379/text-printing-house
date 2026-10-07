(() => {
  'use strict';
  const round=(v,n=2)=>{const scale=10**n;return Math.sign(v)*Math.round(Math.abs(v)*scale+1e-9)/scale;};
  const interpolate=(points,values,x,{clamp=false}={})=>{
    if(clamp)x=Math.max(points[0],Math.min(x,points.at(-1)));
    const i=Math.max(0,Math.min(points.findLastIndex(p=>p<=x),points.length-2));
    return values[i]+(values[i+1]-values[i])*(x-points[i])/(points[i+1]-points[i]);
  };
  window.TEXT_WIDE_ERROR=(id,c)=>{
    const s=window.TEXT_WIDE_SERVICES?.[id];if(!s||!c)return 'Выберите услугу.';
    if(!Number.isFinite(c.width)||!Number.isFinite(c.height)||c.width<=0||c.height<=0)return 'Укажите ширину и высоту больше нуля.';
    if(!Number.isSafeInteger(c.quantity)||c.quantity<1)return 'Введите целое количество от 1 штуки.';
    if(!s.materialsByPrint[c.print]?.includes(c.material))return 'Выберите материал для этой технологии.';
    if(s.kind==='cut'){
      if(!['simple','complex'].includes(c.complexity))return 'Выберите сложность резки.';
      if(c.width<200||c.height<200)return 'Минимальный размер — 200 × 200 мм.';
      if(!((c.width<=600&&c.height<=2000)||(c.width<=2000&&c.height<=600)))return 'Максимальный формат — 600 × 2000 мм. Можно повернуть изделие.';
    }
    if(s.kind==='mount'){
      if(!(s.model==='pvc'?['3','5']:['5']).includes(c.thickness))return 'Выберите толщину основы.';
      if(s.model==='foam'&&(c.width<200||c.height<200))return 'Минимальный размер — 200 × 200 мм.';
      if(c.width>1450||c.height>(s.model==='pvc'?2000:1350))return `Максимальный размер — 1450 × ${s.model==='pvc'?2000:1350} мм.`;
    }
    return '';
  };
  window.TEXT_QUOTE_WIDE_SERVICE=(id,c)=>{
    if(window.TEXT_WIDE_ERROR(id,c))return null;
    const s=window.TEXT_WIDE_SERVICES[id],p=window.TEXT_WIDE_PRICING,model=p.models[s.model];
    let unit,subtotal,details={};
    if(s.kind==='area'){
      const area=round(c.width*c.height/1000000,4),totalArea=round(area*c.quantity,4);
      const rate=round(interpolate(model.points,model.rates[c.print][c.material],totalArea,{clamp:true}));
      unit=round(rate*area);subtotal=round(rate*totalArea);details={area,totalArea,rate};
    }else if(s.kind==='cut'){
      const rates=model.rates[c.material].map(row=>interpolate(model.quantities,row,c.quantity,{clamp:true}));
      unit=interpolate(model.areas,rates,c.width*c.height)*(c.complexity==='simple'?.9:1);
      subtotal=round(unit*c.quantity);details={area:c.width*c.height/1000000};
    }else{
      // The workbook displays rounded E10–E12, but interpolates with raw U7–U9.
      const rates=model.rates[c.print][c.thickness].map(row=>interpolate(model.quantities,row,c.quantity));
      const area=s.model==='pvc'?Math.max(40000,c.width*c.height):c.width*c.height;
      unit=round(interpolate(model.areas,rates,area));subtotal=round(unit*c.quantity);details={area:c.width*c.height/1000000};
    }
    // Continued mounting tariffs can cross zero. Such orders need a studio quote.
    if(!Number.isFinite(unit)||unit<=0||!Number.isFinite(subtotal)||subtotal<=0||subtotal>Number.MAX_SAFE_INTEGER)return null;
    const total=Math.max(subtotal,s.minimum);
    return {unit,subtotal,total,surcharge:round(total-subtotal),effectiveUnit:total/c.quantity,days:Math.max(1,Math.ceil(total/p.capacityPerDay)),...details};
  };
})();
