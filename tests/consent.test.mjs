import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const code=readFileSync(new URL('../consent.js',import.meta.url),'utf8');
const key='text-print-consent-v1';
const saved=(analytics,age=0)=>JSON.stringify({version:1,analytics,updatedAt:new Date(Date.now()-age).toISOString()});

// A browser boundary fake: run the shipped script, observe storage and network requests.
function browser({hostname='text-print.ru',stored,blockedStorage=false,cookies=[]}={}){
  const values=new Map([['text-print-cart-v1','[{"id":"3.1"}]'],['_ym_uid','123']]);
  if(stored!==undefined)values.set(key,stored);
  const events=new Map(),scripts=[],calls=[],expired=[];
  const element=(dataset={})=>({dataset,hidden:false,listeners:new Map(),
    addEventListener(name,fn){this.listeners.set(name,fn);},
    click(){document.activeElement=this;this.listeners.get('click')?.();},
    focus(){document.activeElement=this;},remove(){this.removed=true;}});
  const necessary=element({cookieChoice:'necessary'}),analytics=element({cookieChoice:'analytics'});
  const status=element(),settings=element(),banner=element();
  banner.querySelectorAll=()=>[necessary,analytics];
  banner.querySelector=selector=>selector.includes('current')?status:necessary;
  banner.contains=target=>[necessary,analytics].includes(target);
  const document={title:'ТЕКСТ',activeElement:null,head:{append(tag){scripts.push(tag);}},
    querySelector:()=>banner,querySelectorAll:()=>[settings],createElement:()=>element()};
  Object.defineProperty(document,'cookie',{get:()=>cookies.join(';'),set:value=>expired.push(value)});
  const localStorage={getItem(name){if(blockedStorage)throw Error('disabled');return values.get(name)??null;},
    setItem(name,value){if(blockedStorage)throw Error('disabled');values.set(name,value);},
    removeItem(name){values.delete(name);},key(index){return [...values.keys()][index];},get length(){return values.size;}};
  const window={ym:(...args)=>calls.push(args),addEventListener:(name,fn)=>events.set(name,fn)};
  const location={hostname,origin:'https://'+hostname,pathname:'/company/',search:'?private=do-not-report'};
  vm.runInNewContext(code,{window,document,localStorage,location,Date,JSON});
  return {banner,necessary,analytics,settings,status,scripts,calls,values,expired,document,
    storage(value){if(value===null)values.delete(key);else values.set(key,value);events.get('storage')({key});},
    escape(){banner.listeners.get('keydown')({key:'Escape'});},
    load(){scripts.at(-1).onload?.();}};
}

test('No choice means visible banner and no analytics request',()=>{
  const b=browser();
  assert.equal(b.banner.hidden,false);
  assert.equal(b.scripts.length,0);
  assert.equal(b.calls.length,0);
});

test('Refusal persists across page loads and keeps the cart',()=>{
  const b=browser();b.necessary.click();
  assert.equal(JSON.parse(b.values.get(key)).analytics,false);
  assert.equal(b.banner.hidden,true);
  assert.equal(b.scripts.length,0);
  assert.equal(b.values.get('text-print-cart-v1'),'[{"id":"3.1"}]');
  assert.equal(browser({stored:b.values.get(key)}).banner.hidden,true);
});

test('Production consent loads once, excludes query parameters and disables recordings',()=>{
  const b=browser();b.analytics.click();
  assert.equal(b.scripts.length,1);
  assert.equal(b.calls.length,0,'Do not initialize before script has loaded');
  b.load();b.load();
  assert.deepEqual(b.calls.map(args=>args[1]),['init','hit']);
  assert.equal(b.calls[0][2].webvisor,false);
  assert.equal(b.calls[0][2].defer,true);
  assert.equal(b.calls[1][2],'https://text-print.ru/company/');
  b.settings.click();b.analytics.click();
  assert.equal(b.scripts.length,1);
});

test('Existing valid production consent applies on the next page',()=>{
  const b=browser({stored:saved(true)});
  assert.equal(b.banner.hidden,true);
  assert.equal(b.scripts.length,1);
});

test('Local, preview and look-alike hosts do not load analytics even with consent',()=>{
  for(const hostname of ['127.0.0.1','localhost','rusik2379.github.io','text-print.ru.example.test']){
    const b=browser({hostname,stored:saved(true)});b.analytics.click();
    assert.equal(b.scripts.length,0,hostname);
  }
});

test('Revoke stops the initialized counter and clears only analytics data',()=>{
  const b=browser({hostname:'www.text-print.ru',cookies:['_ym_uid=123','cart=keep']});
  b.analytics.click();b.load();b.necessary.click();
  assert.equal(b.calls.at(-1)[1],'destruct');
  assert.equal(b.scripts[0].removed,true);
  assert.equal(b.values.has('_ym_uid'),false);
  assert.equal(b.values.has('text-print-cart-v1'),true);
  assert.ok(b.expired.some(value=>value.includes('domain=.text-print.ru')));
  assert.ok(b.expired.every(value=>value.startsWith('_ym_uid=')));
  b.analytics.click();b.load();
  assert.equal(b.calls.filter(args=>args[1]==='init').length,2);
});

test('Revoking a pending request prevents late load/error handlers affecting a new choice',()=>{
  const b=browser();b.analytics.click();
  const old=b.scripts[0],lateLoad=old.onload,lateError=old.onerror;
  b.necessary.click();b.analytics.click();
  lateLoad();lateError();
  assert.equal(b.calls.length,0);
  assert.equal(b.scripts[1].removed,undefined);
  b.load();assert.equal(b.calls.length,2);
});

test('Failed load can retry without phantom initialization',()=>{
  const b=browser();b.analytics.click();b.scripts[0].onerror();
  assert.equal(b.calls.length,0);
  b.settings.click();b.analytics.click();b.load();
  assert.equal(b.calls.length,2);
});

test('Expired, future, corrupt or old-version choices require a new selection',()=>{
  for(const stored of ['oops','null','{}',saved('yes'),saved(true,180*86400000+1000),saved(true,-86400000),saved(true).replace('"version":1','"version":0')]){
    const b=browser({stored});assert.equal(b.banner.hidden,false,stored);assert.equal(b.scripts.length,0);
  }
});

test('Storage restrictions preserve immediate refusal without throwing',()=>{
  const b=browser({blockedStorage:true});b.necessary.click();
  assert.equal(b.banner.hidden,true);assert.equal(b.scripts.length,0);
});

test('Settings preserve the choice, support Escape and restore keyboard focus',()=>{
  const b=browser();b.necessary.click();b.settings.click();
  assert.equal(b.banner.hidden,false);assert.equal(b.status.hidden,false);
  assert.equal(b.document.activeElement,b.necessary);
  b.escape();assert.equal(b.banner.hidden,true);assert.equal(b.document.activeElement,b.settings);
  b.settings.click();b.analytics.click();assert.equal(b.document.activeElement,b.settings);
});

test('Another tab can allow, revoke or clear the choice',()=>{
  const b=browser();b.storage(saved(true));b.load();
  b.storage(saved(false));assert.equal(b.calls.at(-1)[1],'destruct');
  assert.equal(b.banner.hidden,true);
  b.storage(null);assert.equal(b.banner.hidden,false);
});
