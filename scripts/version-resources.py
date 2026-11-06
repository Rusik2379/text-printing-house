"""Refresh content hashes of local browser resources without regenerating page content."""
from pathlib import Path
from html import escape,unescape
from urllib.parse import urlsplit,urlunsplit,unquote,parse_qsl,urlencode
import hashlib,re,os
ROOT=Path(__file__).resolve().parents[1]
versions={};count=0
pages=[]
for directory,dirs,names in os.walk(ROOT):
    dirs[:]=[name for name in dirs if not name.startswith('.') and name not in ('node_modules','preview','assets','fonts','vendor','tests','docs','scripts','infrastructure')]
    pages.extend(Path(directory)/name for name in names if name.endswith('.html'))
for file in sorted(pages):
    raw=file.read_bytes();text=raw.decode('utf8');newline='\r\n' if b'\r\n' in raw else '\n'
    def version_asset(match):
        url=urlsplit(unescape(match[2]))
        if url.scheme or url.netloc or (Path(url.path).suffix not in ('.css','.js') and Path(url.path).name not in ('favicon.svg','favicon.png','favicon.ico')):return match[0]
        asset=(file.parent/unquote(url.path)).resolve()
        if not asset.is_relative_to(ROOT) or not asset.is_file():return match[0]
        if asset not in versions:versions[asset]=hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        query=[(k,v) for k,v in parse_qsl(url.query,keep_blank_values=True) if k!='v']+[('v',versions[asset])]
        return match[1]+escape(urlunsplit((url.scheme,url.netloc,url.path,urlencode(query),url.fragment)),quote=True)
    updated=re.sub(r'((?:href|src)=")([^\"]+)(?=")',version_asset,text)
    if updated!=text:file.write_bytes(updated.replace('\r\n','\n').replace('\n',newline).encode('utf8'));count+=1
print('Versioned browser resources on',count,'pages.')
