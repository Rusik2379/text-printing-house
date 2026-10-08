import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(await readFile(path.join(root,'seo-content.json'),'utf8'));
const config=JSON.parse(await readFile(path.join(root,'seo-config.json'),'utf8'));
const origin=new URL(source.origin);
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
async function pages(dir){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||['node_modules','preview'].includes(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...await pages(file));
    else if(entry.name.endsWith('.html'))result.push(file);
  }
  return result;
}
const files=await pages(root),canonicals=new Map(),titles=new Set(),indexable=new Set();
for(const file of files){
  const relative=path.relative(root,file).split(path.sep).join('/');
  const route=relative==='index.html'?'/':'/'+relative.replace(/index\.html$/,'');
  const html=await readFile(file,'utf8');
  const head=html.match(/<head>([\s\S]*?)<\/head>/)[1];
  assert.ok(!source.excluded_routes.includes(route),`${route}: removed page returned`);
  const expected=new URL(route,origin).href;
  const canonical=[...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(canonical.length,1,`${route}: missing/duplicate canonical`);
  assert.equal(canonical[0][1],expected,`${route}: source URL was not adapted`);
  canonicals.set(expected,file);
  const title=head.match(/<title>(.*?)<\/title>/s)[1];
  assert.ok(title&&!titles.has(title),`${route}: repeated title`);titles.add(title);
  const metas=new Map();
  for(const tag of head.matchAll(/<meta\b[^>]*(?:name|property)="([^"]+)"[^>]*content="([^"]*)"[^>]*>/g)){
    assert.ok(!metas.has(tag[1]),`${route}: duplicate ${tag[1]}`);metas.set(tag[1],decode(tag[2]));
  }
  assert.ok(metas.get('description')?.length,`${route}: description missing`);
  assert.equal(metas.get('og:title'),decode(title),`${route}: sharing title differs`);
  assert.equal(metas.get('og:description'),metas.get('description'),`${route}: sharing description differs`);
  assert.equal(metas.get('og:url'),expected,`${route}: sharing URL differs`);
  assert.equal(metas.get('og:locale'),'ru_RU');
  const productionRobots=route.startsWith('/company/')&&['privacy','personal-data-consent','cookies','font-license'].some(page=>route===`/company/${page}/`)?'noindex,follow':'index,follow';
  if(!productionRobots.includes('noindex'))indexable.add(expected);
  assert.equal(metas.get('robots'),config.mode==='preview'?'noindex, nofollow':productionRobots,`${route}: incorrect indexing mode`);
  const image=new URL(metas.get('og:image'));
  assert.equal(image.origin,origin.origin,`${route}: unknown sharing image host`);
  await stat(path.join(root,decodeURIComponent(image.pathname)));
  const blocks=[...head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  assert.equal(blocks.length,1,`${route}: expected one static graph`);
  const graph=blocks[0]['@graph'];
  const business=graph.filter(entity=>entity['@type']==='LocalBusiness');
  assert.equal(business.length,1,`${route}: business missing/duplicated`);
  assert.equal(business[0]['@id'],origin.href+'#studio');
  assert.ok(!business[0].aggregateRating,`${route}: ratings must not be invented`);
  for(const entity of graph){
    if(entity.url&&entity['@type']!=='LocalBusiness')assert.equal(entity.url,expected);
    if(entity['@type']==='BreadcrumbList')for(const item of entity.itemListElement){
      const url=new URL(item.item);
      assert.equal(url.origin,origin.origin);
      await stat(path.join(root,decodeURIComponent(url.pathname),'index.html'));
    }
  }
  if(route.startsWith('/company/article/')&&route!=='/company/article/'){
    const article=graph.filter(entity=>entity['@type']==='Article');
    assert.equal(article.length,1,`${route}: article schema missing`);
    assert.equal(article[0].mainEntityOfPage,expected);
    assert.ok(article[0].datePublished&&article[0].dateModified&&article[0].image?.length);
  }
}
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>decode(m[1]));
assert.equal(urls.length,new Set(urls).size,'Duplicate sitemap URL');
assert.deepEqual(new Set(urls),indexable,'Sitemap must contain every existing indexable page');
for(const url of urls){
  assert.ok(canonicals.has(url),`Sitemap points to an absent route: ${url}`);
  assert.ok(!source.excluded_routes.some(route=>new URL(url).pathname===route));
  assert.ok(!/\?|#/.test(url),'Sitemap must not contain calculation parameters');
}
assert.equal(source.source.html_pages,232);
assert.equal(Object.keys(source.service_search_terms).length,55);
const robots=await readFile(path.join(root,'robots.txt'),'utf8');
assert.equal(robots.includes(`Sitemap: ${origin.href}sitemap.xml`),config.mode==='production','Sitemap announcement does not match publishing mode');
console.log(`Verified static SEO and sharing images for ${files.length} pages; ${urls.length} production sitemap URLs, ${config.mode} mode.`);
