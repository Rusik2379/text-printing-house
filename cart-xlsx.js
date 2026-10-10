/* Branded workbook export, using the reviewed customer template on demand. */
(() => {
  'use strict';
  const assetRoot=typeof document!=='undefined'?new URL('.',document.currentScript.src).href:'';
  const clean=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\r\n?/g,'\n');
  const quantities={
    '1.1':['B7','стр.'],'1.2':['B7','прогон'],'1.3':['B8','шт.'],'1.4':['B6','шт.'],'1.5':['B8','шт.'],'1.6':['B11','экз.'],'1.7':['B7','прогон'],'1.8':['B7','шт.'],'1.9':['B8','экз.'],
    '2.2':['B8','шт.'],'2.3':['B5','л.'],'2.4':['B7','прогон'],'2.7':['B7','шт.'],
    '3.1':['B6','шт.'],'3.2':['B10','шт.'],'3.3':['B8','шт.'],'3.4':['B8','шт.'],'3.5':['B8','шт.'],'3.6':['B10','шт.'],'3.7':['B10','шт.'],'3.8':['B10','шт.'],'3.9':['B10','шт.'],'3.10':['B9','шт.'],
    '6.1':['B9','шт.'],'6.2':['B7','поле'],'6.3':['B9','шт.'],'6.4':['B10','шт.'],'6.5':['B9','шт.'],'6.6':['B10','шт.'],'6.7':['B8','шт.'],'6.8':['B8','шт.'],'6.9':['B10','шт.']
  };
  function quantity(item){
    const c=item.configuration||{};
    if((item.id?.startsWith('4.')||item.id?.startsWith('5.'))&&Number.isSafeInteger(c.quantity)&&c.quantity>0)return {quantity:c.quantity,unit:['4.4','4.11'].includes(item.id)?'набор':'шт.'};
    const info=quantities[item.id],number=info?Number(c[info[0]]):NaN;
    // A grouped project calculation includes different formats/operations as one service.
    return Number.isSafeInteger(number)&&number>0?{quantity:number,unit:info[1]}:{quantity:1,unit:'усл.'};
  }
  function model(items,catalog,breakdown,date=new Date(),values={}){
    const pdf=globalThis.TEXT_CART_PDF.model(items,catalog,breakdown,date);
    const cart=pdf.rows.map((row,i)=>{
      const details=[row.description,row.fileName?'Макет: '+row.fileName:'',row.upper>row.price?'Предварительная стоимость: '+row.priceText:'',row.price===null?'Стоимость: требуется расчёт':''].filter(Boolean).join('\n');
      return {id:clean(items[i].id),name:clean(row.name),description:clean(details),price:row.price,...quantity(items[i])};
    });
    for(const row of pdf.surcharges)cart.push({id:'',name:clean(row.name),description:'Доплата до минимального чека',price:row.amount,quantity:1,unit:'усл.'});
    if(!Number.isFinite(pdf.lower)||pdf.lower>999999999999.99)throw Error('Для этой суммы нужен отдельный документ');
    const note=[pdf.unknownCount?'Часть позиций требует расчёта. Итог указан только за рассчитанные позиции.':'',pdf.upper>pdf.lower?'Стоимость предварительная: '+pdf.totalText+'. Точную цену подтвердим после проверки макета.':'',values.comment].filter(Boolean).join('\n');
    return {cart,date,values:{number:clean(values.number),name:clean(values.name),contact:clean(values.contact),basis:clean(values.basis||'Заказ с сайта text-print.ru'),comment:clean(note)},lower:pdf.lower,upper:pdf.upper,unknownCount:pdf.unknownCount};
  }
  let loading;
  function loadTemplate(){
    if(typeof globalThis.TEKST_XLSX==='function')return Promise.resolve();
    if(!loading)loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL('vendor/xlsx/order-template.js?v=20261009-2',assetRoot).href;
      script.onload=()=>{if(typeof globalThis.TEKST_XLSX==='function')resolve();else{script.remove();reject(Error('XLSX module unavailable'));}};
      script.onerror=()=>{script.remove();reject(Error('XLSX module failed to load'));};document.head.append(script);
    }).catch(error=>{loading=undefined;throw error;});
    return loading;
  }
  async function download(data){
    await loadTemplate();
    const bytes=globalThis.TEKST_XLSX(data),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link=document.createElement('a');link.href=url;link.download='ТЕКСТ — товарный чек и акт.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  globalThis.TEXT_CART_XLSX={model,download};
})();
