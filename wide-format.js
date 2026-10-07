(() => {
  'use strict';
  const siteRoot=new URL('.',document.currentScript.src).href;
  const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
  const format=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v),money=v=>format(v)+' ₽';
  const areaFormat=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(v);
  const sharing=window.TEXT_WIDE_SHARING,service=window.TEXT_WIDE_SERVICES[document.body.dataset.wideService];
  const calculate=c=>window.TEXT_QUOTE_WIDE_SERVICE(service.id,c),unitName='изделие';
  const printLabels=service.prints,materialLabels=service.materials,presets=service.sizes,quantities=service.quantities;
  const query=new URLSearchParams(location.search),editingKey=query.get('edit');
  const previous=window.TEXT_APP.getCart().find(item=>item.key===editingKey&&item.id===service.id);
  const state={...sharing.read(query,service.id),...previous?.configuration};
  let customSize=!presets.some(([w,h])=>w===state.width&&h===state.height),customQuantity=!quantities.includes(state.quantity);
  let selectedFile=null,result=null,busy=Boolean(previous?.fileName),fileChanged=false;
  $('#sp-comment').value=previous?.comment||'';
  for(const key of ['width','height','quantity'])$('#sp-'+key).value=state[key];
  const choice=(group,value,label)=>`<button type="button" class="sp-option${value==='custom'?' sp-custom-option':''}" data-sp-group="${group}" data-sp-value="${value}" aria-pressed="false">${label}</button>`;
  $('#sp-print-options').innerHTML=Object.entries(printLabels).map(([key,label])=>choice('print',key,label)).join('');
  $('#sp-material-options').innerHTML=Object.entries(materialLabels).map(([key,label])=>choice('material',key,label)).join('');
  if($('#sp-thickness-options'))$('#sp-thickness-options').innerHTML=(service.model==='pvc'?['3','5']:['5']).map(v=>choice('thickness',v,v+' мм')).join('');
  if($('#sp-complexity-options'))$('#sp-complexity-options').innerHTML=Object.entries(sharing.labels.complexity).map(([v,label])=>choice('complexity',v,label)).join('');
  const sizeText=(w,h)=>`${format(w)} × ${format(h)} мм`;
  $('#sp-size-options').innerHTML=presets.map(([w,h])=>choice('size',`${w},${h}`,sizeText(w,h))).join('')+choice('size','custom','Другой размер');
  $('#sp-quantity-options').innerHTML=quantities.map(q=>`<div class="sp-quantity-row">${choice('quantity',q,format(q)+' шт.')}<span class="sp-quantity-price" data-sp-price="${q}">—</span><span class="sp-discount" data-sp-discount="${q}" hidden></span></div>`).join('')+choice('quantity','custom','Другое количество');
  function configuration(){return {...state,width:customSize?Number($('#sp-width').value):state.width,height:customSize?Number($('#sp-height').value):state.height,quantity:customQuantity?Number($('#sp-quantity').value):state.quantity};}
  function description(c){return sharing.description(c,service.id)+` · ${format(c.quantity)} шт.`;}
  function sync(){
    const c=configuration(),error=window.TEXT_WIDE_ERROR(service.id,c);
    result=error?null:calculate(c);
    $$('.sp-option').forEach(button=>{
      const {spGroup:g,spValue:v}=button.dataset;
      const active=g==='size'?(customSize?v==='custom':v===`${c.width},${c.height}`):g==='quantity'?(customQuantity?v==='custom':Number(v)===c.quantity):c[g]===v;
      button.setAttribute('aria-pressed',String(active));
      if(g==='material')button.disabled=!service.materialsByPrint[c.print].includes(v);
    });
    $('#sp-custom-size').hidden=!customSize;$('#sp-custom-quantity').hidden=!customQuantity;
    const quantityValid=Number.isSafeInteger(c.quantity)&&c.quantity>0;
    $('#sp-quantity-error').textContent=quantityValid?'':'Введите целое количество от 1 штуки.';
    $('#sp-size-error').textContent=quantityValid?(error||(!result?'Для этих параметров нужен индивидуальный расчёт.':'')):'';
    for(const field of ['#sp-width','#sp-height'])$(field).setAttribute('aria-invalid',String(Boolean(error)&&quantityValid));
    $('#sp-quantity').setAttribute('aria-invalid',String(!quantityValid));
    $('#sp-size-note').textContent=service.kind==='cut'?'От 200 × 200 до 600 × 2000 мм. Допускается поворот.':service.model==='pvc'?'До 1450 × 2000 мм. Готовый размер панели.':service.model==='foam'?'От 200 × 200 до 1450 × 1350 мм.':service.model==='poster'?'A2: 420 × 594, A1: 594 × 841, A0: 841 × 1189 мм. Можно указать свой размер.':'Размер одного изделия. Крупный формат согласуем перед запуском.';
    $('#sp-material-note').textContent=service.model==='film'?(c.print==='interior'?'Для интерьерной печати доступны белые плёнки.':'На прозрачной плёнке белый цвет согласуем по макету.'):service.model==='canvas'?'Исполнение рамки, подрамник и натяжку согласуем перед запуском.':service.kind==='mount'?'Печать на плёнке и накатка на выбранную основу.':service.kind==='cut'?'Оттенок цветной или металлизированной плёнки согласуем по образцу.':'';
    const baseline=calculate({...c,quantity:quantities[0]});
    for(const q of quantities){
      const estimate=calculate({...c,quantity:q});
      $(`[data-sp-price="${q}"]`).textContent=estimate?money(estimate.total):'—';
      const discount=estimate&&baseline?Math.round((1-estimate.effectiveUnit/baseline.effectiveUnit)*100):0;
      const badge=$(`[data-sp-discount="${q}"]`);badge.hidden=discount<=0;badge.textContent=`−${discount}%`;
      badge.title=`Экономия на цене за изделие по сравнению с тиражом ${quantities[0]} шт.`;
    }
    $('#sp-total').textContent=result?money(result.total):'—';
    $('#sp-unit').textContent=result?'≈ '+money(result.effectiveUnit):'—';
    $('#sp-mobile-price').textContent=result?money(result.total):'—';
    $('#sp-selected-quantity').textContent=quantityValid?format(c.quantity):'—';
    $('#sp-selected-description').textContent=description(c);
    $('#sp-layout-result').textContent=result?service.kind==='area'?`Площадь изделия: ${areaFormat(result.area)} м² · всего: ${areaFormat(result.totalArea)} м² · тариф: ${money(result.rate)}/м²`:`Площадь изделия: ${areaFormat(result.area)} м²`:'';
    $('#sp-surcharge').hidden=!result?.surcharge;
    $('#sp-surcharge').textContent=result?.surcharge?`Включена доплата ${money(result.surcharge)} до минимального чека ${money(service.minimum)}.`:'';
    $('#sp-days').textContent=result?`${result.days} ${result.days%10===1&&result.days%100!==11?'рабочий день':result.days%10>=2&&result.days%10<=4&&(result.days%100<12||result.days%100>14)?'рабочих дня':'рабочих дней'}`:'—';
    $('#sp-add').disabled=!result||busy;$('#sp-mobile-total').disabled=!result||busy;$('#sp-download').disabled=!result;$('#sp-copy').disabled=!result;
    $('#sp-manual').hidden=Boolean(error)||Boolean(result);
    const notes=[];
    if(service.kind==='area'&&result){if(result.totalArea<1)notes.push('Для площади заказа меньше 1 м² применяется тариф 1 м².');if(result.totalArea>20)notes.push('Для площади заказа больше 20 м² применяется тариф 20 м².');}
    if(service.kind==='cut'&&c.quantity>50)notes.push('Для тиража больше 50 шт. цена за изделие фиксируется на уровне тарифа 50 шт.');
    if(service.kind==='mount'&&c.quantity>50)notes.push('Стоимость продолжает тариф 25–50 шт.; возможность изготовления и цену большого тиража подтвердим при согласовании.');
    if(service.model==='pvc'&&c.width*c.height<40000)notes.push('Для площади меньше 200 × 200 мм применяется минимальная размерная база.');
    $('#sp-tariff-note').textContent=notes.join(' ');
    if(previous)$('#sp-add').textContent='Сохранить изменения';
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-sp-group]');if(!button||button.disabled)return;
    const g=button.dataset.spGroup,v=button.dataset.spValue;
    if(['print','material','thickness','complexity'].includes(g))state[g]=v;
    if(g==='print'&&!service.materialsByPrint[v].includes(state.material))state.material=service.materialsByPrint[v][0];
    if(g==='size'){customSize=v==='custom';if(!customSize){[state.width,state.height]=v.split(',').map(Number);$('#sp-width').value=state.width;$('#sp-height').value=state.height;}}
    if(g==='quantity'){customQuantity=v==='custom';if(!customQuantity){state.quantity=Number(v);$('#sp-quantity').value=state.quantity;}}
    sync();if(v==='custom')$(g==='size'?'#sp-width':'#sp-quantity').focus();
  });
  for(const field of ['#sp-width','#sp-height','#sp-quantity'])$(field).addEventListener('input',sync);
  $('#sp-manual').addEventListener('click',()=>{
    const c=configuration();if(result||window.TEXT_WIDE_ERROR(service.id,c))return;
    const comment=[description(c),'Стоимость: индивидуальный расчёт',$('#sp-comment').value.trim()].filter(Boolean).join('\n');
    window.TEXT_APP.prepareServiceRequest({id:service.id,comment,file:selectedFile});
  });
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
  $('#wide-format-form').addEventListener('submit',async event=>{
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
      window.TEXT_APP.openCart();
      window.TEXT_APP.notify(previous?'Расчёт в корзине обновлён':'Услуга добавлена в корзину');
    }catch(error){$('#sp-file-status').textContent='Не удалось сохранить макет в браузере. Попробуйте ещё раз или уберите файл и прикрепите позже.';}
    finally{busy=false;sync();}
  });
  $('#sp-mobile-total').addEventListener('click',()=>{
    if(!result){$('#calculator').scrollIntoView({behavior:'smooth'});return;}
    $('#wide-format-form').requestSubmit();
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
