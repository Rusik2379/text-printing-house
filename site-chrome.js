/* Search, responsive chrome and printable service checklists. */
(() => {
 'use strict';
 const header=document.querySelector('#header'),form=document.querySelector('#home-search'),input=document.querySelector('[data-header-search]'),results=document.querySelector('#header-search-results'),nav=document.querySelector('#navigation'),toggle=document.querySelector('[data-header-search-toggle]');
 const root=new URL('.',document.currentScript.src),escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const services={...window.TEXT_STICKER_SERVICES,...window.TEXT_COPYCENTER_SERVICES,...window.TEXT_PROJECT_SERVICES,...window.TEXT_LEAFLET_SERVICES,...window.TEXT_WIDE_SERVICES,...window.TEXT_UV_SERVICES};
 const catalog=window.TEXT_CATALOG||[],normalize=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
 let selected=-1;
 function hideSearch(){if(!results)return;results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;}
 function closeMobileSearch(restoreFocus=false){const wasOpen=header?.classList.contains('search-open');header?.classList.remove('search-open');toggle?.setAttribute('aria-expanded','false');hideSearch();if(wasOpen&&restoreFocus)toggle?.focus();}
 function search(){
  const q=normalize(input.value);selected=-1;input.removeAttribute('aria-activedescendant');if(!q){hideSearch();return;}
  const matches=catalog.filter(s=>normalize(s.name+' '+s.category).includes(q)&&services[s.id]).slice(0,9);
  results.innerHTML=matches.length?matches.map((s,i)=>`<a id="header-result-${i}" role="option" aria-selected="false" href="${new URL(services[s.id].path,root).href}"><span>${escape(s.name)}</span><small>${escape(s.category)}</small></a>`).join(''):'<p>Такой услуги не нашли. Попробуйте другое название или напишите нам.</p>';
  results.hidden=false;input.setAttribute('aria-expanded','true');
 }
 if(input&&results){
  input.addEventListener('input',search);input.addEventListener('focus',()=>{if(input.value)search();});
  input.addEventListener('keydown',event=>{
   const links=[...results.querySelectorAll('a')];
   if(['ArrowDown','ArrowUp'].includes(event.key)&&links.length){event.preventDefault();selected=selected<0?(event.key==='ArrowDown'?0:links.length-1):(selected+(event.key==='ArrowDown'?1:-1)+links.length)%links.length;links.forEach((n,i)=>n.setAttribute('aria-selected',String(i===selected)));input.setAttribute('aria-activedescendant',links[selected].id);links[selected].scrollIntoView({block:'nearest'});}
   if(event.key==='Escape'){event.stopPropagation();closeMobileSearch(true);}
   if(event.key==='Enter'&&selected>=0&&links[selected]){event.preventDefault();location.assign(links[selected].href);}
  });
  form.addEventListener('submit',hideSearch);
  document.addEventListener('click',event=>{if(!form.contains(event.target)&&!event.target.closest('[data-header-search-toggle]'))closeMobileSearch();});
 }
 toggle?.addEventListener('click',()=>{const open=header.classList.toggle('search-open');toggle.setAttribute('aria-expanded',String(open));if(open)input.focus();else hideSearch();});
 document.querySelector('[data-header-search-close]')?.addEventListener('click',()=>closeMobileSearch(true));
 matchMedia('(max-width:700px)').addEventListener('change',()=>closeMobileSearch());
 function syncHeader(){
  if(!header)return;
  header.style.setProperty('--header-bottom',Math.max(0,header.getBoundingClientRect().bottom)+'px');
  const mobile=matchMedia('(max-width:1100px)').matches;
  document.body.classList.toggle('mobile-navigation-open',mobile&&nav.classList.contains('mobile-open'));
  if(!mobile&&nav.classList.contains('mobile-open')){nav.classList.remove('mobile-open');document.querySelector('#mobile-menu-button').setAttribute('aria-expanded','false');}
 }
 new ResizeObserver(syncHeader).observe(header);
 new MutationObserver(syncHeader).observe(nav,{attributes:true,attributeFilter:['class']});
 addEventListener('resize',syncHeader);addEventListener('scroll',syncHeader,{passive:true});syncHeader();
 for(const link of document.querySelectorAll('.nav-category-link'))if(location.pathname.startsWith(new URL(link.href).pathname))link.setAttribute('aria-current','true');
 document.addEventListener('click',event=>{if(!header.contains(event.target)&&nav.classList.contains('mobile-open')){nav.classList.remove('mobile-open');document.querySelector('#mobile-menu-button').setAttribute('aria-expanded','false');}});

 const top=document.createElement('button');top.type='button';top.className='back-to-top';top.title='Наверх';top.setAttribute('aria-label','Вернуться наверх');top.innerHTML='<span aria-hidden="true">↑</span>';top.hidden=true;document.body.append(top);
 const dialog=document.querySelector('#dialog'),cookie=document.querySelector('#cookie-banner');
 const bottomPanels=[cookie,...document.querySelectorAll('.mobile-bottom,.sp-mobile-total')].filter(Boolean);
 function updateTop(){
  top.hidden=scrollY<500||Boolean(dialog?.open)||nav.classList.contains('mobile-open');
  let bottom=24;
  for(const n of bottomPanels){
   if(!n||n.hidden||getComputedStyle(n).display==='none')continue;
   const r=n.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight&&getComputedStyle(n).position==='fixed')bottom=Math.max(bottom,innerHeight-r.top+12);
  }
  top.style.bottom=bottom+'px';
 }
 top.addEventListener('click',()=>{const main=document.querySelector('#main');if(main){if(!main.hasAttribute('tabindex'))main.tabIndex=-1;main.focus({preventScroll:true});}window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
 addEventListener('scroll',updateTop,{passive:true});addEventListener('resize',updateTop);addEventListener('pageshow',updateTop);
 const observer=new MutationObserver(updateTop);for(const node of [dialog,nav,...bottomPanels])if(node)observer.observe(node,{attributes:true,attributeFilter:['open','hidden','class']});
 const bottomResize=new ResizeObserver(updateTop);for(const panel of bottomPanels)bottomResize.observe(panel);updateTop();

 let printTrigger=null;
 document.addEventListener('click',event=>{const button=event.target.closest('[data-print-requirements]');if(!button)return;printTrigger=button;document.body.classList.add('is-printing-requirements');window.print();});
 addEventListener('afterprint',()=>{document.body.classList.remove('is-printing-requirements');printTrigger?.focus({preventScroll:true});printTrigger=null;});
})();
