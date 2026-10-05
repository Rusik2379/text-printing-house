(() => {
  'use strict';
  const roundPrice=value=>Math.round(value*100+Number.EPSILON*Math.abs(value*100))/100;
  window.TEXT_CALCULATE_CARDS=(paper,quantity,sides,lamination,corners)=>{
    const rules=window.TEXT_PRICING.cards;
    const rate=rules.rates.find(r=>r.paper===paper&&r.quantity===quantity);
    if(!rate)return null;
    const unit=roundPrice((sides==='2'?rate.twoSides:rate.oneSide)*(lamination?rules.lamination:1)*(corners?rules.roundCorners:1));
    const total=roundPrice(unit*quantity);
    return {unit,total,days:Math.max(1,Math.ceil(total/rules.capacityPerDay))};
  };
})();
