"""IndexNow change notifications for the public canonical pages of text-print.ru."""
import argparse
import concurrent.futures
import contextlib
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET

ORIGIN = 'https://text-print.ru'
ENDPOINT = 'https://yandex.com/indexnow'
USER_AGENT = 'Tekst-IndexNow-Monitor/1.0'
MAX_BODY = 4 * 1024 * 1024
INTERVAL = 900

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def http(url, method='GET', payload=None, headers=None):
    request_headers = {'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity', **(headers or {})}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        request_headers['Content-Type'] = 'application/json; charset=utf-8'
    request = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(MAX_BODY + 1)
        if len(body) > MAX_BODY:
            raise ValueError('Response exceeds the safety limit')
        return {'status': response.code, 'headers': dict(response.headers.items()),
                'body': body.decode('utf-8', 'strict')}

def header(response, name):
    return next((value for key, value in response['headers'].items() if key.lower() == name.lower()), '')

def clean_url(url):
    parsed = urllib.parse.urlsplit(url)
    forbidden = ('/admin', '/api/', '/order-files/', '/.server', '/tools/', '/scripts/', '/tests/', '/uslugi/')
    if (parsed.scheme != 'https' or parsed.netloc != 'text-print.ru' or parsed.query or parsed.fragment
            or not parsed.path.startswith('/') or any(parsed.path.startswith(p) for p in forbidden)
            or any(part.startswith('.') for part in parsed.path.split('/') if part)):
        raise ValueError('Only public, clean, primary-host URLs may be submitted')
    return url

class SemanticPage(HTMLParser):
    """Hash visible main content; ignore build hashes, scripts, styles and site chrome."""
    VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.stack, self.text, self.title, self.images, self.links = [], [], [], [], []
        self.canonical, self.description, self.robots = [], '', ''
        self.main_found = False
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel','').lower().split():
            self.canonical.append(attrs.get('href'))
        if tag == 'meta':
            if attrs.get('name','').lower() == 'description': self.description = attrs.get('content','')
            if attrs.get('name','').lower() == 'robots': self.robots += ' '+attrs.get('content','')
        inherited_main = any(node[1] for node in self.stack)
        in_main = tag == 'main' or inherited_main
        hidden = any(node[2] for node in self.stack) or tag in ['script','style','noscript','svg'] or 'hidden' in attrs or attrs.get('aria-hidden') == 'true'
        if tag == 'main': self.main_found = True
        if in_main and not hidden:
            if tag == 'img':
                self.images.append([urllib.parse.urlsplit(attrs.get('src','')).path, attrs.get('alt','')])
            if tag == 'a' and attrs.get('href'):
                part = urllib.parse.urlsplit(attrs['href'])
                self.links.append(urllib.parse.urlunsplit((part.scheme,part.netloc,part.path,'',part.fragment)))
        if tag not in self.VOID: self.stack.append((tag,in_main,hidden))
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in self.VOID: self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for index in range(len(self.stack)-1,-1,-1):
            if self.stack[index][0] == tag:
                self.stack = self.stack[:index]
                break
    def handle_data(self, data):
        if any(node[0] == 'title' for node in self.stack): self.title.append(data)
        if self.stack and self.stack[-1][1] and not self.stack[-1][2]: self.text.append(data)
    def fingerprint(self):
        if not self.main_found or not ''.join(self.text).strip():
            raise ValueError('Public main content is missing')
        normalize = lambda s: re.sub(r'\s+',' ',s).strip()
        semantic = {'title':normalize(' '.join(self.title)), 'description':normalize(self.description),
                    'main':normalize(' '.join(self.text)), 'images':self.images, 'links':self.links}
        return hashlib.sha256(json.dumps(semantic,ensure_ascii=False,sort_keys=True).encode()).hexdigest()

class Monitor:
    def __init__(self, directory, key, transport=http, clock=time.time):
        if not re.fullmatch(r'[a-zA-Z0-9-]{8,128}',key): raise ValueError('Invalid IndexNow key')
        self.directory, self.key, self.transport, self.clock = Path(directory), key, transport, clock
        self.file = self.directory/'state.json'
    def load(self):
        if not self.file.exists(): return None
        state = json.loads(self.file.read_text())
        if state.get('version') != 1 or state.get('origin') != ORIGIN:
            raise ValueError('Unexpected IndexNow state; refusing to reinitialize')
        if not state.get('keyVerified') and state.get('lastTest',{}).get('status')==202 and not state.get('pendingTest'):
            test=state['lastTest']
            state['pendingTest']={'url':test['url'],'retryAt':test['at']+INTERVAL,'attempts':1}
        return state
    def save(self, state):
        self.directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        temp = self.file.with_suffix('.tmp')
        with temp.open('w',encoding='utf-8') as stream:
            os.chmod(temp,0o600)
            json.dump(state,stream,ensure_ascii=False,indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp,self.file)
    @contextlib.contextmanager
    def locked(self):
        import fcntl
        self.directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        with (self.directory/'monitor.lock').open('a') as stream:
            fcntl.flock(stream,fcntl.LOCK_EX)
            yield
    def key_url(self): return ORIGIN+'/'+self.key+'.txt'
    def check_key(self):
        result = self.transport(self.key_url())
        if result['status'] != 200 or result['body'].strip() != self.key or 'text/plain' not in header(result,'Content-Type'):
            raise ValueError('The public verification key is unavailable or invalid')
    def snapshot(self, previous):
        robots = self.transport(ORIGIN+'/robots.txt')
        sitemap = self.transport(ORIGIN+'/sitemap.xml')
        if robots['status'] != 200 or sitemap['status'] != 200:
            raise ValueError('Robots or sitemap unavailable; no deletions will be inferred')
        parser = urllib.robotparser.RobotFileParser()
        parser.parse(robots['body'].splitlines())
        tree = ET.fromstring(sitemap['body'])
        if tree.tag.split('}')[-1] != 'urlset': raise ValueError('Expected a sitemap URL set')
        urls = [clean_url(node.text) for node in tree.findall('.//{*}loc')]
        if not urls or len(urls) != len(set(urls)) or len(urls) > 10000:
            raise ValueError('Empty, duplicate or excessively large sitemap')
        for url in urls:
            if not parser.can_fetch('YandexBot',url): raise ValueError('YandexBot is blocked: '+url)
        def page(url):
            old = previous.get(url,{})
            headers = {'If-None-Match':old['etag']} if old.get('etag') else {}
            result = self.transport(url,headers=headers)
            if result['status'] == 304 and old.get('fingerprint'): return url,old
            if result['status'] != 200: raise ValueError('Sitemap URL must return HTTP 200: '+url)
            doc = SemanticPage(result['body'])
            if doc.canonical != [url] or 'noindex' in (doc.robots+' '+header(result,'X-Robots-Tag')).lower():
                raise ValueError('Canonical/noindex mismatch: '+url)
            return url,{'fingerprint':doc.fingerprint(),'etag':header(result,'ETag')}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            return dict(pool.map(page,urls))
    def submit(self, urls):
        if not urls or len(urls)>10000 or len(urls)!=len(set(urls)): raise ValueError('Invalid IndexNow batch')
        for url in urls: clean_url(url)
        self.check_key()
        result = self.transport(ENDPOINT,method='POST',payload={
            'host':'text-print.ru','key':self.key,'keyLocation':self.key_url(),'urlList':urls,
        })
        return {'at':self.clock(),'status':result['status'],'count':len(urls),
                'retryAfter':header(result,'Retry-After'),'response':result['body'][:500]}
    def run(self):
        self.check_key()
        state = self.load()
        current = self.snapshot(state['observed'] if state else {})
        now = self.clock()
        if state is None:
            state = {'version':1,'origin':ORIGIN,'initializedAt':now,'observed':current,
                     'known':{url:item['fingerprint'] for url,item in current.items()},
                     'pending':{},'lastSent':{},'nextAttemptAt':0,'attempts':0,'history':[], 'keyVerified':False}
            self.save(state)
            return {'action':'baseline','pages':len(current),'submitted':0}
        pending = {}
        for url,item in current.items():
            if item['fingerprint'] != state['known'].get(url):
                pending[url] = {'fingerprint':item['fingerprint'],
                                'kind':'updated' if url in state['known'] else 'created'}
        for url,known in state['known'].items():
            if url in current or known == 'deleted': continue
            result = self.transport(url)
            if result['status'] in [301,302,307,308,404,410]:
                pending[url] = {'fingerprint':'deleted','kind':'deleted-or-redirected','status':result['status']}
            elif result['status'] == 200:
                doc = SemanticPage(result['body'])
                if 'noindex' in (doc.robots+' '+header(result,'X-Robots-Tag')).lower() or doc.canonical != [url]:
                    pending[url] = {'fingerprint':'deleted','kind':'removed-from-index'}
            else: raise ValueError('A removed page is temporarily unavailable; no removal inferred')
        state['observed'], state['pending'], state['lastScanAt'] = current,pending,now
        ready = [url for url in pending if now-state['lastSent'].get(url,0)>=600]
        if ready and now>=state['nextAttemptAt']:
            # Persist the queue before outbound I/O. A failed request never acknowledges changes.
            self.save(state)
            try: result = self.submit(ready)
            except Exception as error: result={'at':now,'status':0,'count':len(ready),'error':str(error)[:200]}
            state['history'] = (state['history']+[result])[-100:]
            if result['status'] == 200:
                state['keyVerified']=True
                state.pop('pendingTest',None)
                for url in ready:
                    state['known'][url]=pending[url]['fingerprint']
                    state['lastSent'][url]=now
                    state['pending'].pop(url,None)
                state['attempts'],state['nextAttemptAt']=0,0
            else:
                state['attempts']+=1
                delay=min(21600,INTERVAL*2**min(state['attempts']-1,5))
                try: delay=max(delay,int(result.get('retryAfter','0')))
                except ValueError: pass
                state['nextAttemptAt']=now+delay
            self.save(state)
            return {'action':'submit','pages':len(current),'pending':len(state['pending']),**result}
        self.save(state)
        pending_test=state.get('pendingTest')
        if pending_test and now>=pending_test['retryAt']:
            try: result=self.submit([pending_test['url']])
            except Exception as error: result={'at':now,'status':0,'count':1,'error':str(error)[:200]}
            state['history']=(state['history']+[{'testVerificationRetry':True,**result}])[-100:]
            state['lastTest']={'url':pending_test['url'],**result}
            if result['status']==200:
                state['keyVerified']=True
                state.pop('pendingTest',None)
            else:
                pending_test['attempts']+=1
                delay=min(21600,INTERVAL*2**min(pending_test['attempts']-1,5))
                try: delay=max(delay,int(result.get('retryAfter','0')))
                except ValueError: pass
                pending_test['retryAt']=now+delay
            self.save(state)
            return {'action':'verify-test','pages':len(current),'pending':len(pending),**result}
        return {'action':'scan','pages':len(current),'pending':len(pending),'submitted':0}
    def test(self, url):
        clean_url(url)
        state=self.load()
        if not state or url not in state['observed']: raise ValueError('Initialize the baseline first; test only an existing public page')
        now=self.clock()
        previous=state.get('lastTest',{})
        if previous.get('url')==url and now-previous.get('at',0)<600:
            raise ValueError('Wait at least ten minutes before repeating a test URL')
        result=self.submit([url])
        state['lastTest']={'url':url,**result}
        state['history']=(state['history']+[{'test':True,**result}])[-100:]
        if result['status']==200:
            state['keyVerified']=True
            state.pop('pendingTest',None)
        elif result['status']==202:
            state['pendingTest']={'url':url,'retryAt':now+INTERVAL,'attempts':1}
        self.save(state)
        return {'action':'test','url':url,**result}

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['run','once','test'])
    parser.add_argument('--url',default=ORIGIN+'/')
    args=parser.parse_args()
    key=Path(os.environ.get('INDEXNOW_KEY_FILE','/config/key.txt')).read_text().strip()
    monitor=Monitor(os.environ.get('INDEXNOW_STATE_DIR','/data'),key)
    while True:
        try:
            with monitor.locked(): result=monitor.test(args.url) if args.command=='test' else monitor.run()
            print(json.dumps(result,ensure_ascii=False),flush=True)
        except Exception as error:
            print(json.dumps({'action':'error','error':str(error)[:500]}),flush=True)
            if args.command!='run': raise
        if args.command!='run': break
        time.sleep(INTERVAL)

if __name__=='__main__': main()
