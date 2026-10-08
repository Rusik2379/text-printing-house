(() => {
  'use strict';
  const key='text-print-consent-v1',version=1,maxAge=180*24*60*60*1000;
  const counter=86530452;
  const production=['text-print.ru','www.text-print.ru'].includes(location.hostname);
  const banner=document.querySelector('#cookie-banner');
  if(!banner)return;
  let choice=null,script=null,initialized=false,returnFocus=null;
  function readChoice(){
    try{
      const value=JSON.parse(localStorage.getItem(key));
      const age=Date.now()-Date.parse(value?.updatedAt);
      return value?.version===version&&typeof value.analytics==='boolean'&&age>=0&&age<maxAge?value:null;
    }catch{return null;}
  }
  function clearAnalyticsData(){
    try{
      const names=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));
      names.filter(name=>name?.startsWith('_ym')).forEach(name=>localStorage.removeItem(name));
    }catch{}
    document.cookie.split(';').forEach(item=>{
      const name=item.split('=')[0].trim();
      if(!name.startsWith('_ym'))return;
      const domains=['',location.hostname,'.'+location.hostname];
      if(location.hostname==='www.text-print.ru')domains.push('.text-print.ru');
      for(const domain of domains){
        document.cookie=`${name}=; Max-Age=0; path=/; SameSite=Lax${domain?'; domain='+domain:''}`;
      }
    });
  }
  function stopAnalytics(){
    if(initialized&&typeof window.ym==='function')window.ym(counter,'destruct');
    initialized=false;
    if(script){script.onload=null;script.onerror=null;script.remove();script=null;}
    clearAnalyticsData();
  }
  function startAnalytics(){
    if(!production||!choice?.analytics||initialized||script)return;
    if(typeof window.ym!=='function'){
      window.ym=function(){(window.ym.a=window.ym.a||[]).push(arguments);};
      window.ym.l=Date.now();
    }
    const tag=document.createElement('script');
    script=tag;
    tag.src='https://mc.yandex.ru/metrika/tag.js';
    tag.async=true;
    tag.onload=()=>{
      if(script!==tag||!choice?.analytics||initialized)return;
      initialized=true;
      window.ym(counter,'init',{defer:true,webvisor:false,clickmap:false,trackLinks:false,accurateTrackBounce:true});
      // Shared calculation links can contain parameters; report only the page path.
      window.ym(counter,'hit',location.origin+location.pathname,{title:document.title});
    };
    tag.onerror=()=>{if(script===tag){tag.remove();script=null;}};
    document.head.append(tag);
  }
  function applyChoice(){
    if(choice?.analytics)startAnalytics();else stopAnalytics();
    banner.hidden=Boolean(choice);
    const current=banner.querySelector('[data-cookie-current]');
    if(current){current.hidden=!choice;current.textContent=choice?.analytics?'Сейчас аналитика разрешена. Вы можете изменить выбор.':'Сейчас используются только необходимые данные.';}
  }
  function saveChoice(analytics){
    const restoreFocus=banner.contains(document.activeElement);
    choice={version,analytics,updatedAt:new Date().toISOString()};
    try{localStorage.setItem(key,JSON.stringify(choice));}catch{}
    applyChoice();
    if(restoreFocus)returnFocus?.focus();
  }
  banner.querySelectorAll('[data-cookie-choice]').forEach(button=>button.addEventListener('click',()=>saveChoice(button.dataset.cookieChoice==='analytics')));
  document.querySelectorAll('[data-cookie-settings]').forEach(button=>button.addEventListener('click',()=>{
    returnFocus=button;
    banner.hidden=false;
    banner.querySelector('[data-cookie-choice="necessary"]').focus();
  }));
  banner.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&choice){banner.hidden=true;returnFocus?.focus();}
  });
  window.addEventListener('storage',event=>{
    if(event.key===key||event.key===null){choice=readChoice();applyChoice();}
  });
  choice=readChoice();
  applyChoice();
})();
