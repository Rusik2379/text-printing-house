// Check the static site as it would be served from a GitHub Pages subdirectory.
import assert from 'node:assert/strict';
import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=new URL('https://example.test/text-printing-house/');
async function htmlFiles(dir){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||['node_modules','preview'].includes(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...await htmlFiles(file));
    else if(entry.name.endsWith('.html'))result.push(file);
  }
  return result;
}
const files=await htmlFiles(root), contents=new Map(), titles=new Set();
for(const file of files)contents.set(file,await readFile(file,'utf8'));
let links=0;
for(const [file,html] of contents){
  const relative=path.relative(root,file).split(path.sep).join('/');
  assert.equal([...html.matchAll(/<h1\b/gi)].length,1,`${relative}: expected one H1`);
  assert.ok(!html.includes('SOURCE:'),`${relative}: unresolved archive link`);
  const title=html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  assert.ok(title&&!titles.has(title),`${relative}: missing or repeated title`);
  titles.add(title);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,`${relative}: repeated element ID`);
  for(const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))JSON.parse(block[1]);
  for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
    const url=new URL(match[1].replaceAll('&amp;','&'),new URL(relative,base));
    if(url.origin!==base.origin)continue;
    assert.ok(url.pathname.startsWith(base.pathname),`${relative}: link leaves the project directory: ${match[1]}`);
    let target=path.join(root,decodeURIComponent(url.pathname.slice(base.pathname.length)));
    let info;
    try{info=await stat(target);}catch{assert.fail(`${relative}: missing resource ${match[1]}`);}
    if(info.isDirectory())target=path.join(target,'index.html');
    await stat(target);
    if(url.hash){
      const targetHtml=contents.get(target);
      if(targetHtml){
        const fragment=decodeURIComponent(url.hash.slice(1));
        assert.ok([...targetHtml.matchAll(/\bid="([^"]+)"/g)].some(m=>m[1]===fragment),`${relative}: missing anchor ${match[1]}`);
      }
    }
    links++;
  }
}
const articles=JSON.parse(await readFile(path.join(root,'company-articles.json'),'utf8')).articles;
assert.equal(articles.length,150,'Expected all 150 articles from the latest customer archive');
assert.equal(new Set(articles.map(a=>a.path)).size,articles.length,'Repeated article URL');
for(const article of articles){
  const html=contents.get(path.join(root,article.path,'index.html'));
  assert.ok(html?.includes('class="company-reading"'),`Missing article body: ${article.title}`);
}
const source=JSON.parse(await readFile(path.join(root,'company-content.json'),'utf8'));
assert.equal(source.source.archive,'TEKST_HTML_site_FINAL_SEO_GEO_1100.zip','Wrong content version');
assert.equal(source.source.seo_article_rows_verified,150,'SEO workbook coverage');
assert.equal(source.source.seo_requirement_rows_verified,55,'Requirements differ from the SEO workbook');
assert.equal(source.requirements.length,55,'Expected requirements for every service');
assert.ok(source.source.preserved_article_paths.every(url=>articles.some(a=>a.path===url)),'An existing article URL changed');
const requirements=contents.get(path.join(root,'requirements/index.html'));
const requirementIds=[...requirements.matchAll(/<details\b[^>]*data-service-requirement="([^"]+)"/g)].map(match=>match[1]);
assert.equal(requirementIds.length,55,'Missing service requirements');
assert.deepEqual(requirementIds.toSorted(),source.requirements.map(item=>item.id).toSorted(),'Service requirement coverage changed');
for(const article of source.articles){
  const html=contents.get(path.join(root,article.path,'index.html'));
  const body=html.slice(html.indexOf('<article class="company-reading">'),html.indexOf('</article>',html.indexOf('<article class="company-reading">')));
  assert.equal([...body.matchAll(/<h2\b/g)].length,article.blocks.filter(b=>b.tag==='h2').length,`${article.title}: missing section`);
  assert.equal([...body.matchAll(/<table\b/g)].length,article.blocks.filter(b=>b.tag==='table').length,`${article.title}: missing comparison table`);
  const expectedParagraphs=article.blocks.filter(b=>b.tag==='p').length;
  const faqQuestions=[...body.matchAll(/<summary\b/g)].length;
  assert.equal([...body.matchAll(/<p\b/g)].length+faqQuestions,expectedParagraphs,`${article.title}: incomplete article paragraphs or FAQ`);
}
for(const page of ['company/about','contacts','dostavka-i-oplata','company/payment','requirements','company/photo','company/action','company/request','company/vopros-otvet','company/article','company','kak-oformit-zakaz']){
  assert.ok(contents.has(path.join(root,page,'index.html')),`Missing company page: ${page}`);
}
console.log(`Checked ${files.length} pages, ${links} local links/resources and ${articles.length} complete articles under ${base.pathname}.`);
