(() => {
  'use strict';
  const root=document.querySelector('[data-filter-list]');
  if(!root)return;
  const items=[...root.querySelectorAll('[data-filter-item]')];
  const search=document.querySelector('[data-company-search]');
  const buttons=[...document.querySelectorAll('[data-company-filter]')];
  const topicSelect=document.querySelector('[data-company-topic]');
  const status=document.querySelector('[data-results-status]');
  const empty=document.querySelector('[data-empty-results]');
  const more=document.querySelector('[data-load-more]');
  const requirements=root.hasAttribute('data-requirements-list');
  const questions=root.hasAttribute('data-questions-list');
  const groups=[...root.querySelectorAll('[data-filter-group]')].map(element=>({element,items:items.filter(item=>element.contains(item)),count:element.querySelector('[data-filter-group-count]')}));
  const clearSearch=document.querySelector('[data-company-search-clear]');
  const reset=document.querySelector('[data-company-reset]');
  const normalize=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
  const serviceCount=count=>`${count} ${count%10===1&&count%100!==11?'услуга':[2,3,4].includes(count%10)&&![12,13,14].includes(count%100)?'услуги':'услуг'}`;
  const questionCount=count=>`${count} ${count%10===1&&count%100!==11?'вопрос':[2,3,4].includes(count%10)&&![12,13,14].includes(count%100)?'вопроса':'вопросов'}`;
  const searchable=new Map(items.map(item=>[item,normalize(`${item.textContent} ${item.dataset.searchTags||''}`).replace(/[^\p{L}\p{N}]+/gu,' ')]));
  let category='all',limit=more?12:Infinity;
  function update(){
    const query=normalize(search?.value||'');
    const terms=query.replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(Boolean);
    const found=items.filter(item=>(category==='all'||item.dataset.category===category)&&(questions?terms.every(term=>searchable.get(item).includes(term)):normalize(item.textContent).includes(query)));
    const visible=new Set(found.slice(0,limit));
    items.forEach(item=>{item.hidden=!visible.has(item);});
    groups.forEach(group=>{const count=group.items.filter(item=>visible.has(item)).length;group.element.hidden=count===0;if(group.count)group.count.textContent=questions?questionCount(count):serviceCount(count);});
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.companyFilter===category)));
    if(topicSelect)topicSelect.value=category;
    if(status)status.textContent=found.length?(requirements?`${serviceCount(found.length)}. Откройте название, чтобы прочитать требования.`:questions?`${questionCount(found.length)}${category==='all'&&!query?' по всем темам': ' по вашему выбору'}. Нажмите на вопрос, чтобы прочитать ответ.`:`Показано ${Math.min(limit,found.length)} из ${found.length}`):'По вашему запросу ничего не найдено';
    if(empty)empty.hidden=found.length>0;
    if(more)more.hidden=found.length<=limit;
    if(clearSearch)clearSearch.hidden=!search?.value;
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.companyFilter;limit=more?12:Infinity;update();}));
  topicSelect?.addEventListener('change',()=>{category=topicSelect.value;update();});
  search?.addEventListener('input',()=>{limit=more?12:Infinity;update();});
  clearSearch?.addEventListener('click',()=>{search.value='';update();search.focus();});
  reset?.addEventListener('click',()=>{category='all';if(search)search.value='';limit=more?12:Infinity;update();search?.focus();});
  more?.addEventListener('click',()=>{limit+=12;update();});
  update();
  if(questions||requirements)window.addEventListener('hashchange',()=>{
    let target;
    try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return;}
    if(!items.includes(target)||!target.hidden)return;
    category='all';if(search)search.value='';update();
  });
})();

(() => {
  const button=document.querySelector('[data-copy-contacts-address]');
  const status=document.querySelector('[data-contact-copy-status]');
  if(!button||!status)return;
  button.addEventListener('click',async()=>{
    try{
      await navigator.clipboard.writeText(button.dataset.copyContactsAddress);
      status.textContent='Адрес скопирован';
    }catch{
      status.textContent='Не удалось скопировать. Выделите адрес выше.';
    }
  });
})();
