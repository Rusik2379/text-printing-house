"""Build responsive WebP copies. Originals, dimensions and artwork remain intact."""
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import hashlib,json,math
root=Path(__file__).resolve().parents[1]
existing=json.loads((root/'scripts/image-variants.json').read_text(encoding='utf-8'))
inventory=[{'path':name,'width':info['width']} for name,info in existing.items()]
manifest={};original_total=optimized_total=0
for record in inventory:
 p=root/record['path']
 if record['width']<600:continue
 image=Image.open(p);source=p.read_bytes();variants=[]
 widths=[96,192] if p.name=='sibsoft-logo.png' else [400,800]
 widths=sorted(set([w for w in widths if w<image.width]+[image.width]))
 for width in widths:
  quality=90 if width<image.width else 88
  fingerprint=hashlib.sha256(source+f'webp:{width}:{quality}:lanczos:method6'.encode()).hexdigest()[:12]
  relative=p.relative_to(root/'assets');target=Path('assets/optimized')/relative.parent/(p.stem+f'-{fingerprint}-{width}.webp')
  output=root/target;output.parent.mkdir(parents=True,exist_ok=True)
  resized=image if width==image.width else image.resize((width,round(image.height*width/image.width)),Image.Resampling.LANCZOS)
  if not output.exists():resized.save(output,'WEBP',quality=quality,method=6,exact=True)
  if width==image.width:
   restored=Image.open(output);rms=ImageStat.Stat(ImageChops.difference(image.convert('RGB'),restored.convert('RGB'))).rms
   mse=sum(x*x for x in rms)/3;psnr=99 if mse==0 else 10*math.log10(255**2/mse)
   if output.stat().st_size>=len(source)*.95 or psnr<39:
    variants.append({'width':width,'path':record['path'],'bytes':len(source)});continue
  variants.append({'width':width,'path':target.as_posix(),'bytes':output.stat().st_size})
 manifest[record['path']]={'width':image.width,'height':image.height,'variants':variants}
 original_total+=len(source);optimized_total+=variants[0]['bytes']
(root/'scripts/image-variants.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'images':len(manifest),'sourceBytes':original_total,'smallVersionBytes':optimized_total,'reductionPercent':round(100*(1-optimized_total/original_total),1)}),flush=True)
