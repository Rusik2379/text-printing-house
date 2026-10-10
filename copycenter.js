(() => {
  'use strict';
  const root=document.querySelector('[data-copycenter-service],[data-leaflet-service],[data-uv-service]');
  if(!root)return;
  const leaflet=Boolean(root.dataset.leafletService);
  const uv=Boolean(root.dataset.uvService),customUI=uv?window.TEXT_UV_UI:leaflet?window.TEXT_LEAFLET_UI:null;
  const id=root.dataset.uvService||root.dataset.leafletService||root.dataset.copycenterService;
  const pricing=uv?window.TEXT_UV_PRICING:leaflet?window.TEXT_LEAFLET_PRICING:window.TEXT_COPYCENTER_PRICING;
  const data=uv?window.TEXT_UV_DATA:leaflet?window.TEXT_LEAFLET_DATA:window.TEXT_COPYCENTER_DATA;
  const services=uv?window.TEXT_UV_SERVICES:leaflet?window.TEXT_LEAFLET_SERVICES:window.TEXT_COPYCENTER_SERVICES;
  const form=root.querySelector('#copycenter-form'),controls=root.querySelector('[data-cc-fields]');
  const error=root.querySelector('[data-cc-error]'),total=root.querySelector('[data-cc-total]');
  const days=root.querySelector('[data-cc-days]'),breakdown=root.querySelector('[data-cc-breakdown]');
  const add=root.querySelector('[data-cc-add]'),download=root.querySelector('[data-cc-download]');
  const copy=root.querySelector('[data-cc-copy]'),comment=root.querySelector('[data-cc-comment]');
  const fileInput=root.querySelector('[data-cc-file]'),fileStatus=root.querySelector('[data-cc-file-status]');
  const fileLabel=root.querySelector('[data-cc-file-label]'),removeFile=root.querySelector('[data-cc-remove-file]');
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const money=q=>q.range?`${format(q.price)}–${format(q.upper)} ₽`:`${format(q.price)} ₽`;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Parameter columns, quantity cell and presets; pricing stays in the workbook API.
  const layout=customUI?customUI.layouts[id]:{
    '1.1':{columns:[['B4','B5','B6'],['B8','colorRate']],quantity:'B7',unit:'стр.',label:'Количество страниц',presets:[10,25,50,100,300,500]},
    '1.2':{columns:[['B4','B5'],['B6']],quantity:'B7',unit:'прог.',label:'Количество прогонов',presets:[10,25,50,100,200,500]},
    '1.3':{columns:[['B4'],['B5','B6','B7']],quantity:'B8',unit:'шт.',label:'Количество фотографий',presets:[1,10,36,50,100,200]},
    '1.4':{columns:[['B4'],['B5']],quantity:'B6',unit:'шт.',label:'Количество документов',presets:[1,10,20,25,50,100]},
    '1.5':{columns:[['B4','B5'],['B7']],quantity:'B8',unit:'экз.',label:'Количество экземпляров',presets:[1,5,10,12,25,50]},
    '1.6':{columns:[['B4','B5','B6','B12'],['B7','B8','B9','B13','B14']],quantity:'B11',unit:'экз.',label:'Количество экземпляров',presets:[1,2,3,5,10,20]},
    '1.7':{columns:[['B5'],['B6']],quantity:'B7',unit:'прог.',label:'Количество прогонов',presets:[1,2,10,25,50,100]},
    '1.8':{columns:[],quantity:'B7',unit:'шт.',label:'Количество этикеток',presets:[50,100,200,500,1000,2000]},
    '1.9':{columns:[['B4','B5'],['B7']],quantity:'B8',unit:'экз.',label:'Количество экземпляров',presets:[10,25,50,100,200,500]}
  }[id];
  const hints=customUI?customUI.hints:{
    '1.1':{B7:'Считаются печатные страницы, а не листы. Разные комплекты добавляйте отдельными позициями.'},
    '1.2':{B7:'Один прогон — одна скопированная сторона. Учитывайте обороты и число комплектов.'},
    '1.3':{B5:'До A3 — сатин. Для A2, A1 и своего размера доступна также матовая бумага.'},
    '1.5':{B7:'Выбирайте по количеству физических листов и толщине блока.'},
    '1.6':{B7:'От 15 до 300 физических листов в одном переплёте.',B13:'Количество мультифор на весь заказ.'},
    '1.7':{B7:'Каждая отсканированная сторона — отдельный прогон.'},
    '1.8':{B7:'Минимальный тираж — 50 этикеток.'},
    '1.9':{B4:'Чёрно-белые и цветные страницы в сумме должны быть кратны четырём.',B8:'Минимум 10 экземпляров, готовый формат A5.'}
  };
  const labels={'чб':'Чёрно-белая','цветная':'Цветная','Ч/Б':'Чёрно-белая','Цвет':'Цветная','односторонняя':'Одна сторона','двусторонняя':'Две стороны','Твердый':'Твёрдый','ПЕЧАТАЕМ':'С нашей печатью','ПЕЧАТЬ ВАША':'Ваш готовый блок','ДА':'Да','НЕТ':'Нет','БЕЛАЯ':'Белая','ГОЛУБОЙ':'Голубая','ЖЕЛТЫЙ':'Жёлтая','ЗЕЛЕНЫЙ':'Зелёная','РОЗОВЫЙ':'Розовая'};
  let values=pricing.defaults(id),quote,editKey=null,existing=null,pendingFile=null,fileRemoved=false,busy=false,copying=false;
  const params=new URLSearchParams(location.search),requestedKey=params.get('edit');
  if(requestedKey){
    existing=window.TEXT_APP.getCart().find(item=>item.key===requestedKey&&item.id===id&&item.configuration);
    if(existing){editKey=existing.key;values=pricing.normalize(id,existing.configuration);comment.value=existing.comment||'';}
    else window.TEXT_APP.notify('Позиция не найдена в корзине этого браузера. Можно создать новый расчёт.');
  }else if(params.has('calc')){
    try{
      const saved=JSON.parse(params.get('calc'));
      if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Invalid calculation');
      const allowed=new Set([...data[id].schema.fields.map(field=>field.cell),...(customUI?[]:['colorRate'])]);
      values=pricing.normalize(id,Object.fromEntries(Object.entries(saved).filter(([key])=>allowed.has(key))));
      if(!pricing.quote(id,values).valid)throw Error('Invalid calculation');
    }catch{values=pricing.defaults(id);window.TEXT_APP.notify('Параметры ссылки некорректны. Открыт стандартный расчёт.');}
  }
  let customQuantity=!layout.presets.includes(Number(values[layout.quantity]));
  function numericInput(field){
    const hint=hints[id]?.[field.cell];
    if(leaflet&&field.options)return `<label class="cc-number" for="cc-${field.cell}">Другой тираж<select id="cc-${field.cell}" data-cc-cell="${field.cell}">${field.options.map(v=>`<option value="${escape(v)}"${String(values[field.cell])===v?' selected':''}>${format(Number(v))} шт.</option>`).join('')}</select></label>`;
    return `<label class="cc-number" for="cc-${field.cell}">${field.cell===layout.quantity?'Ваше количество':escape(field.label)}<input id="cc-${field.cell}" name="${field.cell}" data-cc-cell="${field.cell}" type="number" inputmode="${field.step===1?'numeric':'decimal'}" min="${field.min}"${field.max===undefined?'':` max="${field.max}"`} step="${field.step}" required value="${escape(values[field.cell])}"${hint?` aria-describedby="hint-${field.cell}"`:''}></label>`;
  }
  function fieldHTML(field){
    const hint=hints[id]?.[field.cell];
    if(!field.options)return `<div class="cc-field" data-cc-field="${field.cell}">${numericInput(field)}${hint?`<p class="cc-field-note" id="hint-${field.cell}">${escape(hint)}</p>`:''}${customUI?.extra?.(field,id)||''}</div>`;
    return `<fieldset class="cc-field" data-cc-field="${field.cell}"><legend>${escape(field.label)}</legend><div class="cc-choice-stack">${field.options.map(value=>`<button class="cc-option" type="button" data-cc-choice="${field.cell}" data-cc-value="${escape(value)}" aria-pressed="${String(values[field.cell])===value}"${field.locked?' disabled':''}>${escape(customUI?customUI.choiceLabel(id,field,value):labels[value]||value)}</button>`).join('')}</div>${hint?`<p class="cc-field-note" id="hint-${field.cell}">${escape(hint)}</p>`:''}</fieldset>`;
  }
  function drawFields(focusCell=null){
    const fields=pricing.fields(id,values);
    if(id==='1.1'&&values.B4==='А4'&&values.B5==='цветная')fields.push({cell:'colorRate',label:'Тариф цветной печати, ₽/сторона',options:['15','20','25','30']});
    const columns=layout.columns.map(cells=>`<div class="cc-param-column">${cells.map(cell=>fields.find(field=>field.cell===cell)).filter(Boolean).map(fieldHTML).join('')}</div>`).join('');
    const quantity=fields.find(field=>field.cell===layout.quantity);
    controls.innerHTML=(columns||`<div class="cc-fixed-service"><h3>Параметры печати</h3><div class="cc-choice-stack"><span class="cc-included">58 × 40 мм</span><span class="cc-included">Термопечать · чёрный цвет</span><span class="cc-included">TSC TE200 · 203 dpi</span></div><p class="cc-field-note">Этикетки для товаров, маркировки и штрихкодов. Печать на термобумаге без ламинации.</p><a class="cc-requirements-link" href="#service-requirements">Требования к макету →</a></div>`)+
      `<fieldset class="cc-field cc-quantity" data-cc-field="${layout.quantity}"><legend>${layout.label}</legend><div class="cc-quantity-stack">${layout.presets.map(n=>`<div class="cc-quantity-row"><button class="cc-option" type="button" data-cc-quantity="${n}" aria-pressed="false">${format(n)} ${layout.unit}</button><span class="cc-quantity-price" data-cc-price="${n}">—</span></div>`).join('')}<button type="button" class="cc-option cc-custom-option" data-cc-quantity="custom" aria-pressed="false">Другое количество</button></div><div class="cc-custom-field" data-cc-custom${customQuantity?'':' hidden'}>${numericInput(quantity)}</div>${hints[id]?.[layout.quantity]?`<p class="cc-field-note" id="hint-${layout.quantity}">${escape(hints[id][layout.quantity])}</p>`:''}</fieldset>`;
    if(id==='1.1'&&values.B4==='А4'&&values.B5==='цветная')controls.querySelector('[data-cc-field="colorRate"]').insertAdjacentHTML('beforeend','<p class="cc-field-note">Зависит от заполнения страницы. Подтвердим тариф после проверки файла.</p>');
    if(focusCell){
      const buttons=[...controls.querySelectorAll('[data-cc-choice]')];
      (buttons.find(button=>button.dataset.ccChoice===focusCell&&button.getAttribute('aria-pressed')==='true')||controls.querySelector(`[data-cc-cell="${focusCell}"]`))?.focus({preventScroll:true});
    }
  }
  function updateQuote(){
    quote=pricing.quote(id,values);
    controls.querySelectorAll('[aria-invalid]').forEach(input=>input.removeAttribute('aria-invalid'));
    error.textContent=quote.valid?'':quote.error;error.hidden=quote.valid;
    if(!quote.valid){
      if(quote.cell)controls.querySelector(`[data-cc-cell="${quote.cell}"], [data-cc-field="${quote.cell}"]`)?.setAttribute('aria-invalid','true');
      total.textContent='Проверьте параметры';days.textContent='Срок появится после расчёта';breakdown.innerHTML='';
    }else{
      const n=quote.days,word=n%10===1&&n%100!==11?'рабочий день':[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?'рабочих дня':'рабочих дней';
      total.textContent=money(quote);days.textContent=`${n} ${word} после согласования`;
      breakdown.innerHTML=quote.details.map(item=>`<div><dt>${escape(item.label)}</dt><dd>${escape(typeof item.value==='number'?format(item.value):item.value)}</dd></div>`).join('');
    }
    controls.querySelectorAll('[data-cc-quantity]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.ccQuantity==='custom'?customQuantity:!customQuantity&&Number(button.dataset.ccQuantity)===Number(values[layout.quantity])));
    controls.querySelector('[data-cc-custom]').hidden=!customQuantity;
    for(const n of layout.presets){
      const preset=pricing.quote(id,{...values,[layout.quantity]:n});
      controls.querySelector(`[data-cc-price="${n}"]`).textContent=preset.valid?money(preset):'—';
      if(customUI)controls.querySelector(`[data-cc-quantity="${n}"]`).disabled=!preset.valid;
    }
    root.querySelector('[data-cc-range-note]').hidden=!(quote.valid&&quote.range);
    root.querySelector('[data-cc-breakdown-panel]').hidden=!quote.valid;
    add.disabled=busy||!quote.valid;download.disabled=copy.disabled=!quote.valid;
    add.textContent=busy?'Сохраняем…':editKey?'Сохранить изменения':'В корзину';
  }
  controls.addEventListener('click',event=>{
    const choice=event.target.closest('[data-cc-choice]'),quantity=event.target.closest('[data-cc-quantity]');
    if(choice){values[choice.dataset.ccChoice]=choice.dataset.ccValue;values=pricing.normalize(id,values);drawFields(choice.dataset.ccChoice);updateQuote();}
    if(quantity){
      customQuantity=quantity.dataset.ccQuantity==='custom';
      if(!customQuantity){values[layout.quantity]=Number(quantity.dataset.ccQuantity);controls.querySelector(`[data-cc-cell="${layout.quantity}"]`).value=values[layout.quantity];}
      updateQuote();if(customQuantity)controls.querySelector(`[data-cc-cell="${layout.quantity}"]`).focus({preventScroll:true});
    }
  });
  controls.addEventListener('input',event=>{
    const input=event.target.closest('[data-cc-cell]');if(!input)return;
    if(input.tagName==='SELECT')return;
    values[input.dataset.ccCell]=input.value;updateQuote();
  });
  controls.addEventListener('change',event=>{
    const select=event.target.closest('select[data-cc-cell]');if(!select)return;
    values[select.dataset.ccCell]=select.value;updateQuote();
  });
  root.querySelector('[data-cc-reset]').addEventListener('click',()=>{
    values=pricing.defaults(id);customQuantity=!layout.presets.includes(Number(values[layout.quantity]));drawFields();updateQuote();
  });
  function showFile(){
    const name=pendingFile?.name||(!fileRemoved&&existing?.fileName);
    fileLabel.textContent=name||'Загрузите макет';removeFile.hidden=!name;
    fileStatus.textContent=name?'Макет выбран. При отправке запроса прикрепите его к письму вручную.':'PDF, изображения, исходники или ZIP · до 100 МБ. Можно прикрепить позже в корзине.';
  }
  function selectFile(file){
    const message=window.TEXT_FILES.validate(file);
    if(message){fileStatus.textContent=message;fileInput.value='';return;}
    pendingFile=file;fileRemoved=false;showFile();
  }
  fileInput.addEventListener('change',()=>{if(fileInput.files[0])selectFile(fileInput.files[0]);});
  removeFile.addEventListener('click',()=>{pendingFile=null;fileRemoved=true;fileInput.value='';showFile();});
  const zone=root.querySelector('[data-cc-file-zone]');
  for(const name of ['dragenter','dragover'])zone.addEventListener(name,event=>{event.preventDefault();zone.classList.add('is-dragging');});
  for(const name of ['dragleave','drop'])zone.addEventListener(name,event=>{event.preventDefault();zone.classList.remove('is-dragging');});
  zone.addEventListener('drop',event=>{if(event.dataTransfer.files[0])selectFile(event.dataTransfer.files[0]);});
  function shareURL(){
    const url=new URL(location.href);url.search='';url.hash='calculator';
    url.searchParams.set('calc',JSON.stringify(quote.configuration));return url.href;
  }
  function calculationText(){
    const name=pendingFile?.name||(!fileRemoved&&existing?.fileName);
    return [`ТЕКСТ — ${services[id].name}`,quote.description,`Стоимость: ${money(quote)}`,`Срок: ${quote.days} раб. дн. после полного согласования`,
      ...quote.details.map(item=>item.label+': '+item.value),comment.value.trim()?`Комментарий: ${comment.value.trim()}`:'',
      quote.range?'Для цветной печати A3 итог уточняется после проверки заполнения страниц.':'Стоимость рассчитана для выбранных параметров.',
      'Доставка и подготовка макета согласуются отдельно.',`Ссылка на расчёт: ${shareURL()}`,name?`Макет: ${name} — прикрепить к письму вручную.`:'',
      'Заказ подтверждается студией. Отправьте расчёт и файл на tekkkst@yandex.ru.'].filter(Boolean).join('\n');
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();updateQuote();if(busy||!quote.valid||!form.reportValidity())return;
    const q=quote,key=editKey||crypto.randomUUID(),orderFile=pendingFile,removed=fileRemoved,note=comment.value.trim();
    const current=editKey?window.TEXT_APP.getCart().find(row=>row.key===editKey&&row.id===id):null;
    if(editKey&&!current)window.TEXT_APP.notify('Позиция была удалена из корзины. Расчёт добавится заново.');
    const item={key,id,description:q.description+(note?'\nКомментарий: '+note:''),comment:note,price:q.price,priceUpper:q.upper,configuration:q.configuration};
    if(current?.fileName&&!removed){item.fileName=current.fileName;item.fileSize=current.fileSize;}
    busy=true;form.setAttribute('aria-busy','true');updateQuote();
    try{
      if(orderFile){await window.TEXT_FILES.save(key,orderFile);item.fileName=orderFile.name;item.fileSize=orderFile.size;}
      window.TEXT_APP.upsertCalculatedItem(item);
      if(!window.TEXT_APP.getCart().some(row=>row.key===key&&row.price===item.price&&row.description===item.description))throw Error('Storage unavailable');
      if(removed&&current?.fileName&&!orderFile)await window.TEXT_FILES.remove(key);
      if(editKey){existing=item;if(pendingFile===orderFile)pendingFile=null;fileRemoved=false;showFile();}
      // New calculations stay in create mode, so the next configuration becomes a separate row.
      window.TEXT_APP.notify(current?'Параметры обновлены в корзине':'Расчёт добавлен в корзину');
    }catch{window.TEXT_APP.notify('Не удалось сохранить заказ в браузере. Скачайте расчёт и отправьте его в студию.');}
    finally{busy=false;form.removeAttribute('aria-busy');updateQuote();}
  });
  download.addEventListener('click',()=>{
    updateQuote();if(!quote.valid)return;
    const url=URL.createObjectURL(new Blob(['\ufeff',calculationText()],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`ТЕКСТ — ${services[id].name}.txt`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  copy.addEventListener('click',async()=>{
    updateQuote();if(!quote.valid||copying)return;copying=true;
    try{
      const text=calculationText();
      try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(text);}
      catch{
        const field=document.createElement('textarea');field.value=text;field.readOnly=true;
        field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';document.body.append(field);field.select();field.setSelectionRange(0,field.value.length);
        let copied=false;try{copied=document.execCommand('copy');}finally{field.remove();copy.focus({preventScroll:true});}
        if(!copied)throw Error('Copy blocked');
      }
      window.TEXT_APP.notify('Параметры, стоимость и ссылка скопированы');
    }catch{window.TEXT_APP.notify('Не удалось скопировать расчёт. Скачайте его файлом.');}
    finally{copying=false;}
  });
  drawFields();updateQuote();showFile();
})();
