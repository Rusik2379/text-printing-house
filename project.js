(() => {
  'use strict';
  const root=document.querySelector('[data-project-service]');
  if(!root)return;
  const id=root.dataset.projectService,pricing=window.TEXT_PROJECT_PRICING;
  const form=root.querySelector('#copycenter-form'),controls=root.querySelector('[data-cc-fields]');
  const error=root.querySelector('[data-cc-error]'),total=root.querySelector('[data-cc-total]');
  const days=root.querySelector('[data-cc-days]'),breakdown=root.querySelector('[data-cc-breakdown]');
  const add=root.querySelector('[data-cc-add]'),download=root.querySelector('[data-cc-download]');
  const copy=root.querySelector('[data-cc-copy]'),comment=root.querySelector('[data-cc-comment]');
  const fileInput=root.querySelector('[data-cc-file]'),fileStatus=root.querySelector('[data-cc-file-status]');
  const fileLabel=root.querySelector('[data-cc-file-label]'),removeFile=root.querySelector('[data-cc-remove-file]');
  const defaultFileLabel=fileLabel.textContent,defaultFileHint=fileStatus.textContent;
  const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const money=q=>q.range?`${format(q.price)}–${format(q.upper)} ₽`:`${format(q.price)} ₽`;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Parameter columns, quantity cell and presets; pricing stays in the workbook API.
  const schema=window.TEXT_PROJECT_DATA[id].schema;
  const layout={
    '2.1':{columns:[['B4','B6','B8'],['B5','B7','B9']],presets:[]},
    '2.2':{columns:[['B4','B5'],['B7']],quantity:'B8',unit:'экз.',label:'Количество комплектов',presets:[1,5,10,12,25,50]},
    '2.3':{columns:[['B4']],quantity:'B5',unit:'шт.',label:'Количество листов',presets:[1,5,10,25,50,100]},
    '2.4':{columns:[['B5'],['B6']],quantity:'B7',unit:'прог.',label:'Количество прогонов',presets:[1,2,10,25,50,100]},
    '2.5':{columns:[['B4','B6','B8'],['B5','B7','B9']],presets:[]},
    '2.6':{columns:[['B4','B5','B7'],['B8','B6']],presets:[]},
    '2.7':{columns:[['B4','B5'],['B6']],quantity:'B7',unit:'экз.',label:'Количество комплектов',presets:[1,2,5,10,25,50]}
  }[id];
  const hints={
    '2.1':{B9:'Число готовых брошюр. Листы в строках указывайте на весь заказ.'},
    '2.2':{B7:'Ориентир по листам относится к обычной бумаге. Сложенные чертежи и плотные обложки увеличивают толщину.'},
    '2.4':{B7:'Один прогон — одна отсканированная сторона. Форматы больше A3 не принимаем.'},
    '2.5':{B9:'Количество комплектов для сборки. Способ копирования оригиналов больше A3 согласуйте заранее.'},
    '2.6':{B8:'Листы в строках указывайте на все альбомы суммарно. Количество альбомов определяет число переплётов.'},
    '2.7':{B4:'Не более 841 мм. PDF в масштабе 1:1.',B5:'Не более 18 000 мм.'}
  };
  const labels={'Ч/Б':'Чёрно-белая','Цвет':'Цветная','ДА':'Да','НЕТ':'Нет'};
  const choiceLabel=(field,value)=>id==='2.4'&&field.cell==='B6'?(value==='ДА'?'Да, сшит':'Нет, отдельные листы'):labels[value]||value;
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
      const allowed=new Set([...window.TEXT_PROJECT_DATA[id].schema.fields.map(field=>field.cell),'rows']);
      values=pricing.normalize(id,Object.fromEntries(Object.entries(saved).filter(([key])=>allowed.has(key))));
      if(!pricing.quote(id,values).valid)throw Error('Invalid calculation');
    }catch{values=pricing.defaults(id);window.TEXT_APP.notify('Параметры ссылки некорректны. Открыт стандартный расчёт.');}
  }
  let customQuantity=!layout.presets.includes(Number(values[layout.quantity]));
  function numericInput(field){
    const hint=hints[id]?.[field.cell];
    return `<label class="cc-number" for="cc-${field.cell}">${field.cell===layout.quantity?'Ваше количество':escape(field.label)}<input id="cc-${field.cell}" name="${field.cell}" data-cc-cell="${field.cell}" type="number" inputmode="${field.step===1?'numeric':'decimal'}" min="${field.min}"${field.max?` max="${field.max}"`:''} step="${field.step}" required value="${escape(values[field.cell])}"${hint?` aria-describedby="hint-${field.cell}"`:''}></label>`;
  }
  function fieldHTML(field){
    const hint=hints[id]?.[field.cell];
    if(schema.rows&&field.options)return `<div class="cc-field" data-cc-field="${field.cell}"><label class="project-select-label" for="cc-${field.cell}">${escape(field.label)}<select id="cc-${field.cell}" data-project-select="${field.cell}"${field.locked?' disabled':''}>${field.options.map(v=>`<option value="${escape(v)}"${v===String(values[field.cell])?' selected':''}>${escape(choiceLabel(field,v))}</option>`).join('')}</select></label></div>`;
    if(field.options?.length>5)return `<div class="cc-field" data-cc-field="${field.cell}"><label class="project-select-label" for="cc-${field.cell}">${escape(field.label)}<select id="cc-${field.cell}" data-project-select="${field.cell}">${field.options.map(v=>`<option value="${escape(v)}"${v===String(values[field.cell])?' selected':''}>${escape(v)}</option>`).join('')}</select></label></div>`;
    if(!field.options)return `<div class="cc-field" data-cc-field="${field.cell}">${numericInput(field)}${hint?`<p class="cc-field-note" id="hint-${field.cell}"${schema.rows?' hidden':''}>${escape(hint)}</p>`:''}</div>`;
    return `<fieldset class="cc-field" data-cc-field="${field.cell}"><legend>${escape(field.label)}</legend><div class="cc-choice-stack">${field.options.map(value=>`<button class="cc-option" type="button" data-cc-choice="${field.cell}" data-cc-value="${escape(value)}" aria-pressed="${String(values[field.cell])===value}"${field.locked?' disabled':''}>${escape(choiceLabel(field,value))}</button>`).join('')}</div>${hint?`<p class="cc-field-note" id="hint-${field.cell}">${escape(hint)}</p>`:''}</fieldset>`;
  }
  function sheetRow(row,index,fields){
    const options=fields.map(field=>{
      const attrs=`data-project-row-cell="${field.col}" data-project-index="${index}" aria-label="Строка ${index+1}: ${escape(field.label)}"`;
      return field.options?`<select ${attrs}>${field.options.map(v=>`<option value="${escape(v)}"${String(row[field.col])===v?' selected':''}>${escape(v)}</option>`).join('')}</select>`:`<input ${attrs} type="number" min="1" step="1" required inputmode="numeric" value="${escape(row[field.col])}">`;
    }).join('');
    return `<div class="project-sheet-row${id==='2.6'?' project-design-row':''}" data-project-row="${index}">${options}<button type="button" data-project-remove="${index}" aria-label="Удалить строку ${index+1}"${values.rows.length===1?' disabled':''}>×</button></div>`;
  }
  function drawFields(focusCell=null){
    const fields=pricing.fields(id,values);
    const columns=layout.columns.map(cells=>`<div class="cc-param-column">${cells.map(cell=>fields.find(field=>field.cell===cell)).filter(Boolean).map(fieldHTML).join('')}</div>`).join('');
    const quantity=fields.find(field=>field.cell===layout.quantity);
    if(schema.rows){
      controls.classList.add('project-multi');
      const rowFields=pricing.rowFields(id,values),limit=schema.rows.end-schema.rows.start+1;
      controls.innerHTML=`<div class="project-order-options">${fields.map(fieldHTML).join('')}</div><div class="project-sheets"><h3>Состав комплекта</h3><p class="project-sheet-note">Укажите форматы, цветность${id==='2.6'?', бумагу':''} и количество листов.</p><div class="project-sheet-list">${values.rows.map((row,index)=>sheetRow(row,index,rowFields)).join('')}</div><button type="button" class="button button-white project-add-row" data-project-add${values.rows.length>=limit?' disabled':''}>Добавить формат</button></div>`;
      if(focusCell)controls.querySelector(`[data-project-select="${focusCell}"], [data-cc-cell="${focusCell}"]`)?.focus({preventScroll:true});
      return;
    }
    controls.innerHTML=columns+
      `<fieldset class="cc-field cc-quantity" data-cc-field="${layout.quantity}"><legend>${layout.label}</legend><div class="cc-quantity-stack">${layout.presets.map(n=>`<div class="cc-quantity-row"><button class="cc-option" type="button" data-cc-quantity="${n}" aria-pressed="false">${format(n)} ${layout.unit}</button><span class="cc-quantity-price" data-cc-price="${n}">—</span></div>`).join('')}<button type="button" class="cc-option cc-custom-option" data-cc-quantity="custom" aria-pressed="false">Другое количество</button></div><div class="cc-custom-field" data-cc-custom${customQuantity?'':' hidden'}>${numericInput(quantity)}</div>${hints[id]?.[layout.quantity]?`<p class="cc-field-note" id="hint-${layout.quantity}">${escape(hints[id][layout.quantity])}</p>`:''}</fieldset>`;
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
      if(quote.cell)(controls.querySelector(`[data-cc-cell="${quote.cell}"], [data-project-select="${quote.cell}"]`)||controls.querySelector(`[data-cc-field="${quote.cell}"]`))?.setAttribute('aria-invalid','true');
      total.textContent='Проверьте параметры';days.textContent='Срок появится после расчёта';breakdown.innerHTML='';
    }else{
      const n=quote.days,word=n%10===1&&n%100!==11?'рабочий день':[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?'рабочих дня':'рабочих дней';
      total.textContent=money(quote);days.textContent=schema.rows?`${n} ${word}`:`${n} ${word} после согласования`;
      breakdown.innerHTML=quote.details.map(item=>`<div><dt>${escape(item.label)}</dt><dd>${escape(typeof item.value==='number'?format(item.value):item.value)}</dd></div>`).join('');
    }
    controls.querySelectorAll('[data-cc-quantity]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.ccQuantity==='custom'?customQuantity:!customQuantity&&Number(button.dataset.ccQuantity)===Number(values[layout.quantity])));
    if(layout.quantity)controls.querySelector('[data-cc-custom]').hidden=!customQuantity;
    if(!quote.valid&&quote.row!=null)controls.querySelector(`[data-project-index="${quote.row}"][data-project-row-cell="${quote.col}"]`)?.setAttribute('aria-invalid','true');
    for(const n of layout.presets){
      const preset=pricing.quote(id,{...values,[layout.quantity]:n});
      controls.querySelector(`[data-cc-price="${n}"]`).textContent=preset.valid?money(preset):'—';
    }
    const note=root.querySelector('[data-cc-range-note]');
    note.textContent='Листы A4 не требуют складывания. Фальцовку добавлять к заказу не нужно.';
    note.hidden=!(quote.valid&&id==='2.3'&&quote.price===0);
    root.querySelector('[data-cc-breakdown-panel]').hidden=schema.rows?false:!quote.valid;
    add.disabled=busy||!quote.valid||quote.price===0;download.disabled=copy.disabled=!quote.valid;
    add.textContent=busy?'Сохраняем…':editKey?'Сохранить изменения':'В корзину';
  }
  controls.addEventListener('click',event=>{
    const choice=event.target.closest('[data-cc-choice]'),quantity=event.target.closest('[data-cc-quantity]');
    if(event.target.closest('[data-project-add]')){
      const limit=schema.rows.end-schema.rows.start+1;if(values.rows.length>=limit)return;
      values.rows.push(Object.fromEntries(pricing.rowFields(id,values).map(f=>[f.col,f.options?f.options[0]:1])));drawFields();updateQuote();
      controls.querySelector(`[data-project-index="${values.rows.length-1}"]`)?.focus({preventScroll:true});
    }
    const remove=event.target.closest('[data-project-remove]');
    if(remove&&values.rows.length>1){const index=Number(remove.dataset.projectRemove);values.rows.splice(index,1);drawFields();updateQuote();controls.querySelector(`[data-project-index="${Math.min(index,values.rows.length-1)}"]`)?.focus({preventScroll:true});}

    if(choice){values[choice.dataset.ccChoice]=choice.dataset.ccValue;values=pricing.normalize(id,values);drawFields(choice.dataset.ccChoice);updateQuote();}
    if(quantity){
      customQuantity=quantity.dataset.ccQuantity==='custom';
      if(!customQuantity){values[layout.quantity]=Number(quantity.dataset.ccQuantity);controls.querySelector(`[data-cc-cell="${layout.quantity}"]`).value=values[layout.quantity];}
      updateQuote();if(customQuantity)controls.querySelector(`[data-cc-cell="${layout.quantity}"]`).focus({preventScroll:true});
    }
  });
  controls.addEventListener('change',event=>{
    const select=event.target.closest('[data-project-select]');
    if(select){values[select.dataset.projectSelect]=select.value;if(schema.rows){values=pricing.normalize(id,values);drawFields(select.dataset.projectSelect);}updateQuote();return;}
    const rowSelect=event.target.closest('select[data-project-row-cell]');
    if(rowSelect){values.rows[Number(rowSelect.dataset.projectIndex)][rowSelect.dataset.projectRowCell]=rowSelect.value;updateQuote();}
  });
  controls.addEventListener('input',event=>{
    const rowInput=event.target.closest('[data-project-row-cell]');
    if(rowInput&&rowInput.tagName!=='SELECT'){
      const index=Number(rowInput.dataset.projectIndex),col=rowInput.dataset.projectRowCell;
      values.rows[index][col]=rowInput.value;
      updateQuote();return;
    }

    const input=event.target.closest('[data-cc-cell]');if(!input)return;
    values[input.dataset.ccCell]=input.value;updateQuote();
  });
  root.querySelector('[data-cc-reset]').addEventListener('click',()=>{
    values=pricing.defaults(id);customQuantity=!layout.presets.includes(Number(values[layout.quantity]));
    drawFields();updateQuote();
  });
  function showFile(){
    const name=pendingFile?.name||(!fileRemoved&&existing?.fileName);
    fileLabel.textContent=name||defaultFileLabel;removeFile.hidden=!name;
    fileStatus.textContent=name?'Файл выбран. При отправке запроса прикрепите его к письму вручную.':defaultFileHint;
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
    return [`ТЕКСТ — ${window.TEXT_PROJECT_SERVICES[id].name}`,quote.description,`Стоимость: ${money(quote)}`,`Срок: ${quote.days} раб. дн. после полного согласования`,
      ...quote.details.map(item=>item.label+': '+item.value),comment.value.trim()?`Комментарий: ${comment.value.trim()}`:'',
      'Стоимость рассчитана для выбранных параметров.',
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
    const link=document.createElement('a');link.href=url;link.download=`ТЕКСТ — ${window.TEXT_PROJECT_SERVICES[id].name}.txt`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  if(schema.rows&&comment.value){root.querySelector('.project-calc-extra').open=true;root.querySelector('[data-cc-breakdown-panel]').open=true;}
  drawFields();updateQuote();showFile();
})();
