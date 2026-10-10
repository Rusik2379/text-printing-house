import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),c={};c.window=c;vm.createContext(c);
for(const name of ['sticker','copycenter','project','leaflet','wide-format','uv'])vm.runInContext(await readFile(new URL(name+'-services.js',root),'utf8'),c);
const services=Object.assign({},c.TEXT_STICKER_SERVICES,c.TEXT_COPYCENTER_SERVICES,c.TEXT_PROJECT_SERVICES,c.TEXT_LEAFLET_SERVICES,c.TEXT_WIDE_SERVICES,c.TEXT_UV_SERVICES);
assert.equal(Object.keys(services).length,55);
for(const [id,s] of Object.entries(services)){
 const html=await readFile(new URL(s.path+'index.html',root),'utf8');
 assert.equal((html.match(/class="[^"]*\breq-inline-v2\b/g)||[]).length,1,id+': individual technical requirements missing/duplicated');
 assert.equal((html.match(/<section\b[^>]*class="[^"]*\bgeo-answer(?:\s|")/g)||[]).length,1,id+': static GEO answers missing/duplicated');
 assert.equal((html.match(/class="intent-block(?: container)?"/g)||[]).length,1,id+': semantic block missing/duplicated');
 assert.ok(html.includes('data-print-requirements'),id+': printable checklist missing');
 for(const text of ['Файл и технический минимум','Критично','Не делайте так','Что проверяем перед запуском','Заказ без скрытых условий'])assert.ok(html.includes(text),id+': '+text);
 assert.ok(html.includes('id="service-geo-'+id.replace('.','-')+'"'),id+': GEO identity mismatch');
}
await access(new URL('nakleyki-i-stikery/index.html',root));
for(const path of ['index.html','company/about/index.html','requirements/index.html','company/article/index.html']){
 const html=await readFile(new URL(path,root),'utf8');
 assert.ok(html.includes('site-chrome.js'),path+': shared navigation/top control not included');
 assert.ok(html.includes('data-header-search'),path+': header search missing');
 assert.ok(html.includes('class="nav-category-link"'),path+': direct section links missing');
}
console.log('55 static service checklists/GEO/semantic blocks and shared header contracts passed.');
