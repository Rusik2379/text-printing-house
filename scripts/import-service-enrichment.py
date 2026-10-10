"""Import the customer's third reference as content, without running its scripts."""
from pathlib import Path
import argparse,json,hashlib,re
from lxml import html

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('reference',type=Path)
parser.add_argument('--rendered-data',type=Path,required=True,help='Reviewed requirements and SVG exported from reference')
args=parser.parse_args()
ref=args.reference.resolve()
rendered=json.loads(args.rendered_data.read_text(encoding='utf8'))
terms=json.JSONDecoder().raw_decode((ref/'seo-final.js').read_text(encoding='utf-8-sig').removeprefix('window.TEKST_SEO_FINAL='))[0]
requirements=rendered['requirements']['services']
assert len(requirements)==len(rendered['services'])==len(terms)==55
services={}
for s in rendered['services']:
    id=s['id'];route=s['url'].strip('/')+'/'
    file=ref/route/'index.html';assert file.resolve().is_relative_to(ref)
    doc=html.fromstring(file.read_bytes())
    cards=doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," geo-answer-card ")]')
    assert len(cards)==5,(id,len(cards))
    answers=[{'title':n.xpath('string(./h3)'),'text':' '.join(n.xpath('string(./p)').split())} for n in cards]
    tech=requirements[id]
    assert all(tech.get(k) for k in ['send','checks','example','fileSpec','critical','mistakes','preflight']),id
    scheme=rendered['schemes'][id]
    assert '<script' not in scheme and not re.search(r'\bon\w+=',scheme)
    services[id]={'id':id,'name':s['name'],'path':route,'technical':tech,'schemeHtml':scheme,'answers':answers,'terms':terms[id]['terms'][:8]}

payload={'source':{'folder':ref.name,'imported':'2026-10-10','requirements_updated':rendered['requirements']['updated'],'services':55},'services':services}
(ROOT/'service-enrichment.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
seo=json.loads((ROOT/'seo-content.json').read_text(encoding='utf8'))
changed=0;digest=hashlib.sha256();count=0
for file in sorted(ref.rglob('*.html')):
    data=file.read_bytes();digest.update(data);count+=1
    route='/' if file.relative_to(ref).as_posix()=='index.html' else '/'+file.relative_to(ref).as_posix().removesuffix('index.html')
    doc=html.fromstring(data)
    meta={n.get('name') or n.get('property'):n.get('content') for n in doc.xpath('//head/meta[@name or @property]')}
    item={'title':doc.xpath('string(//title)'),'description':meta.get('description',''),'canonical':doc.xpath('string(//link[@rel="canonical"]/@href)'),'robots':meta.get('robots','index,follow'),'open_graph':{k:v for k,v in meta.items() if k.startswith('og:')},'schema':[json.loads(n.text) for n in doc.xpath('//script[@type="application/ld+json"]')]}
    if seo['pages'].get(route)!=item:changed+=1
    seo['pages'][route]=item
seo['source'].update({'archive':ref.name,'sha256':digest.hexdigest(),'imported':'2026-10-10','html_pages':count})
seo['service_search_terms']=terms
(ROOT/'seo-content.json').write_text(json.dumps(seo,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Imported 55 technical/GEO/semantic profiles; refreshed {changed} of {count} reference SEO pages.')
