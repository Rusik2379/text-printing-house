import tempfile
import unittest
from pathlib import Path
from monitor import Monitor, SemanticPage, ORIGIN, ENDPOINT, clean_url

KEY='0123456789abcdef0123456789abcdef'
def html(url,text='Original page',extra='',suffix='a1'):
    return '<html><head><title>Title</title><meta name="description" content="Description"><link rel="canonical" href="'+url+'">'+extra+'</head><body><header>Shared chrome '+suffix+'</header><main><h1>Heading</h1><p>'+text+'</p><a href="/kopitsentr/?calc='+suffix+'#calculator">Calculate</a><script src="app.js?v='+suffix+'">ignored</script></main><footer>Footer '+suffix+'</footer></body></html>'
def response(body='',status=200,headers=None): return {'status':status,'body':body,'headers':headers or {}}

class FakeWeb:
    def __init__(self):
        self.pages={ORIGIN+'/':html(ORIGIN+'/'),ORIGIN+'/kopitsentr/':html(ORIGIN+'/kopitsentr/')}
        self.urls=list(self.pages)
        self.posts=[]
        self.api_status=200
        self.retry_after=''
        self.bot_block=False
        self.unavailable=False
        self.missing={}
        self.key_status=200
        self.conditional=False
    def __call__(self,url,method='GET',payload=None,headers=None):
        if method=='POST':
            assert url==ENDPOINT
            self.posts.append(payload)
            return response(status=self.api_status,headers={'Retry-After':self.retry_after})
        if url==ORIGIN+'/'+KEY+'.txt': return response(KEY,self.key_status,{'Content-Type':'text/plain; charset=utf-8'})
        if url==ORIGIN+'/robots.txt': return response('User-agent: *\n'+('Disallow: /' if self.bot_block else 'Allow: /'))
        if url==ORIGIN+'/sitemap.xml':
            if self.unavailable: return response(status=503)
            return response('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+u+'</loc></url>' for u in self.urls)+'</urlset>')
        if url in self.missing: return response(status=self.missing[url])
        if self.conditional and (headers or {}).get('If-None-Match')=='same': return response(status=304)
        return response(self.pages.get(url,''),200 if url in self.pages else 404,{'ETag':'same'})

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.web=FakeWeb()
        self.now=100000
        self.monitor=Monitor(self.temp.name,KEY,self.web,lambda:self.now)
    def baseline(self):
        result=self.monitor.run()
        self.assertEqual(result['action'],'baseline')
        self.assertFalse(self.web.posts)
    def test_initial_snapshot_and_unchanged_restart_never_submit_all(self):
        self.baseline()
        self.monitor.run()
        restarted=Monitor(self.temp.name,KEY,self.web,lambda:self.now)
        restarted.run()
        self.assertFalse(self.web.posts)
    def test_substantive_update_only_sends_changed_page(self):
        self.baseline()
        self.web.pages[ORIGIN+'/']=html(ORIGIN+'/','Meaningful new content')
        result=self.monitor.run()
        self.assertEqual(result['status'],200)
        self.assertEqual(self.web.posts[0]['urlList'],[ORIGIN+'/'])
        self.monitor.run()
        self.assertEqual(len(self.web.posts),1)
    def test_new_page_and_removed_404_sent_together(self):
        self.baseline()
        old=ORIGIN+'/kopitsentr/'
        new=ORIGIN+'/new-page/'
        self.web.urls=[ORIGIN+'/',new]
        self.web.pages[new]=html(new,'Created')
        self.web.missing[old]=404
        self.monitor.run()
        self.assertEqual(set(self.web.posts[0]['urlList']),{old,new})
        self.monitor.run()
        self.assertEqual(len(self.web.posts),1)
    def test_removed_redirect_is_notified(self):
        self.baseline()
        self.web.urls=[ORIGIN+'/']
        self.web.missing[ORIGIN+'/kopitsentr/']=301
        self.monitor.run()
        self.assertEqual(self.web.posts[0]['urlList'],[ORIGIN+'/kopitsentr/'])
    def test_sitemap_outage_does_not_delete_pages_or_reset_baseline(self):
        self.baseline()
        before=self.monitor.file.read_bytes()
        self.web.unavailable=True
        with self.assertRaises(ValueError): self.monitor.run()
        self.assertEqual(self.monitor.file.read_bytes(),before)
        self.assertFalse(self.web.posts)
    def test_cosmetic_chrome_whitespace_and_asset_version_ignored(self):
        self.baseline()
        self.web.pages[ORIGIN+'/']=html(ORIGIN+'/','Original\n   page',suffix='b2')
        self.monitor.run()
        self.assertFalse(self.web.posts)
    def test_304_reuses_fingerprint(self):
        self.baseline()
        self.web.conditional=True
        self.monitor.run()
        self.assertFalse(self.web.posts)
    def test_foreign_private_or_query_urls_never_submitted(self):
        for url in ['https://evil.example/','http://text-print.ru/','https://www.text-print.ru/','https://text-print.ru/admin/','https://text-print.ru/api/orders/','https://text-print.ru/order-files/key','https://text-print.ru/x/?calc=1','https://text-print.ru/uslugi/x/']:
            with self.subTest(url=url),self.assertRaises(ValueError): clean_url(url)
        self.assertFalse(self.web.posts)
    def test_bad_canonical_blocks_submission_and_preserves_state(self):
        self.baseline()
        self.web.pages[ORIGIN+'/']=html('https://wrong.example/')
        with self.assertRaises(ValueError): self.monitor.run()
        self.assertFalse(self.web.posts)
    def test_robot_block_or_noindex_is_not_submitted(self):
        self.web.bot_block=True
        with self.assertRaises(ValueError): self.monitor.run()
        self.web.bot_block=False
        self.web.pages[ORIGIN+'/']=html(ORIGIN+'/',extra='<meta name="robots" content="noindex">')
        with self.assertRaises(ValueError): self.monitor.run()
        self.assertFalse(self.web.posts)
    def test_429_retains_queue_obeys_retry_and_then_acknowledges(self):
        self.baseline()
        self.web.pages[ORIGIN+'/']=html(ORIGIN+'/','Changed')
        self.web.api_status=429
        self.web.retry_after='1800'
        self.monitor.run()
        self.assertIn(ORIGIN+'/',self.monitor.load()['pending'])
        self.now+=1000
        self.monitor.run()
        self.assertEqual(len(self.web.posts),1)
        self.now+=1000
        self.web.api_status=200
        self.monitor.run()
        self.assertEqual(len(self.web.posts),2)
        self.assertFalse(self.monitor.load()['pending'])
    def test_202_key_pending_does_not_acknowledge_changes(self):
        self.baseline()
        self.web.pages[ORIGIN+'/']=html(ORIGIN+'/','Changed')
        self.web.api_status=202
        self.monitor.run()
        self.assertTrue(self.monitor.load()['pending'])
    def test_test_notification_sends_one_url_and_normal_scan_does_not_repeat(self):
        self.baseline()
        result=self.monitor.test(ORIGIN+'/')
        self.assertEqual(result['count'],1)
        self.assertEqual(self.web.posts[0]['host'],'text-print.ru')
        self.assertEqual(self.web.posts[0]['keyLocation'],ORIGIN+'/'+KEY+'.txt')
        self.monitor.run()
        self.assertEqual(len(self.web.posts),1)
        with self.assertRaises(ValueError): self.monitor.test(ORIGIN+'/')
    def test_invalid_public_key_blocks_outbound_api(self):
        self.web.key_status=404
        with self.assertRaises(ValueError): self.monitor.run()
        self.assertFalse(self.web.posts)
    def test_pending_test_key_verification_retries_without_flooding_site_urls(self):
        self.baseline()
        self.web.api_status=202
        self.monitor.test(ORIGIN+'/')
        self.monitor.run()
        self.assertEqual(len(self.web.posts),1)
        self.now+=901
        self.web.api_status=200
        self.monitor.run()
        self.assertEqual(len(self.web.posts),2)
        self.assertEqual(self.web.posts[-1]['urlList'],[ORIGIN+'/'])
        self.assertTrue(self.monitor.load()['keyVerified'])
        self.assertNotIn('pendingTest',self.monitor.load())
        self.monitor.run()
        self.assertEqual(len(self.web.posts),2)
    def test_failure_to_fetch_removed_page_is_not_treated_as_deletion(self):
        self.baseline()
        self.web.urls=[ORIGIN+'/']
        self.web.missing[ORIGIN+'/kopitsentr/']=503
        with self.assertRaises(ValueError): self.monitor.run()
        self.assertFalse(self.web.posts)

if __name__=='__main__': unittest.main()
