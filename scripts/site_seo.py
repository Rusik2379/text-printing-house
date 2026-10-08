"""Apply imported SEO to existing routes, keeping all visible HTML unchanged."""
from copy import deepcopy
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import quote, urljoin, urlsplit, unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

def plain(value):
    return re.sub(r'\s+', ' ', unescape(re.sub('<[^>]+>', ' ', value))).strip()

class PageFacts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.main = False
        self.image = ''
        self.heading = []
        self.in_h1 = False
        self.crumbs = []
        self.in_crumbs = False
        self.link = None
        self.faq_depth = 0
        self.div_depth = 0
        self.detail = None
        self.summary = False
        self.questions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'main': self.main = True
        if not self.main: return
        if tag == 'h1': self.in_h1 = True
        if tag == 'img' and not self.image: self.image = attrs.get('src', '')
        if tag == 'nav' and 'breadcrumb' in attrs.get('class', ''): self.in_crumbs = True
        if self.in_crumbs and tag == 'a': self.link = [attrs.get('href', ''), []]
        if tag == 'div':
            self.div_depth += 1
            if 'faq-list' in attrs.get('class', '').split(): self.faq_depth = self.div_depth
        if self.faq_depth and tag == 'details': self.detail = [[], []]
        if self.detail is not None and tag == 'summary': self.summary = True

    def handle_endtag(self, tag):
        if not self.main: return
        if tag == 'main': self.main = False
        if tag == 'h1': self.in_h1 = False
        if tag == 'nav': self.in_crumbs = False
        if tag == 'a' and self.link is not None:
            self.crumbs.append((self.link[0], ' '.join(' '.join(self.link[1]).split())))
            self.link = None
        if tag == 'summary': self.summary = False
        if tag == 'details' and self.detail is not None:
            question, answer = [' '.join(' '.join(parts).split()) for parts in self.detail]
            if question and answer: self.questions.append((question, answer))
            self.detail = None
        if tag == 'div':
            if self.div_depth == self.faq_depth: self.faq_depth = 0
            self.div_depth -= 1

    def handle_data(self, value):
        if not self.main: return
        if self.in_h1: self.heading.append(value)
        if self.link is not None: self.link[1].append(value)
        if self.detail is not None: self.detail[0 if self.summary else 1].append(value)

def local_url(value, file, origin):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc: return value
    target = (file.parent / unquote(parsed.path)).resolve()
    if not target.is_relative_to(ROOT): raise ValueError('SEO URL leaves the project: ' + value)
    path = target.relative_to(ROOT).as_posix()
    if path.endswith('index.html'): path = path.removesuffix('index.html')
    elif target.is_dir() and path != '.': path += '/'
    return urljoin(origin, quote('' if path == '.' else path, safe='/'))

def mappings(source):
    content = json.loads((ROOT / 'company-content.json').read_text(encoding='utf-8'))
    aliases = {
        '/company/about/': '/company/', '/contacts/': '/company/contacts/',
        '/dostavka-i-oplata/': '/company/delivery/', '/requirements/': '/company/requirements/',
        '/company/article/': '/company/articles/',
        **{'/' + article['path']: article['source_route'] for article in content['articles']},
    }
    for file in sorted(ROOT.rglob('*.html')):
        relative = file.relative_to(ROOT)
        if any(part.startswith('.') or part in ('node_modules', 'preview') for part in relative.parts): continue
        route = '/' if relative.as_posix() == 'index.html' else '/' + relative.as_posix().removesuffix('index.html')
        if route in source['excluded_routes']: raise ValueError('A removed page has been restored: ' + route)
        archive_route = aliases.get(route, route)
        if archive_route not in source['pages']: raise ValueError('Missing archive SEO for ' + route)
        yield file, route, archive_route

def apply_site_seo(mode=None):
    if not (ROOT / 'seo-content.json').is_file(): return
    source = json.loads((ROOT / 'seo-content.json').read_text(encoding='utf-8'))
    mode = mode or json.loads((ROOT / 'seo-config.json').read_text(encoding='utf-8'))['mode']
    if mode not in ('preview', 'production'): raise ValueError('Unknown SEO mode')
    origin = source['origin']
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    sitemap = ET.Element('{' + namespace + '}urlset')
    count = 0
    for file, route, archive_route in mappings(source):
        original = file.read_bytes()
        text = original.decode('utf-8').replace('\r\n', '\n')
        head = re.search(r'<head>(.*?)</head>', text, re.S)[1]
        facts = PageFacts()
        facts.feed(text)
        metadata = source['pages'][archive_route] | source['overrides'].get(route, {})
        title, description = metadata['title'], metadata['description']
        canonical = urljoin(origin, route)
        entities = []
        for block in re.findall(r'<script\b[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', head, re.S):
            schema = json.loads(block)
            entities.extend(schema.get('@graph', [schema]))
        article_image = next((entity['image'][0] for entity in entities
                              if entity.get('@type') == 'Article' and entity.get('image')), '')
        image = local_url(facts.image, file, origin) if facts.image else article_image or origin + 'assets/hero-screenshot.webp'
        # Rebuild one graph; never inherit the homepage's schema from the shared head.
        by_type = {entity['@type']: deepcopy(entity) for entity in entities if entity.get('@type')}
        for inherited in ('LocalBusiness', 'FAQPage', 'BreadcrumbList'): by_type.pop(inherited, None)
        h1 = ' '.join(' '.join(facts.heading).split())
        if not by_type:
            service = next((deepcopy(entity) for block in metadata['schema']
                            for entity in block.get('@graph', []) if entity.get('@type') == 'Service'), None)
            by_type['Service' if service else 'WebPage'] = service or {'@type': 'WebPage', 'name': h1}
        # Source Article dates remain the editorial dates already checked against the customer data.
        for entity in by_type.values():
            entity['url'] = canonical
            entity['@id'] = canonical + ('#article' if entity['@type'] == 'Article' else '#page')
            entity['description'] = description
            if entity['@type'] == 'Article':
                entity.update({'image': [image], 'mainEntityOfPage': canonical,
                               'publisher': {'@id': origin + '#studio'}})
            if entity['@type'] == 'Service': entity['provider'] = {'@id': origin + '#studio'}
        graph = [deepcopy(source['business']), *by_type.values()]
        if route != '/':
            crumbs = []
            for href, name in facts.crumbs:
                item = local_url(href, file, origin)
                if not crumbs or crumbs[-1][1] != item: crumbs.append((name, item))
            if not crumbs: crumbs = [('Главная', origin)]
            if crumbs[-1][1] != canonical: crumbs.append((h1, canonical))
            graph.append({'@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': index, 'name': name, 'item': item}
                for index, (name, item) in enumerate(crumbs, 1)]})
        if facts.questions:
            # The 80 current FAQ answers and all other visible answers take priority over source UI copy.
            graph.append({'@type': 'FAQPage', 'mainEntity': [
                {'@type': 'Question', 'name': question, 'acceptedAnswer': {'@type': 'Answer', 'text': answer}}
                for question, answer in facts.questions]})
        robots = 'noindex, nofollow' if mode == 'preview' else metadata['robots']
        head = re.sub(r'<title>.*?</title>', '<title>' + escape(title) + '</title>', head, flags=re.S)
        head = re.sub(r'\s*<meta\b[^>]*(?:name="(?:description|robots)"|property="og:[^"]+")[^>]*>', '', head)
        head = re.sub(r'\s*<link\b[^>]*rel="canonical"[^>]*>', '', head)
        head = re.sub(r'\s*<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>', '', head, flags=re.S)
        tags = [('name', 'description', description), ('name', 'robots', robots),
                ('property', 'og:type', 'article' if 'Article' in by_type else 'website'),
                ('property', 'og:title', title), ('property', 'og:description', description),
                ('property', 'og:url', canonical), ('property', 'og:image', image),
                ('property', 'og:locale', 'ru_RU'), ('property', 'og:site_name', source['business']['name'])]
        head = head.rstrip() + '\n  ' + '\n  '.join(
            f'<meta {attribute}="{key}" content="{escape(value, quote=True)}">' for attribute, key, value in tags)
        schema_json = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        head += f'\n  <link rel="canonical" href="{canonical}">\n  <script type="application/ld+json" id="site-schema">{schema_json}</script>\n'
        updated = re.sub(r'<head>.*?</head>', lambda _: '<head>' + head + '</head>', text, count=1, flags=re.S)
        newline = '\r\n' if b'\r\n' in original else '\n'
        data = updated.replace('\n', newline).encode('utf-8')
        if data != original: file.write_bytes(data)
        # Production sitemap uses the real domain and only existing indexable routes.
        if 'noindex' not in metadata['robots']:
            url = ET.SubElement(sitemap, '{' + namespace + '}url')
            ET.SubElement(url, '{' + namespace + '}loc').text = canonical
            article = by_type.get('Article')
            if article and article.get('dateModified'):
                ET.SubElement(url, '{' + namespace + '}lastmod').text = article['dateModified']
        count += 1
    ET.indent(sitemap, space='  ')
    (ROOT / 'sitemap.xml').write_bytes(ET.tostring(sitemap, encoding='utf-8', xml_declaration=True) + b'\n')
    robots = 'User-agent: *\nAllow: /\n'
    if mode == 'production': robots += '\nSitemap: ' + origin + 'sitemap.xml\n'
    (ROOT / 'robots.txt').write_text(robots, encoding='utf-8', newline='\n')
    return count, len(sitemap)
