(() => {
  'use strict';
  const root=new URL('.',document.currentScript.src).href,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const s=window.TEXT_UV_SERVICES[document.body.dataset.uvService];if(!s)return;
  const pricing=window.TEXT_UV_PRICING,sharing=window.TEXT_UV_SHARING;
  const format=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(v),money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v)+' ₽';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=v=>{const text=String(v);return text===text.toUpperCase()&&/[А-Я]/.test(text)?text.charAt(0)+text.slice(1).toLowerCase().replace(/^Уф/,'УФ'):text;};
  const params=new URLSearchParams(location.search),previous=window.TEXT_APP.getCart().find(r=>r.key===params.get('edit')&&r.id===s.id);
  let state=pricing.normalize(s.id,previous?.configuration||sharing.read(params,s.id)),result=null,busy=Boolean(previous?.fileName),selectedFile=null,fileChanged=false;
  let customQuantity=!s.quantities.includes(Number(state[s.quantityCell]));
  $('#sp-comment').value=previous?.comment||'';$('#sp-quantity').value=state[s.quantityCell];
  const choice=(cell,value,text)=>`<button type="button" class="sp-option" data-uv-cell="${cell}" data-uv-value="${escape(value)}" aria-pressed="false">${escape(text)}</button>`;
  function renderFields(){
    $('#uv-fields').innerHTML=pricing.fields(s.id,state).filter(f=>f.cell!==s.quantityCell).map(f=>{
      const name=escape(f.label),value=state[f.cell];let control;
      if(f.options?.length>3){control=`<select id="uv-${f.cell}" data-uv-input="${f.cell}">${f.options.map(v=>`<option value="${escape(v)}"${String(v)===String(value)?' selected':''}>${escape(label(v))}</option>`).join('')}</select>`;}
      else if(f.options){control='<div class="sp-choice-stack">'+f.options.map(v=>choice(f.cell,v,typeof v==='number'?format(v)+' мм':label(v))).join('')+'</div>';}
      else{control=`<input id="uv-${f.cell}" type="number" data-uv-input="${f.cell}" min="${f.min}"${f.max?` max="${f.max}"`:''} step="${f.step}" value="${escape(value)}" inputmode="decimal" aria-describedby="uv-error">`;}
      const legend=f.options?.length<=3?`<legend>${name}</legend>`:`<legend><label for="uv-${f.cell}">${name}</label></legend>`;
      return `<fieldset class="uv-field" data-field="${f.cell}">${legend}${control}</fieldset>`;
    }).join('');
  }
  $('#sp-quantity-options').innerHTML=s.quantities.map(q=>`<div class="sp-quantity-row">${choice(s.quantityCell,q,format(q)+' шт.')}<span class="sp-quantity-price" data-sp-price="${q}">—</span></div>`).join('')+`<button type="button" class="sp-option sp-custom-option" id="uv-custom-count" aria-pressed="false">Другое количество</button>`;
  function sync(){
    result=pricing.quote(s.id,state);
    $$('[data-uv-cell]').forEach(b=>b.setAttribute('aria-pressed',String(String(state[b.dataset.uvCell])===b.dataset.uvValue&&!(b.dataset.uvCell===s.quantityCell&&customQuantity))));
    $('#uv-custom-count').setAttribute('aria-pressed',String(customQuantity));$('#sp-custom-quantity').hidden=!customQuantity;
    $('#uv-error').textContent=result.valid?'':result.error;
    $$('[data-uv-input]').forEach(input=>input.setAttribute('aria-invalid',String(!result.valid&&result.cell===input.dataset.uvInput)));
    $('#sp-quantity').setAttribute('aria-invalid',String(!result.valid&&result.cell===s.quantityCell));
    for(const quantity of s.quantities){const q=pricing.quote(s.id,{...state,[s.quantityCell]:quantity});$(`[data-sp-price="${quantity}"]`).textContent=q.valid?money(q.total):'—';}
    $('#sp-total').textContent=result.valid?money(result.total):'—';$('#sp-mobile-price').textContent=result.valid?money(result.total):'—';
    $('#sp-unit').textContent=result.valid?'≈ '+money(result.effectiveUnit):'—';$('#sp-selected-quantity').textContent=Number(state[s.quantityCell])>0?format(Number(state[s.quantityCell])):'—';
    $('#sp-selected-description').textContent=sharing.description(state,s.id);
    $('#uv-details').innerHTML=result.valid?result.details.map(d=>`<p>${escape(d.label)}: ${escape(typeof d.value==='number'?format(d.value):d.value)}</p>`).join(''):'';
    $('#sp-surcharge').hidden=!result.valid||!result.surcharge;$('#sp-surcharge').textContent=result.valid&&result.surcharge?`Включена доплата ${money(result.surcharge)} до минимального чека ${money(s.minimum)}.`:'';
    $('#sp-days').textContent=result.valid?`${result.days} ${result.days%10===1&&result.days%100!==11?'рабочий день':result.days%10>=2&&result.days%10<=4&&(result.days%100<12||result.days%100>14)?'рабочих дня':'рабочих дней'}`:'—';
    $('#sp-add').disabled=!result.valid||busy;$('#sp-mobile-total').disabled=!result.valid||busy;$('#sp-copy').disabled=!result.valid;$('#sp-download').disabled=busy;
    $('#sp-add').textContent=previous?'Сохранить изменения':'В корзину';
  }
  $('#uv-fields').addEventListener('input',event=>{
    const input=event.target.closest('[data-uv-input]');if(!input)return;
    state[input.dataset.uvInput]=input.value;
    if(input.tagName==='SELECT'){state=pricing.normalize(s.id,state);const cell=input.dataset.uvInput;renderFields();$(`[data-uv-input="${cell}"]`)?.focus();}
    sync();
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-uv-cell]');if(!button)return;
    const cell=button.dataset.uvCell;state[cell]=button.dataset.uvValue;
    if(cell===s.quantityCell){customQuantity=false;$('#sp-quantity').value=state[cell];}
    else{state=pricing.normalize(s.id,state);renderFields();$(`[data-uv-cell="${cell}"][data-uv-value="${CSS.escape(String(state[cell]))}"]`)?.focus();}
    sync();
  });
  $('#uv-custom-count').addEventListener('click',()=>{customQuantity=true;sync();$('#sp-quantity').focus();});
  $('#sp-quantity').addEventListener('input',event=>{state[s.quantityCell]=event.target.value;sync();});
  function showFile(){
    $('#sp-file-label').textContent=selectedFile?selectedFile.name:'Загрузите макет';$('#sp-remove-file').hidden=!selectedFile;
    $('#sp-file-status').textContent=selectedFile?`Выбран: ${(selectedFile.size/1024/1024).toFixed(2)} МБ. Сохраним вместе с расчётом в корзине.`:'Можно прикрепить позже в корзине.';
  }
  function selectFile(file){const error=window.TEXT_FILES.validate(file);if(error){$('#sp-file-status').textContent=error;$('#sp-file').value='';return;}selectedFile=file;fileChanged=true;showFile();}
  $('#sp-file').addEventListener('change',event=>{if(event.target.files[0])selectFile(event.target.files[0]);});
  $('#sp-remove-file').addEventListener('click',()=>{selectedFile=null;fileChanged=true;$('#sp-file').value='';showFile();});
  $('#sp-hero-upload').addEventListener('click',()=>{$('#calculator').scrollIntoView({behavior:'smooth'});$('#sp-file').click();});
  const zone=$('#sp-file-zone');for(const type of ['dragenter','dragover'])zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add('is-dragging');});for(const type of ['dragleave','drop'])zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('is-dragging');});zone.addEventListener('drop',e=>{if(e.dataTransfer.files[0])selectFile(e.dataTransfer.files[0]);});
  $('#uv-form').addEventListener('submit',async event=>{
    event.preventDefault();sync();if(!result.valid||busy)return;
    const quote={...result},configuration={...result.configuration},comment=$('#sp-comment').value.trim(),file=selectedFile,key=previous?.key||crypto.randomUUID();
    const retained=!fileChanged&&!file?previous:null;busy=true;sync();
    try{
      if(file)await window.TEXT_FILES.save(key,file);else if(previous?.fileName&&fileChanged)await window.TEXT_FILES.remove(key);
      window.TEXT_APP.upsertCalculatedItem({key,id:s.id,configuration,comment,description:[sharing.description(configuration,s.id),`Срок: ${quote.days} раб. дн. после согласования`,comment?'Комментарий: '+comment:''].filter(Boolean).join('\n'),price:quote.subtotal,unit:quote.unit,days:quote.days,pricingGroup:s.pricingGroup,fileName:file?.name||retained?.fileName||null,fileSize:file?.size||retained?.fileSize||null});
      window.TEXT_APP.openCart();window.TEXT_APP.notify(previous?'Расчёт в корзине обновлён':'Услуга добавлена в корзину');
    }catch{$('#sp-file-status').textContent='Не удалось сохранить макет. Попробуйте ещё раз или прикрепите его позже.';}
    finally{busy=false;sync();}
  });
  $('#sp-mobile-total').addEventListener('click',()=>$('#uv-form').requestSubmit());
  $('#sp-manual').addEventListener('click',()=>window.TEXT_APP.prepareServiceRequest({id:s.id,comment:[sharing.description(state,s.id),'Индивидуальный расчёт',$('#sp-comment').value.trim()].filter(Boolean).join('\n'),file:selectedFile}));
  $('#sp-download').addEventListener('click',()=>{
    const text=['СТУДИЯ ПЕЧАТИ ТЕКСТ',s.name,sharing.description(state,s.id),result.valid?`Стоимость: ${money(result.total)}\nДоплата до минимального чека: ${money(result.surcharge)}\nСрок: ${result.days} раб. дн. после полного согласования макета`:'Индивидуальный расчёт: '+result.error,$('#sp-comment').value,selectedFile?'Макет: '+selectedFile.name:'',sharing.url(state,root,s.id),'Студия печати ТЕКСТ · Барнаул, пр. Строителей, 11 · +7 (923) 654-78-96'].filter(Boolean).join('\n\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Расчёт — '+s.name+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  let copyTimer;$('#sp-copy').addEventListener('click',async()=>{
    const text=sharing.text(state,root,s.id);if(!text)return;
    try{await navigator.clipboard.writeText(text);$('#sp-copy-status').textContent='Скопировано';clearTimeout(copyTimer);copyTimer=setTimeout(()=>$('#sp-copy-status').textContent='',2200);}
    catch{window.TEXT_APP.notify('Копирование недоступно. Скачайте расчёт.');}
  });
  const observer=new IntersectionObserver(entries=>$('#sp-mobile-total').classList.toggle('is-visible',entries[0].isIntersecting),{rootMargin:'0px 0px -80px 0px'});observer.observe($('#calculator'));
  renderFields();sync();
  if(previous?.fileName)window.TEXT_FILES.get(previous.key).then(file=>{if(!fileChanged&&file)selectedFile=file;showFile();}).catch(()=>{$('#sp-file-status').textContent='Сохранённый макет недоступен. Прикрепите его ещё раз.';}).finally(()=>{busy=false;sync();});
})();
