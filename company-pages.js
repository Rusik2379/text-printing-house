(() => {
  'use strict';
  const root=document.querySelector('[data-filter-list]');
  if(!root)return;
  const items=[...root.querySelectorAll('[data-filter-item]')];
  const search=document.querySelector('[data-company-search]');
  const buttons=[...document.querySelectorAll('[data-company-filter]')];
  const status=document.querySelector('[data-results-status]');
  const empty=document.querySelector('[data-empty-results]');
  const more=document.querySelector('[data-load-more]');
  const normalize=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
  let category='all',limit=more?12:Infinity;
  function update(){
    const query=normalize(search?.value||'');
    const found=items.filter(item=>(category==='all'||item.dataset.category===category)&&normalize(item.textContent).includes(query));
    const visible=new Set(found.slice(0,limit));
    items.forEach(item=>{item.hidden=!visible.has(item);});
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.companyFilter===category)));
    if(status)status.textContent=found.length?`Показано ${Math.min(limit,found.length)} из ${found.length}`:'По вашему запросу ничего не найдено';
    if(empty)empty.hidden=found.length>0;
    if(more)more.hidden=found.length<=limit;
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.companyFilter;limit=more?12:Infinity;update();}));
  search?.addEventListener('input',()=>{limit=more?12:Infinity;update();});
  more?.addEventListener('click',()=>{limit+=12;update();});
  update();
})();
