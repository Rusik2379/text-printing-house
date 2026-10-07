(() => {
  'use strict';
  // Resolve from app.js so both domain roots and GitHub Pages subdirectories work.
  const siteRoot = new URL('.', document.currentScript.src).href;
  const servicePages=window.TEXT_STICKER_SERVICES||{};
  const serviceUrl=id=>servicePages[id]?siteRoot+servicePages[id].path:null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const currency = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(value) + ' ₽';
  const icons = {
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    star:'<path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5L6 21l1-6.5-5-5 7-1L12 2Z"/>',
    user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    zap:'<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
    shield:'<path d="m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    heart:'<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>',
    gear:'<path d="m9 3 1-2h4l1 2 3 2 2 1v4l-1 2 1 3v3l-3 1-2 2h-4l-2-2-3-1v-3l1-3-1-2V6l2-1 1-2Z"/><circle cx="12" cy="11" r="3"/>',
    palette:'<path d="M21 12a9 9 0 1 0-9 9h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-1Z"/><circle cx="7" cy="8" r=".8"/><circle cx="12" cy="5" r=".8"/><circle cx="17" cy="8" r=".8"/><circle cx="6" cy="13" r=".8"/>',
    truck:'<path d="M2 5h12v12H2V5Zm12 5h5l3 4v3h-8"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>',
    message:'<path d="M21 11a9 9 0 0 1-13 8l-6 3 2-6a9 9 0 1 1 17-5Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',

    arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>', chevron:'<path d="m6 9 6 6 6-6"/>',
    pause:'<path d="M8 5v14M16 5v14"/>', play:'<path d="m8 4 12 8-12 8V4Z"/>',
    pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>', search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    bag:'<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
    spark:'<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
    printer:'<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 13h10v8H7Z"/><path d="M17 10h1"/>',
    document:'<path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h4M9 12h6M9 16h6"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    sticker:'<path d="M21 13V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h5l8-8Z"/><path d="M13 21v-4a4 4 0 0 1 4-4h4M8 8h.01M15 8h.01M8 12c1.5 2 4.5 2 6 0"/>',
    wide:'<path d="M3 5h18v14H3zM7 2v20M17 2v20M10 9h4M10 13h4"/>',
    scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4M12 12l3 3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 11v1l2 1"/>',
    phone:'<path d="M4 3h4l2 5-3 2c2 4 4 6 8 7l2-3 5 2v4c0 2-3 3-6 2C8 20 4 16 2 8 1 5 2 3 4 3Z"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>'
  };
  function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.document}</svg>`; }
  function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => el.replaceWith(Object.assign(document.createElement('span'), {innerHTML:icon(el.dataset.icon)}).firstChild)); }
  const catalog = window.TEXT_CATALOG;
  window.TEXT_CONTACTS={telegram:'https://t.me/tekkkstos',max:'https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY'};
  $$('[data-social]').forEach(link=>{link.href=window.TEXT_CONTACTS[link.dataset.social];});
  const categories = [
    {name:'Копицентр',short:'Копицентр',filter:'Документы',image:'direction-copy',icon:'printer',description:'Документы, фотографии, переплёт'},
    {name:'Проектная документация',short:'Проектная печать',filter:'Проектная печать',image:'direction-project',icon:'document',description:'Чертежи, проекты, готовые альбомы'},
    {name:'Листовая полиграфия',short:'Полиграфия',filter:'Полиграфия',image:'direction-print',icon:'layers',description:'Визитки, листовки, буклеты'},
    {name:'Наклейки и стикеры',short:'Наклейки и стикеры',filter:'Наклейки',image:'direction-stickers',icon:'sticker',description:'Любые формы для ваших идей'},
    {name:'Широкий формат',short:'Широкий формат',filter:'Широкий формат',image:'direction-wide',icon:'wide',description:'Баннеры, постеры, печать на плёнке'},
    {name:'UV-печать и резка',short:'UV-печать и резка',filter:'UV и резка',image:'direction-uv',icon:'scissors',description:'Таблички, изделия, лазерная резка'}
  ];
  const popular = [
    {id:'2.1',name:'Инженерная печать',asset:'инженерная печать',description:'Чертежи и схемы. От А4 до А0.',unit:'10 листов А2 + фальцовка',badge:'Для проектировщиков'},
    {id:'1.1',name:'Печать документов',asset:'печать документов',description:'Чёрно-белая и цветная. А4 и А3.',unit:'10 страниц А4, ч/б'},
    {id:'2.6',name:'Печать дизайн-проектов',asset:'печать дизайн проектов',description:'Цветные альбомы для ваших проектов.',unit:'45 листов, без брошюровки'},
    {id:'1.6',name:'Твёрдый переплёт дипломов',asset:'твердый переплет дипломов',description:'Печать и аккуратная сборка работы.',unit:'50 ч/б + 10 цветных страниц'},
    {id:'3.1',name:'Визитки',asset:'визитки',description:'Плотная бумага. Впечатление надолго.',unit:'100 шт., Color Copy 350 г',badge:'Онлайн-калькулятор'},
    {id:'3.2',name:'Листовки',asset:'листовки',description:'Для акций, событий и продвижения.',unit:'50 шт., А6, 120 г'},
    {id:'6.5',name:'Таблички',asset:'таблички',description:'Для офиса, навигации и вашего бренда.',unit:'10 шт., ПВХ 3 мм, 200 × 100 мм'},
    {id:'4.1',name:'Фигурные стикеры',asset:'фигурные стикеры',description:'Любой контур. Яркий характер.',unit:'100 шт., 50 × 50 мм',badge:'Для ваших идей'},
    {id:'4.4',name:'Стикерпаки',asset:'стикерпаки',description:'Соберите свои идеи в один набор.',unit:'50 наборов, 100 × 150 мм'},
    {id:'4.9',name:'Круглые 3D-стикеры',asset:'круглые 3д стикеры',description:'Объёмные наклейки с прозрачной смолой.',unit:'100 шт., 50 × 50 мм'},
    {id:'5.8',name:'Накатка на ПВХ',asset:'накатка на пвх',description:'Изображения на жёстком пластике.',unit:'10 шт., ПВХ 3 мм, 500 × 500 мм'},
    {id:'6.1',name:'Прямая UV-печать',asset:'прямая уф печать',description:'Печать на пластике, акриле и других материалах.',unit:'10 шт., ПВХ 3 мм, 100 × 100 мм'}
  ].map(p => ({...p, record:catalog.find(r => r.id === p.id)}));
  const getCategory = record => categories.find(c => c.name === record.category);
  const imageFor = record => {
    if(record.id==='1.5')return siteRoot+'assets/service-binding.webp';
    const item=popular.find(p=>p.id===record.id);
    return item ? `${siteRoot}assets/popular-art-${encodeURI(item.asset)}.webp` : `${siteRoot}assets/${getCategory(record)?.image || 'direction-company'}.webp`;
  };
  const examplesFor = record => record.examples.split('•').map(s => s.trim()).filter(Boolean);
  const priceFor = record => { const match=record.examples.match(/—\s*([\d\s\u00a0,]+)\s*₽/);return match ? Number(match[1].replace(/\s/g,'').replace(',','.')) : null; };
  let activeMenu = null;
  let currentRecord = null;
  let selectedFile = null;
  let calcSelection = null;
  let cart = [];
  function readCart(){
    try { const stored=JSON.parse(localStorage.getItem('text-print-cart-v1') || '[]'); return Array.isArray(stored) ? stored.filter(x => x && typeof x.key==='string' && catalog.some(r => r.id===x.id) && typeof x.description==='string' && (x.price===null || Number.isFinite(x.price) && x.price>=0)) : []; } catch { return []; }
  }
  cart=readCart();
  const dialog = $('#dialog');
  const dialogContent = $('#dialog-content');
  function saveCart() { try {localStorage.setItem('text-print-cart-v1',JSON.stringify(cart));}catch {}updateCartCount(); }
  function updateCartCount() { for(const id of ['#cart-count','#mobile-cart-count']){const badge=$(id);if(badge){badge.textContent=cart.length;badge.classList.toggle('has-items',cart.length>0);}} }
  let toastTimer;
  function toast(message) {const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
  function openDialog(html) {closeMenu();$('#navigation').classList.remove('mobile-open');$('#mobile-menu-button').setAttribute('aria-expanded','false');dialogContent.innerHTML=html;document.body.classList.add('modal-open');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;hydrateIcons(dialog);}
  function closeDialog() {dialog.close();}
  dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));
  $('#dialog-close').addEventListener('click',closeDialog);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog();}});

  let menuCloseTimer;
  function closeMenu() {clearTimeout(menuCloseTimer);activeMenu=null;$('#mega-menu').hidden=true;$('#header').append($('#mega-menu'));$$('.nav-item').forEach(b=>b.setAttribute('aria-expanded','false'));}
  function openMenu(name) {
    clearTimeout(menuCloseTimer);
    if(activeMenu===name)return;
    activeMenu=name;
    $$('.nav-item').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.menu===name)));
    const company=name==='Компания';
    const records=catalog.filter(r=>r.category===name);
    const links=company ? `<a href="${siteRoot}#about" data-close-menu>О нас</a><a href="${siteRoot}#contacts" data-close-menu>Контакты</a><a href="${siteRoot}#delivery" data-close-menu>Доставка и оплата</a><button data-action="requirements">Технические требования</button><a href="${siteRoot}#reviews" data-close-menu>Отзывы</a><a href="${siteRoot}#faq" data-close-menu>Вопросы и ответы</a><a href="https://text-print.ru/company/article/" target="_blank" rel="noopener">Статьи</a>` : records.map(r=>serviceUrl(r.id)?`<a href="${serviceUrl(r.id)}">${escape(r.name)}</a>`:`<button data-service="${r.id}">${escape(r.name)}</button>`).join('');
    $('#mega-menu').innerHTML=`<div class="mega-layout"><div><div class="mega-title"><h3>${escape(name)}</h3></div><div class="mega-links">${links}</div></div></div>`;
    const menuLinks=$('.mega-links',$('#mega-menu'));
    menuLinks.style.setProperty('--menu-rows',Math.ceil(menuLinks.children.length/2));
    $('#mega-menu').hidden=false;
    if(matchMedia('(max-width:700px)').matches){$$('.nav-item').find(b=>b.dataset.menu===name).insertAdjacentElement('afterend',$('#mega-menu'));}
    else{$('#header').append($('#mega-menu'));}
  }
  function toggleMenu(name) {if(activeMenu===name)closeMenu();else openMenu(name);}
  $('#navigation').innerHTML=['Компания',...categories.map(c=>c.name)].map(name=>`<button class="nav-item" data-menu="${escape(name)}" aria-expanded="false" aria-controls="mega-menu">${escape(name)} ${icon('chevron')}</button>`).join('');
  $$('.nav-item').forEach(button=>{
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(min-width:701px)').matches&&!dialog.open)openMenu(button.dataset.menu);});
    button.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();openMenu(button.dataset.menu);$('.mega-links button,.mega-links a',$('#mega-menu'))?.focus();}});
  });
  $('#header').addEventListener('pointerenter',()=>clearTimeout(menuCloseTimer));
  $('#header').addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&matchMedia('(min-width:701px)').matches)menuCloseTimer=setTimeout(()=>{if(!$('#mega-menu').contains(document.activeElement))closeMenu();},220);});
  $('#header').addEventListener('focusin',()=>clearTimeout(menuCloseTimer));
  $('#header').addEventListener('focusout',event=>{if(!$('#header').contains(event.relatedTarget))menuCloseTimer=setTimeout(closeMenu,220);});
  $('#footer-services').innerHTML=categories.map(c=>`<button data-action="catalog" data-category="${escape(c.name)}">${escape(c.name)}</button>`).join('');
  function renderPopular() {
    if(!$('#popular-grid'))return;
    $('#popular-grid').innerHTML=popular.filter(p=>p.record).map(p=>`<${serviceUrl(p.id)?`a href="${serviceUrl(p.id)}"`:'button'} class="featured-card" ${serviceUrl(p.id)?'':`data-service="${p.id}"`} aria-label="${escape(p.name)}"><span class="featured-copy"><span class="featured-name">${p.name.split(/\s+/).map(word=>`<span class="featured-word">${escape(word)}</span>`).join(' ')}</span></span><span class="featured-art"><img src="${imageFor(p.record)}" alt="${escape(p.name)} — иллюстрация студии ТЕКСТ" width="720" height="720" loading="lazy"></span></${serviceUrl(p.id)?'a':'button'}>`).join('');
  }
  function renderCatalogList(query='',category='') {
    const normalized=query.toLowerCase().replaceAll('ё','е').trim();
    const found=catalog.filter(r=>(!category||r.category===category)&&`${r.name} ${r.category} ${r.materials}`.toLowerCase().replaceAll('ё','е').includes(normalized));
    $('#catalog-results').innerHTML=found.length ? categories.filter(c=>found.some(r=>r.category===c.name)).map(c=>`<section class="catalog-group"><h3>${escape(c.name)} <small>· ${found.filter(r=>r.category===c.name).length}</small></h3><div class="catalog-group-list">${found.filter(r=>r.category===c.name).map(r=>`<${serviceUrl(r.id)?`a href="${serviceUrl(r.id)}"`:`button data-service="${r.id}"`} class="catalog-service"><span>${escape(r.name)}</span>${icon('arrow')}</${serviceUrl(r.id)?'a':'button'}>`).join('')}</div></section>`).join('') : `<div class="empty-state">${icon('search')}<h3>Пока не нашли такую услугу</h3><p>Попробуйте другое название или расскажите нам о своей задаче.</p><button class="button button-primary" data-action="request">Обсудить заказ</button></div>`;
    $('#search-count').textContent=found.length;
  }
  function openCatalog(category='',search=false,query='') {
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">КАТАЛОГ СТУДИИ ТЕКСТ</div><h2>${escape(category||'Что будем печатать?')}</h2><p class="dialog-intro">Выберите услугу, чтобы посмотреть параметры, примеры стоимости и требования к макету. Найдено: <span id="search-count"></span>.</p><label class="catalog-search">${icon('search')}<input id="catalog-search" aria-label="Поиск услуги" placeholder="Название услуги, материал или задача…" autocomplete="off"></label><div id="catalog-results"></div>${category?'<button class="text-button" data-action="catalog">← Все услуги</button>':''}</div>`);
    $('#catalog-search').value=query;
    renderCatalogList(query,category);
    $('#catalog-search').addEventListener('input',event=>renderCatalogList(event.target.value,category));
    if(search)$('#catalog-search').focus();
  }
  function openService(id) {
    if(serviceUrl(id)){location.href=serviceUrl(id);return;}
    const record=catalog.find(r=>r.id===id);if(!record)return;
    currentRecord=record;
    if(id==='3.1'){openCalculator();return;}
    const examples=examplesFor(record);
    const p=popular.find(p=>p.id===id);
    openDialog(`<div class="dialog-body"><div class="service-summary"><div class="service-summary-copy"><div class="eyebrow muted">${escape(record.category)}</div><h2>${escape(p?.name||record.name)}</h2><p class="dialog-intro">${escape(p?.description||record.materials)}</p></div><img class="service-dialog-image" src="${imageFor(record)}" alt="${escape(record.name)}"></div><h3 class="service-subheading">Варианты и материалы</h3><p class="service-details">${escape(record.materials)}</p>${examples.length?`<h3 class="service-subheading">Примеры стоимости</h3><div class="price-examples">${examples.map(s=>{const i=s.lastIndexOf('—');return i>=0?`<div class="price-example"><span>${escape(s.slice(0,i))}</span><strong>${escape(s.slice(i+1))}</strong></div>`:`<div class="price-example"><span>${escape(s)}</span></div>`;}).join('')}</div><p class="service-sla">Примеры для указанных параметров. Ваш заказ рассчитывается по размеру, материалу и тиражу.</p>`:''}<h3 class="service-subheading">Требования к макету</h3><p class="service-details">${escape(record.requirements)}</p><p class="service-sla">${escape(record.sla)}</p><div class="service-dialog-actions"><button class="button button-primary" data-action="request" data-record="${id}">Получить расчёт ${icon('arrow')}</button><button class="button button-outline" data-add-request="${id}">${icon('bag')} Добавить в запрос</button></div></div>`);
  }
  const calculateCards=window.TEXT_CALCULATE_CARDS;
  function openCalculators() {
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">РАСЧЁТ СТОИМОСТИ</div><h2>Онлайн-калькуляторы</h2><div class="calculator-picker"><div><h3>Визитки</h3><p>Бумага, тираж, печать с одной или двух сторон, ламинация и скругление углов. Стоимость и срок — сразу.</p><button class="button button-primary" data-service="3.1">Рассчитать визитки ${icon('arrow')}</button></div><img src="${siteRoot}assets/calculator-original.webp" alt="Робот ТЕКСТ с калькулятором"></div><div class="calculator-other"><h3>Стикерпаки</h3><p>Материал, размер набора, тираж, стоимость и срок.</p><a class="button button-primary" href="${siteRoot}nakleyki-i-stikery/stikerpaki/#calculator">Рассчитать стикерпаки</a></div><p class="calculator-other">Нужен расчёт документов, наклеек, широкоформатной печати или другой услуги? Выберите её в каталоге и подготовьте запрос в студию.</p><button class="button button-outline" data-action="catalog">Все услуги ${icon('arrow')}</button></div>`);
  }
  function openCalculator() {
    const rules=window.TEXT_PRICING.cards;
    const papers=[...new Set(rules.rates.map(r=>r.paper))];
    const quantities=[...new Set(rules.rates.map(r=>r.quantity))];
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">ЛИСТОВАЯ ПОЛИГРАФИЯ</div><h2>Рассчитать визитки</h2><p class="dialog-intro">Выберите бумагу, тираж и отделку. Стоимость пересчитывается сразу.</p><div class="calc-layout"><form class="form-fields" id="cards-form"><label class="field">Бумага<select name="paper">${papers.map(p=>`<option>${escape(p)}</option>`).join('')}</select></label><label class="field">Печать<select name="sides"><option value="1">Односторонняя</option><option value="2">Двусторонняя</option></select></label><label class="field">Тираж, шт.<select name="quantity">${quantities.map(q=>`<option value="${q}">${q}</option>`).join('')}</select></label><label class="field-checkbox"><input type="checkbox" name="lamination"> Ламинация</label><label class="field-checkbox"><input type="checkbox" name="corners"> Скругление углов</label></form><div class="calc-result" aria-live="polite"><small>СТОИМОСТЬ ТИРАЖА</small><div id="calc-total" class="calc-total"></div><div id="calc-unit" class="calc-unit"></div><div id="calc-selected" class="calc-selected"></div><button class="button button-primary" id="add-cards">${icon('bag')} Добавить в корзину</button><button class="text-button calculator-download" id="download-cards">${icon('download')} Скачать расчёт</button><p id="calc-deadline"></p></div></div><h3 class="service-subheading">Подготовьте макет</h3><p class="service-details">${escape(catalog.find(r=>r.id==='3.1').requirements)}</p></div>`);
    const form=$('#cards-form');
    function update() {
      const paper=form.elements.paper.value,quantity=Number(form.elements.quantity.value),sides=form.elements.sides.value,lamination=form.elements.lamination.checked,corners=form.elements.corners.checked;
      const result=calculateCards(paper,quantity,sides,lamination,corners);
      const description=`${paper}; ${sides==='2'?'двусторонняя':'односторонняя'} печать; ${quantity} шт.; ламинация: ${lamination?'да':'нет'}; скругление: ${corners?'да':'нет'}`;
      calcSelection={...result,description,quantity};
      $('#calc-total').textContent=currency(result.total);
      $('#calc-unit').textContent=`${currency(result.unit)} за штуку`;
      $('#calc-selected').textContent=description;
      const word=result.days===1?'рабочего дня':'рабочих дней';
      $('#calc-deadline').textContent=`Срок: от ${result.days} ${word} после полного согласования макета. Получение и доставку согласуем при подтверждении заказа.`;
    }
    form.addEventListener('change',update);update();
    $('#add-cards').addEventListener('click',()=>{cart=readCart();cart.push({key:crypto.randomUUID(),id:'3.1',description:calcSelection.description,price:calcSelection.total});saveCart();toast('Визитки добавлены в корзину');});
    $('#download-cards').addEventListener('click',()=>{
      const content=['СТУДИЯ ПЕЧАТИ ТЕКСТ','Расчёт визиток',`Дата: ${new Date().toLocaleDateString('ru-RU')}`,'',calcSelection.description,`За штуку: ${currency(calcSelection.unit)}`,`Стоимость тиража: ${currency(calcSelection.total)}`,$('#calc-deadline').textContent,'','Барнаул, проспект Строителей, 11','+7 (923) 654-78-96','tekkkst@yandex.ru'].join('\n');
      const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='ТЕКСТ — расчёт визиток.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('Расчёт визиток скачан');
    });
  }
  function addRequest(id) {
    const record=catalog.find(r=>r.id===id);if(!record)return;
    cart=readCart();
    cart.push({key:crypto.randomUUID(),id,description:'Параметры и тираж — уточнить при расчёте',price:null});saveCart();toast('Услуга добавлена в ваш запрос');
  }
  function openCart() {
    cart=readCart();updateCartCount();
    if(!cart.length){openDialog(`<div class="dialog-body"><h2>Ваша корзина</h2><div class="empty-state">${icon('bag')}<h3>С чего начнём?</h3><p>Рассчитайте визитки или добавьте другие услуги в запрос.<br>Поможем собрать всё в один заказ.</p><button class="button button-primary" data-action="catalog">Выбрать услугу ${icon('arrow')}</button></div></div>`);return;}
    const priced=cart.filter(r=>r.price!==null),cartTotals=window.TEXT_STICKER_CART_BREAKDOWN(cart),total=cartTotals.total;
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">ВАШ ЗАКАЗ</div><h2>Корзина <small>· ${cart.length}</small></h2><p class="dialog-intro">Параметры сохранены в этом браузере. Отправьте запрос в студию, чтобы согласовать макеты и получение.</p><div>${cart.map(r=>`<div class="cart-row"><div><h3>${escape(catalog.find(c=>c.id===r.id).name)}</h3><p>${escape(r.description)}</p>${serviceUrl(r.id)&&r.configuration?`<a class="cart-edit-link" href="${serviceUrl(r.id)}?edit=${encodeURIComponent(r.key)}">Изменить параметры</a>`:''}<div class="cart-file-actions">${r.fileName?`<button data-download-cart-file="${escape(r.key)}">Макет: ${escape(r.fileName)} ↓</button>`:''}<label>${r.fileName?'Заменить макет':'Прикрепить макет'}<input type="file" data-cart-file="${escape(r.key)}" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label></div></div><div class="cart-row-right"><span class="cart-row-price">${r.price===null?'Уточним':currency(r.price)}</span><button class="icon-button" data-remove="${escape(r.key)}" aria-label="Удалить ${escape(catalog.find(c=>c.id===r.id).name)}">${icon('trash')}</button></div></div>`).join('')}</div>${cartTotals.surcharge?`<p class="cart-minimum-note">${Object.entries(cartTotals.surcharges).filter(([,amount])=>amount>0).map(([group,amount])=>`Доплата до минимального чека ${({stickers3d:'3D-стикеров и наборов (1 000 ₽)',stickers:'наклеек и стикерпаков (600 ₽)',uvdtf:'UV-DTF наклеек (800 ₽)',paper:'бумажных стикеров (150 ₽)'})[group]}: ${currency(amount)}.`).join(' ')}</p>`:''}${priced.length?`<div class="cart-summary"><span>${priced.length===cart.length?'Итого за продукцию':'Рассчитанная часть заказа'}</span><strong>${currency(total)}</strong></div>`:''}${priced.length!==cart.length?'<p class="service-sla">Стоимость остальных позиций уточняется после выбора параметров. Доставка рассчитывается отдельно.</p>':'<p class="service-sla">Доставка рассчитывается отдельно.</p>'}<div class="form-actions"><button class="button button-primary" data-action="request" data-cart="true">Подготовить запрос ${icon('arrow')}</button><button class="button button-outline" data-action="catalog">Добавить услугу</button></div></div>`);
  }
  function requestText(form,record,includeCart) {
    const data=new FormData(form);
    let lines=['Здравствуйте! Хочу заказать печать в студии ТЕКСТ.',`Имя: ${data.get('name')}`,`Телефон: ${data.get('phone')}`];
    if(record)lines.push(`Услуга: ${record.name}`);
    if(includeCart)cart.forEach((r,i)=>lines.push(`\n${i+1}. ${catalog.find(c=>c.id===r.id).name}\n${r.description}\n${r.price===null?'Стоимость: требуется расчёт':`Стоимость: ${currency(r.price)}`}`));
    if(includeCart){
      const totals=window.TEXT_STICKER_CART_BREAKDOWN(cart);
      cart.filter(r=>r.fileName).forEach(r=>lines.push(`Макет для ${catalog.find(c=>c.id===r.id).name}: ${r.fileName} (прикреплю к письму)`));
      for(const [group,amount] of Object.entries(totals.surcharges))if(amount>0)lines.push(`Доплата до минимального чека ${({stickers3d:'3D-стикеров и наборов (1 000 ₽)',stickers:'наклеек и стикерпаков (600 ₽)',uvdtf:'UV-DTF наклеек (800 ₽)',paper:'бумажных стикеров (150 ₽)'})[group]}: ${currency(amount)}`);
      lines.push(`Итого за рассчитанные позиции: ${currency(totals.total)}`);
    }
    const comment=String(data.get('comment')||'').trim();if(comment)lines.push(`\nЗадача: ${comment}`);
    if(selectedFile)lines.push(`\nМакет: ${selectedFile.name} (прикреплю к письму)`);
    return lines.join('\n');
  }
  function openRequest(record=null,includeCart=false,upload=false) {
    if(!upload)selectedFile=null;
    openDialog(`<div class="dialog-body request-form"><div class="eyebrow muted">ПОМОЖЕМ С ВАШЕЙ ЗАДАЧЕЙ</div><h2>${upload?'Передать макет':record?escape(record.name):'Обсудить заказ'}</h2><p class="dialog-intro">${includeCart?'Добавим все позиции из корзины в письмо для студии.':'Расскажите, что нужно напечатать. Подготовим письмо с параметрами заказа.'}</p><form id="request-form" class="form-fields"><div class="form-row"><label class="field">Ваше имя<input name="name" required maxlength="100" autocomplete="name" placeholder="Как к вам обращаться"></label><label class="field">Телефон<input name="phone" type="tel" required minlength="6" maxlength="30" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label></div><label class="field">Что нужно напечатать?<textarea name="comment" maxlength="5000" placeholder="Размер, материал, количество и желаемый срок…">${record?escape(record.name)+': ':''}</textarea></label><label class="upload-zone">${icon('upload')}Прикрепите макет<input type="file" id="file-input" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.doc,.docx,.zip"><small>PDF, изображения, исходники или архив · до 100 МБ</small></label><p id="file-feedback" class="file-feedback">Файл нужно прикрепить к письму вручную. Предпочтительный формат для документов — PDF.</p><div class="form-actions"><button class="button button-primary" type="submit">Открыть письмо ${icon('arrow')}</button><button class="button button-outline" type="button" id="download-request">${icon('download')} Скачать запрос</button></div><p class="form-disclosure">Письмо откроется в вашей почтовой программе с получателем <strong>tekkkst@yandex.ru</strong>. Проверьте его и нажмите «Отправить». Если почтовая программа не настроена, скачайте запрос и отправьте его вместе с макетом.</p></form></div>`);
    const form=$('#request-form');
    $('#file-input').addEventListener('change',event=>{
      const file=event.target.files[0];if(!file){selectedFile=null;$('#file-feedback').textContent='Файл нужно прикрепить к письму вручную.';return;}
      if(file.size>100*1024*1024){event.target.value='';selectedFile=null;$('#file-feedback').textContent='Файл больше 100 МБ. Отправьте ссылку на него в комментарии.';return;}
      selectedFile=file;$('#file-feedback').textContent=`Выбран: ${file.name} · ${(file.size/1024/1024).toFixed(2)} МБ. Прикрепите этот файл к письму перед отправкой.`;
    });
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const body=requestText(form,record,includeCart);const a=document.createElement('a');a.href=`mailto:tekkkst@yandex.ru?subject=${encodeURIComponent('Запрос на печать — ТЕКСТ')}&body=${encodeURIComponent(body)}`;a.click();});
    $('#download-request').addEventListener('click',()=>{if(!form.reportValidity())return;const blob=new Blob([requestText(form,record,includeCart)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Запрос на печать — ТЕКСТ.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Запрос подготовлен для отправки в студию');});
  }
  function openContacts() {
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">СТУДИЯ ПЕЧАТИ ТЕКСТ</div><h2>Будем на связи</h2><p class="dialog-intro">Пн–пт 09:00–18:00. Барнаул, проспект Строителей, 11.</p><div class="contact-options"><a class="contact-option" href="tel:+79236547896">${icon('phone')}<strong>Позвонить</strong><span>+7 (923) 654-78-96</span></a><a class="contact-option" href="mailto:tekkkst@yandex.ru">${icon('mail')}<strong>Написать на почту</strong><span>tekkkst@yandex.ru</span></a><a class="contact-option" href="https://t.me/textprint" target="_blank" rel="noopener" id="telegram-link">${icon('send')}<strong>Telegram</strong><span>Отправить вопрос или макет</span></a><a class="contact-option" href="https://2gis.ru/barnaul/firm/70000001043200458" target="_blank" rel="noopener" id="max-link">${icon('send')}<strong>MAX</strong><span>Открыть контакты студии в 2ГИС</span></a></div><div class="form-actions"><button class="button button-outline" data-action="request">Подготовить запрос ${icon('arrow')}</button></div></div>`);
    $('#telegram-link').href=window.TEXT_CONTACTS?.telegram||'https://2gis.ru/barnaul/firm/70000001043200458';
    $('#max-link').href=window.TEXT_CONTACTS?.max||'https://2gis.ru/barnaul/firm/70000001043200458';
    if(window.TEXT_CONTACTS?.max)$('#max-link span').textContent='Отправить вопрос или макет';
  }
  function openRequirements() {
    openDialog(`<div class="dialog-body"><div class="eyebrow muted">ПЕРЕД ПЕЧАТЬЮ</div><h2>Требования к макетам</h2><p class="dialog-intro">Точные требования зависят от продукта. В карточке выбранной услуги есть подсказки по подготовке файла.</p><div class="requirements-list"><div class="requirements-item"><h3>Документы, чертежи и проекты</h3><p>Предпочтительно PDF. Проверьте формат и ориентацию страниц, порядок листов, нумерацию, таблицы и цветные вставки. Сохраните Word в PDF, чтобы шрифты и страницы оставались на месте.</p></div><div class="requirements-item"><h3>Полиграфия</h3><p>Готовьте макет под конечный размер продукта. Учтите вылеты под обрезку и безопасные поля. Важные элементы не должны находиться вплотную к линии реза.</p></div><div class="requirements-item"><h3>Наклейки и изделия с резкой</h3><p>Для фигурных наклеек нужен отдельный контур резки. Для прозрачных и голографических материалов заранее согласуйте белую подложку. Между элементами стикерпака оставьте технологические расстояния.</p></div></div><div class="form-actions"><button class="button button-primary" data-action="upload">${icon('upload')} Подготовить макет к отправке</button></div></div>`);
  }
  const deliveryContent={pickup:'<strong>Проспект Строителей, 11</strong><p>Пн–пт 09:00–18:00. Самовывоз — бесплатно.</p>',city:'<strong>Курьером по Барнаулу — от 300 ₽</strong><p>В течение одного дня после готовности. Для малогабаритных заказов от 5 000 ₽ — бесплатно. Стоимость зависит от размера заказа.</p>',country:'<strong>СДЭК, ПЭК, Деловые Линии</strong><p>Доставка в любой город России. Срок и стоимость зависят от города и размера заказа; согласуем их перед отправкой.</p>'};
  function selectDelivery(name){$$('[data-delivery]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.delivery===name));b.tabIndex=b.dataset.delivery===name?0:-1;});$('#delivery-details').innerHTML=deliveryContent[name];$('#delivery-details').setAttribute('aria-labelledby','tab-'+name);}
  document.addEventListener('click',event=>{
    const calculatorLink=event.target.closest('[data-action="calculators"]');if(calculatorLink){openCalculators();return;}
    const menu=event.target.closest('[data-menu]');if(menu){if(event.detail>0&&matchMedia('(min-width:701px) and (hover:hover)').matches)openMenu(menu.dataset.menu);else toggleMenu(menu.dataset.menu);return;}
    const close=event.target.closest('[data-close-menu]');if(close){closeMenu();$('#navigation').classList.remove('mobile-open');$('#mobile-menu-button').setAttribute('aria-expanded','false');}
    const service=event.target.closest('[data-service]');if(service){openService(service.dataset.service);return;}
    const add=event.target.closest('[data-add-request]');if(add){addRequest(add.dataset.addRequest);return;}
    const remove=event.target.closest('[data-remove]');if(remove){window.TEXT_FILES.remove(remove.dataset.remove).catch(()=>{});cart=readCart().filter(r=>r.key!==remove.dataset.remove);saveCart();openCart();return;}
    const delivery=event.target.closest('[data-delivery]');if(delivery){selectDelivery(delivery.dataset.delivery);return;}
    const action=event.target.closest('[data-action]');if(action){switch(action.dataset.action){case 'catalog':openCatalog(action.dataset.category||'');break;case 'search':openCatalog('',true);break;case 'request':openRequest(action.dataset.record?catalog.find(r=>r.id===action.dataset.record):null,action.dataset.cart==='true');break;case 'upload':selectedFile=null;openRequest(null,false,true);break;case 'cart':openCart();break;case 'contacts':openContacts();break;case 'requirements':openRequirements();break;}return;}
    if(!event.target.closest('.site-header'))closeMenu();
  });
  $('#mobile-menu-button').addEventListener('click',()=>{closeMenu();const expanded=$('#navigation').classList.toggle('mobile-open');$('#mobile-menu-button').setAttribute('aria-expanded',String(expanded));});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menuTrigger=$$('.nav-item').find(button=>button.dataset.menu===activeMenu);closeMenu();menuTrigger?.focus();$('#navigation').classList.remove('mobile-open');$('#mobile-menu-button').setAttribute('aria-expanded','false');}if(event.key==='/'&&!dialog.open&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();openCatalog('',true);}});
  $('.delivery-tabs')?.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=$$('[data-delivery]');const index=tabs.findIndex(b=>b.getAttribute('aria-selected')==='true');const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectDelivery(tabs[next].dataset.delivery);tabs[next].focus();});
  $('#home-search').addEventListener('submit',event=>{event.preventDefault();openCatalog('',true,$('#home-search-input').value.trim());});
  const clientStrip=$('#client-logos');
  if(clientStrip){
  const clientSection=clientStrip.closest('.clients-section');
  const clientMotion=matchMedia('(prefers-reduced-motion:reduce)');
  const clientItems=[...clientStrip.children];
  // Copies on both sides let the strip wrap without a visible rewind.
  const cloneClients=()=>clientItems.map(item=>{const copy=item.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.querySelector('img').alt='';return copy;});
  const clientPrefix=cloneClients();
  clientStrip.prepend(...clientPrefix);
  clientStrip.append(...cloneClients());
  clientStrip.classList.add('is-carousel');
  let clientCycleWidth=0,clientFrame=0,clientLastTime=0,clientRemainder=0;
  let clientHovered=false,clientFocused=false,clientDragging=false,clientVisible=false;
  let clientResumeAt=0,clientResumeTimer=0;
  const positionClients=position=>{if(clientCycleWidth)clientStrip.scrollLeft=clientCycleWidth+((position-clientCycleWidth)%clientCycleWidth+clientCycleWidth)%clientCycleWidth;};
  const measureClients=()=>{
    const phase=clientCycleWidth?(clientStrip.scrollLeft-clientCycleWidth)/clientCycleWidth:0;
    clientCycleWidth=clientItems[0].getBoundingClientRect().left-clientPrefix[0].getBoundingClientRect().left;
    positionClients(clientCycleWidth*(1+phase));
  };
  const canAutoScrollClients=time=>clientVisible&&!document.hidden&&!clientMotion.matches&&!clientHovered&&!clientFocused&&!clientDragging&&time>=clientResumeAt;
  const scheduleClients=()=>{if(!clientFrame){clientLastTime=0;clientFrame=requestAnimationFrame(animateClients);}};
  function animateClients(time){
    clientFrame=0;
    const elapsed=clientLastTime?Math.min(time-clientLastTime,64):0;
    clientLastTime=time;
    if(canAutoScrollClients(time)){
      // Keep fractional pixels between frames so slow motion also works on screens that round scrollLeft.
      clientRemainder+=elapsed*24/1000;
      const pixels=Math.floor(clientRemainder);
      clientRemainder-=pixels;
      if(pixels)positionClients(clientStrip.scrollLeft+pixels);
    }
    if(canAutoScrollClients(time))clientFrame=requestAnimationFrame(animateClients);
  }
  const holdClientAutoplay=()=>{
    clientResumeAt=performance.now()+4000;
    clearTimeout(clientResumeTimer);
    clientResumeTimer=setTimeout(scheduleClients,4050);
  };
  clientSection.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')clientHovered=true;});
  clientSection.addEventListener('pointerleave',()=>{clientHovered=false;scheduleClients();});
  clientSection.addEventListener('focusin',()=>{clientFocused=true;});
  clientSection.addEventListener('focusout',event=>{clientFocused=clientSection.contains(event.relatedTarget);scheduleClients();});
  clientStrip.addEventListener('pointerdown',()=>{clientDragging=true;holdClientAutoplay();},{passive:true});
  window.addEventListener('pointerup',()=>{if(clientDragging){clientDragging=false;holdClientAutoplay();scheduleClients();}},{passive:true});
  window.addEventListener('pointercancel',()=>{clientDragging=false;scheduleClients();},{passive:true});
  const handleClientGesture=()=>{holdClientAutoplay();};
  clientStrip.addEventListener('wheel',handleClientGesture,{passive:true});
  clientStrip.addEventListener('keydown',handleClientGesture);
  clientStrip.addEventListener('scroll',()=>{if(clientStrip.scrollLeft<clientCycleWidth||clientStrip.scrollLeft>=clientCycleWidth*2)positionClients(clientStrip.scrollLeft);},{passive:true});
  document.addEventListener('visibilitychange',scheduleClients);
  clientMotion.addEventListener('change',scheduleClients);
  new ResizeObserver(()=>{measureClients();scheduleClients();}).observe(clientStrip);
  new IntersectionObserver(entries=>{clientVisible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.1;scheduleClients();},{threshold:.1}).observe(clientStrip);
  measureClients();
  }
  window.addEventListener('resize',()=>{if(activeMenu)closeMenu();},{passive:true});
  const seoSchema={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'LocalBusiness',name:'Студия печати ТЕКСТ',url:'https://text-print.ru/',telephone:'+79236547896',email:'tekkkst@yandex.ru',address:{'@type':'PostalAddress',streetAddress:'проспект Строителей, 11',addressLocality:'Барнаул',addressCountry:'RU'},openingHoursSpecification:[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'09:00',closes:'18:00'}]},
      {'@type':'FAQPage',mainEntity:$$('.faq-list details').map(d=>({'@type':'Question',name:$('summary',d).textContent.trim(),acceptedAnswer:{'@type':'Answer',text:$('p',d).textContent.trim()}}))}
    ]
  };
  const schemaScript=document.createElement('script');schemaScript.type='application/ld+json';schemaScript.textContent=JSON.stringify(seoSchema);document.head.append(schemaScript);
  window.TEXT_APP={
    notify:toast,openCart,
    getCart:()=>readCart().map(item=>({...item})),
    upsertCalculatedItem(item){cart=readCart();const index=cart.findIndex(r=>r.key===item.key);if(index<0)cart.push(item);else cart[index]=item;saveCart();}
  };
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-download-cart-file]');if(!button)return;
    const item=cart.find(r=>r.key===button.dataset.downloadCartFile);if(!item)return;
    try{await window.TEXT_FILES.download(item.key,item.fileName);}catch(error){toast(error.message);}
  });
  document.addEventListener('change',async event=>{
    const input=event.target.closest('[data-cart-file]');if(!input||!input.files[0])return;
    const item=cart.find(r=>r.key===input.dataset.cartFile);if(!item)return;
    const file=input.files[0],error=window.TEXT_FILES.validate(file);if(error){toast(error);input.value='';return;}
    try{await window.TEXT_FILES.save(item.key,file);cart=readCart();const current=cart.find(r=>r.key===item.key);if(!current){await window.TEXT_FILES.remove(item.key);return;}current.fileName=file.name;current.fileSize=file.size;saveCart();openCart();toast('Макет сохранён в этом браузере. Прикрепите его к письму при отправке запроса.');}catch{toast('Не удалось сохранить макет. Попробуйте ещё раз.');}
  });
  window.addEventListener('storage',event=>{if(event.key==='text-print-cart-v1'||event.key===null){cart=readCart();updateCartCount();}});
  window.addEventListener('pageshow',()=>{cart=readCart();updateCartCount();});
  renderPopular();updateCartCount();hydrateIcons();
})();
