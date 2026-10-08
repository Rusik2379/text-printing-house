(() => {
  'use strict';
  const siteRoot = new URL('.', document.currentScript.src).href;
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' ₽';
  const sharing=window.TEXT_STICKERPACK_SHARING;
  const service=window.TEXT_STICKER_SERVICES[document.body.dataset.stickerService||'4.4'];
  const isPack=['pack','3d-pack'].includes(service.kind),is3D=['3d','3d-pack'].includes(service.kind),isPaper=service.kind==='paper',is3DPack=service.kind==='3d-pack';
  let isRound=service.shape==='round';
  const unitName=isPack?'набор':'штуку';
  const calculate=c=>window.TEXT_QUOTE_STICKER_SERVICE(service.id,c);
  const printLabels=service.prints||(is3D?{uv:'Печать с 3D-покрытием'}:{vinyl:sharing.labels.print.vinyl,uv:sharing.labels.print.uv});
  const materialLabels=sharing.labels.material;
  const presets=service.sizes;
  const quantities=service.quantities;
  const query=new URLSearchParams(location.search);
  const editingKey=query.get('edit');
  const previous=window.TEXT_APP.getCart().find(item=>item.key===editingKey&&item.id===service.id);
  const state={...sharing.read(query,service.id),...previous?.configuration};
  if(service.variableShape)isRound=state.shape==='round';
  const sizePresets=()=>presets.map(([w,h])=>[w,isRound?w:h]).filter(([w,h],i,a)=>a.findIndex(([x,y])=>w===x&&h===y)===i);
  let customSize=!sizePresets().some(([w,h])=>w===state.width&&h===state.height);
  let customQuantity=!quantities.includes(state.quantity);
  let selectedFile=null,result=null,busy=Boolean(previous?.fileName),fileChanged=false;
  $('#sp-comment').value=previous?.comment||'';
  $('#sp-width').value=state.width;$('#sp-height').value=state.height;$('#sp-quantity').value=state.quantity;
  for(const [id,key] of [['sp-sticker-width','stickerWidth'],['sp-sticker-height','stickerHeight'],['sp-per-pack','perPack']])if($('#'+id))$('#'+id).value=state[key];
  const choice=(group,value,label)=>`<button type="button" class="sp-option${value==='custom'?' sp-custom-option':''}" data-sp-group="${group}" data-sp-value="${value}" aria-pressed="false">${label}</button>`;
  $('#sp-print-options').innerHTML=Object.entries(printLabels).map(([key,label])=>choice('print',key,label)).join('');
  $('#sp-material-options').innerHTML=Object.entries(materialLabels).filter(([key])=>service.materials.includes(key)).map(([key,label])=>choice('material',key,label)).join('');
  const sizeText=(w,h)=>isRound?`⌀ ${new Intl.NumberFormat('ru-RU').format(w/10)} см`:`${new Intl.NumberFormat('ru-RU').format(w/10)} × ${new Intl.NumberFormat('ru-RU').format(h/10)} см`;
  function renderSizes(){ $('#sp-size-options').innerHTML=sizePresets().map(([w,h])=>choice('size',`${w},${h}`,sizeText(w,h))).join('')+choice('size','custom','Другой размер'); }
  renderSizes();
  if($('#sp-shape-options'))$('#sp-shape-options').innerHTML=Object.entries(sharing.labels.shape).map(([v,l])=>choice('shape',v,l)).join('');
  if($('#sp-cut-options'))$('#sp-cut-options').innerHTML=Object.entries(sharing.labels.cut).map(([v,l])=>choice('cut',v,l)).join('');
  $('#sp-quantity-options').innerHTML=quantities.map(q=>`<div class="sp-quantity-row">${choice('quantity',q,new Intl.NumberFormat('ru-RU').format(q)+' шт.')}<span class="sp-quantity-price" data-sp-price="${q}">—</span><span class="sp-discount" data-sp-discount="${q}" hidden></span></div>`).join('')+choice('quantity','custom','Другое количество');
  function configuration(){
    const width=customSize?Number($('#sp-width').value):state.width;
    const c={...state,width,height:isRound?width:customSize?Number($('#sp-height').value):state.height,quantity:customQuantity?Number($('#sp-quantity').value):state.quantity};
    if(is3DPack){c.stickerWidth=Number($('#sp-sticker-width').value);c.stickerHeight=Number($('#sp-sticker-height').value);c.perPack=Number($('#sp-per-pack').value);}
    return c;
  }
  function extraDescription(c){return is3DPack?`Стикеры внутри: ${c.stickerWidth} × ${c.stickerHeight} мм · ${c.perPack} в наборе`:isPaper?sharing.labels.cut[c.cut]:service.variableShape?sharing.labels.shape[c.shape]+' форма':'';}
  function description(c){return `${printLabels[c.print]} · ${materialLabels[c.material]} · ${isRound?`⌀ ${c.width}`:`${c.width} × ${c.height}`} мм · ${c.quantity} ${isPack?'наборов':'шт.'}${extraDescription(c)?' · '+extraDescription(c):''} · ${is3D?'прозрачное 3D-покрытие':isPaper?'SRA3':'без ламинации'}`;}
  function sync(){
    const c=configuration();
    $$('.sp-option').forEach(button=>{
      const {spGroup:g,spValue:v}=button.dataset;
      const active=g==='size'?(customSize?v==='custom':v===`${c.width},${c.height}`):g==='quantity'?(customQuantity?v==='custom':Number(v)===c.quantity):c[g]===v;
      button.setAttribute('aria-pressed',String(active));
      if(g==='material')button.disabled=c.print==='vinyl'&&v!=='white';
    });
    $('#sp-custom-size').hidden=!customSize;$('#sp-custom-quantity').hidden=!customQuantity;
    $('#sp-material-note').textContent=isPaper?'Самоклеящаяся бумага, печать на листах SRA3.':service.kind==='uv-dtf'?'Трансфер для подходящей твёрдой поверхности. Перед серией рекомендуем пробу.':is3D?'Белая или прозрачная плёнка с прозрачным объёмным покрытием.':c.print==='vinyl'?'Для виниловой печати доступна только белая плёнка.':'На прозрачной и голографической плёнке согласуем белую подложку.';
    if(service.variableShape){$('#sp-height').parentElement.hidden=isRound;$('#sp-width').parentElement.firstChild.textContent=isRound?'Диаметр, мм':'Ширина, мм';}
    const sizeValid=Number.isFinite(c.width)&&Number.isFinite(c.height)&&c.width>0&&c.height>0;
    const quantityValid=Number.isSafeInteger(c.quantity)&&c.quantity>0;
    $('#sp-size-error').textContent=sizeValid?'':isRound?'Укажите диаметр больше нуля.':'Укажите ширину и высоту больше нуля.';
    $('#sp-quantity-error').textContent=quantityValid?'':`Введите целое количество от 1 ${isPack?'набора':'штуки'}.`;
    for(const field of ['#sp-width','#sp-height'])$(field).setAttribute('aria-invalid',String(!sizeValid));
    $('#sp-quantity').setAttribute('aria-invalid',String(!quantityValid));
    result=sizeValid&&quantityValid?calculate(c):null;
    if(sizeValid&&quantityValid&&!result)$('#sp-size-error').textContent=isPaper?'Наклейка не помещается на рабочее поле листа. Уменьшите размер.':is3DPack?'Проверьте размеры внутренних стикеров и их количество: элементы должны помещаться на подложке.':'Эти параметры не удалось рассчитать. Проверьте введённые значения.';
    if(is3DPack){
      const capacity=window.TEXT_3D_PACK_CAPACITY(c);
      $('#sp-pack-layout').textContent=`На подложке помещается до ${new Intl.NumberFormat('ru-RU').format(capacity)} элементов при расстоянии 10 мм по расчётной модели.`;
      for(const field of ['sp-sticker-width','sp-sticker-height','sp-per-pack'])$('#'+field).setAttribute('aria-invalid',String(!result));
    }
    if($('#sp-layout-result'))$('#sp-layout-result').textContent=result?isPaper?`${result.perSheet} шт. на листе · ${result.sheets} листов SRA3${result.discount?' · скидка '+Math.round(result.discount*100)+'% на лист':''}`:is3DPack?`${c.perPack} стикеров в наборе · ${new Intl.NumberFormat('ru-RU').format(result.innerQuantity)} стикеров во всём тираже`:extraDescription(c):'';
    const baseline=sizeValid?calculate({...c,quantity:quantities[0]}):null;
    for(const q of quantities){
      const estimate=sizeValid?calculate({...c,quantity:q}):null;
      $(`[data-sp-price="${q}"]`).textContent=estimate?money(estimate.total):'—';
      const discount=estimate&&baseline?Math.round((1-estimate.effectiveUnit/baseline.effectiveUnit)*100):0;
      const badge=$(`[data-sp-discount="${q}"]`);badge.hidden=discount<=0;badge.textContent=`−${discount}%`;
      badge.title=`Экономия на цене за ${unitName} по сравнению с тиражом ${quantities[0]} шт.`;
    }
    $('#sp-total').textContent=result?money(result.total):'—';
    $('#sp-unit').textContent=result?'≈ '+money(result.effectiveUnit):'—';
    $('#sp-mobile-price').textContent=result?money(result.total):'—';
    $('#sp-selected-quantity').textContent=quantityValid?new Intl.NumberFormat('ru-RU').format(c.quantity):'—';
    $('#sp-selected-description').textContent=sizeValid?`${sizeText(c.width,c.height)} · ${materialLabels[c.material]} · ${printLabels[c.print]}`:'';
    $('#sp-surcharge').hidden=!result?.surcharge;
    $('#sp-surcharge').textContent=result?.surcharge?`Включена доплата ${money(result.surcharge)} до минимального чека ${money(service.minimum)}.`:'';
    $('#sp-days').textContent=result?`${result.days} ${result.days%10===1&&result.days%100!==11?'рабочий день':result.days%10>=2&&result.days%10<=4&&(result.days%100<12||result.days%100>14)?'рабочих дня':'рабочих дней'}`:'—';
    $('#sp-add').disabled=!result||busy;$('#sp-mobile-total').disabled=!result||busy;$('#sp-download').disabled=!result;
    $('#sp-copy').disabled=!result;
    const notes=[];
    const lower=is3D?5:50,upper=is3D?5000:10000,tariffCount=is3DPack?c.quantity*c.perPack:c.quantity,area=is3DPack?c.stickerWidth*c.stickerHeight:c.width*c.height;
    if(!isPaper){
      if(tariffCount<lower&&quantityValid)notes.push(`Для тиража меньше ${lower} используется тариф ${lower} шт.${is3DPack?' внутренних стикеров':''}.`);
      if(tariffCount>upper)notes.push(`Для тиража больше ${new Intl.NumberFormat('ru-RU').format(upper)} используется тариф этого количества${is3DPack?' внутренних стикеров':''}.`);
      if(area<400&&sizeValid)notes.push('Для этой площади используется минимальная размерная база 20 × 20 мм.');
      if(area>22500)notes.push('Размер больше табличной базы: цена рассчитывается по продолжению тарифа 100 × 100 — 150 × 150 мм. Возможность изготовления согласуем по макету.');
    }else if(result)notes.push(`Рабочее поле ${result.workingWidth} × ${result.workingHeight} мм, зазор ${result.gap} мм. Выбираем более вместительную раскладку из двух ориентаций.`);
    $('#sp-tariff-note').textContent=notes.join(' ');
    if(previous)$('#sp-add').innerHTML='Сохранить изменения';
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-sp-group]');if(!button)return;
    const g=button.dataset.spGroup,v=button.dataset.spValue;
    if(g==='print'){state.print=v;if(v==='vinyl')state.material='white';}
    if(g==='material')state.material=v;
    if(g==='cut')state.cut=v;
    if(g==='shape'){
      const current=configuration();state.width=current.width;state.height=current.height;state.shape=v;isRound=v==='round';if(isRound)state.height=state.width;
      $('#sp-width').value=state.width;$('#sp-height').value=state.height;
      customSize=!sizePresets().some(([w,h])=>w===state.width&&h===state.height);renderSizes();
    }
    if(g==='size'){customSize=v==='custom';if(!customSize){[state.width,state.height]=v.split(',').map(Number);$('#sp-width').value=state.width;$('#sp-height').value=state.height;}}
    if(g==='quantity'){customQuantity=v==='custom';if(!customQuantity){state.quantity=Number(v);$('#sp-quantity').value=state.quantity;}}
    sync();
    if(v==='custom')$(g==='size'?'#sp-width':'#sp-quantity').focus();
  });
  for(const field of ['#sp-width','#sp-height','#sp-quantity','#sp-sticker-width','#sp-sticker-height','#sp-per-pack'])$(field)?.addEventListener('input',sync);
  function showFile(){
    $('#sp-file-label').textContent=selectedFile?selectedFile.name:'Загрузите макет';
    $('#sp-file-status').textContent=selectedFile?`Выбран: ${(selectedFile.size/1024/1024).toFixed(2)} МБ. Сохраним вместе с расчётом в корзине.`:'Можно прикрепить позже в корзине.';
    $('#sp-remove-file').hidden=!selectedFile;
  }
  function selectFile(file){
    const error=window.TEXT_FILES.validate(file);
    if(error){$('#sp-file-status').textContent=error;$('#sp-file').value='';return;}
    fileChanged=true;selectedFile=file;showFile();
  }
  $('#sp-file').addEventListener('change',event=>{if(event.target.files[0])selectFile(event.target.files[0]);});
  $('#sp-remove-file').addEventListener('click',()=>{fileChanged=true;selectedFile=null;$('#sp-file').value='';showFile();});
  $('#sp-hero-upload').addEventListener('click',()=>{$('#calculator').scrollIntoView({behavior:'smooth'});$('#sp-file').click();});
  const zone=$('#sp-file-zone');
  for(const name of ['dragenter','dragover'])zone.addEventListener(name,event=>{event.preventDefault();zone.classList.add('is-dragging');});
  for(const name of ['dragleave','drop'])zone.addEventListener(name,event=>{event.preventDefault();zone.classList.remove('is-dragging');});
  zone.addEventListener('drop',event=>{if(event.dataTransfer.files[0])selectFile(event.dataTransfer.files[0]);});
  $('#stickerpack-form').addEventListener('submit',async event=>{
    event.preventDefault();sync();if(!result||busy)return;
    const quote={...result},orderFile=selectedFile,comment=$('#sp-comment').value.trim();
    const retainedFile=!fileChanged&&!orderFile?previous:null;
    busy=true;sync();
    const key=previous?.key||crypto.randomUUID(),c=configuration();
    try{
      if(orderFile)await window.TEXT_FILES.save(key,orderFile);
      else if(previous?.fileName&&fileChanged)await window.TEXT_FILES.remove(key);
      const details=[description(c),`За ${unitName}: ${money(quote.unit)}; срок: ${quote.days} раб. дн. после согласования`];
      if(comment)details.push(`Комментарий: ${comment}`);
      window.TEXT_APP.upsertCalculatedItem({key,id:service.id,configuration:c,comment,description:details.join('\n'),price:quote.subtotal,unit:quote.unit,days:quote.days,pricingGroup:service.pricingGroup,fileName:orderFile?.name||retainedFile?.fileName||null,fileSize:orderFile?.size||retainedFile?.fileSize||null});
      // Keep the calculator visible; the header badge and toast confirm the addition.
      window.TEXT_APP.notify(previous?'Расчёт в корзине обновлён':service.name+' добавлены в корзину');
    }catch(error){$('#sp-file-status').textContent='Не удалось сохранить макет в браузере. Попробуйте ещё раз или уберите файл и прикрепите позже.';}
    finally{busy=false;sync();}
  });
  $('#sp-mobile-total').addEventListener('click',()=>{
    if(!result){$('#calculator').scrollIntoView({behavior:'smooth'});return;}
    $('#stickerpack-form').requestSubmit();
  });
  $('#sp-download').addEventListener('click',()=>{
    if(!result)return;
    const text=['СТУДИЯ ПЕЧАТИ ТЕКСТ','Расчёт: '+service.name,description(configuration()),`Стоимость тиража: ${money(result.subtotal)}`,`Доплата до минимального чека: ${money(result.surcharge)}`,`Итого: ${money(result.total)}`,`Цена за ${unitName}: ${money(result.unit)}`,`Срок: ${result.days} рабочих дней после согласования макета`,selectedFile?`Макет: ${selectedFile.name}`:'',`Комментарий: ${$('#sp-comment').value.trim()}`,'','Барнаул, проспект Строителей, 11','+7 (923) 654-78-96','tekkkst@yandex.ru'].join('\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',text],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`ТЕКСТ — ${service.name}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  let copying=false;
  $('#sp-copy').addEventListener('click',async ()=>{
    const text=sharing.text(configuration(),siteRoot,service.id);if(!text||copying)return;
    copying=true;
    try{
      try{
        if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
      }catch{
        const field=document.createElement('textarea');field.value=text;field.readOnly=true;
        field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
        document.body.append(field);field.select();field.setSelectionRange(0,field.value.length);
        let copied=false;try{copied=document.execCommand('copy');}finally{field.remove();$('#sp-copy').focus({preventScroll:true});}
        if(!copied)throw new Error('Copy blocked');
      }
      window.TEXT_APP.notify('Параметры, цены и ссылка скопированы');
    }catch{window.TEXT_APP.notify('Не удалось скопировать. Разрешите доступ к буферу обмена в браузере.');}
    finally{copying=false;}
  });
  if(previous?.fileName){
    $('#sp-file-status').textContent='Открываем сохранённый макет…';
    window.TEXT_FILES.get(previous.key).then(file=>{
      if(fileChanged)return;
      if(file){selectedFile=file;showFile();}else $('#sp-file-status').textContent='Ранее выбранный макет не найден. Прикрепите его ещё раз.';
    }).catch(()=>{if(!fileChanged)$('#sp-file-status').textContent='Не удалось открыть сохранённый макет.';}).finally(()=>{busy=false;sync();});
  }
  let mobileFrame=0;
  function updateMobileTotal(){
    mobileFrame=0;
    const add=$('#sp-add').getBoundingClientRect(),calc=$('#calculator').getBoundingClientRect();
    const visible=add.bottom>0&&add.top<innerHeight;
    $('#sp-mobile-total').classList.toggle('is-visible',!visible&&calc.top<innerHeight);
  }
  function scheduleMobileTotal(){if(!mobileFrame)mobileFrame=requestAnimationFrame(updateMobileTotal);}
  window.addEventListener('scroll',scheduleMobileTotal,{passive:true});
  window.addEventListener('resize',scheduleMobileTotal,{passive:true});
  sync();updateMobileTotal();
})();
