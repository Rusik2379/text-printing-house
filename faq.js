(() => {
  'use strict';
  const questions=[...document.querySelectorAll('.faq-list details, .requirements-service')];
  if(!questions.length)return;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const finishAnimations=new Set();
  const linkedAnswers=new Map();
  questions.forEach(details=>{
    const summary=details.querySelector('summary');
    if(!summary)return;
    const answer=document.createElement('div');
    answer.className='faq-answer';
    while(summary.nextSibling)answer.append(summary.nextSibling);
    details.append(answer);
    let expanded=details.open,animation=null;
    const updateState=()=>{
      details.dataset.faqExpanded=String(expanded);
      summary.setAttribute('aria-expanded',String(expanded));
      answer.inert=!expanded;
      answer.setAttribute('aria-hidden',String(!expanded));
    };
    const finish=()=>{
      const current=animation;
      animation=null;
      details.open=expanded;
      current?.cancel(); // Release the fixed height so wrapping/resizing stays natural.
      updateState();
      finishAnimations.delete(finish);
    };
    summary.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button>0||event.target.closest('a,button,input,select,textarea'))return;
      event.preventDefault();
      const fromHeight=details.open?answer.getBoundingClientRect().height:0;
      const fromOpacity=details.open?Number.parseFloat(getComputedStyle(answer).opacity):0;
      animation?.cancel();
      expanded=!expanded;
      updateState();
      if(reducedMotion.matches||typeof answer.animate!=='function'){
        finish();
        return;
      }
      // Keep native details open until the closing animation finishes.
      details.open=true;
      const motionStyle=getComputedStyle(details);
      const durationValue=motionStyle.getPropertyValue('--faq-duration').trim();
      const duration=Number.parseFloat(durationValue)*(durationValue.endsWith('ms')?1:1000)||420;
      const easing=motionStyle.getPropertyValue('--faq-easing').trim()||'cubic-bezier(.3,0,.2,1)';
      const current=answer.animate([
        {height:`${fromHeight}px`,opacity:fromOpacity},
        {height:`${expanded?answer.scrollHeight:0}px`,opacity:expanded?1:0}
      ],{duration,easing,fill:'forwards'});
      animation=current;
      finishAnimations.add(finish);
      current.onfinish=()=>{if(animation===current)finish();};
    });
    details.addEventListener('toggle',()=>{
      if(!animation){expanded=details.open;updateState();}
    });
    updateState();
    if(details.id)linkedAnswers.set(details.id,()=>{expanded=true;finish();});
  });
  const revealLinkedAnswer=()=>{
    try{linkedAnswers.get(decodeURIComponent(location.hash.slice(1)))?.();}catch{}
  };
  window.addEventListener('hashchange',revealLinkedAnswer);
  revealLinkedAnswer();
  reducedMotion.addEventListener('change',()=>{
    if(reducedMotion.matches)[...finishAnimations].forEach(finish=>finish());
  });
})();
