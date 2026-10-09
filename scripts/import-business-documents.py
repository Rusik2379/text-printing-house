"""Copy original branded PDF documents; never execute archive scripts."""
from pathlib import Path
import hashlib,json,sys,zipfile

ROOT=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1])
documents=[
 ('rekvizity','Реквизиты','Карточка реквизитов для оплаты и договоров'),
 ('prezentaciya-kompanii','Презентация компании','Кратко о студии, услугах и производстве'),
 ('oficialnoe-pismo','Официальное письмо','Фирменный бланк деловой переписки'),
 ('sluzhebnaya-zapiska','Служебная записка','Бланк докладной и служебной записки'),
 ('obyasnitelnaya-zapiska','Объяснительная записка','Фирменный бланк объяснительной'),
 ('zayavlenie','Заявление','Фирменный бланк заявления')]
with zipfile.ZipFile(archive) as z:
 base=next(n for n in z.namelist() if n.endswith('/company/contacts/index.html')).removesuffix('company/contacts/index.html')
 items=[]
 for name,label,description in documents:
  relative='assets/documents/'+name+'.pdf'
  data=z.read(base+relative)
  if not data.startswith(b'%PDF-'):raise ValueError('Not a PDF: '+relative)
  target=ROOT/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  items.append({'name':label,'description':description,'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 template=z.read(base+'order-xlsx.js')
 source={'file':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'updated':'2026-10-09','xlsx_template_sha256':hashlib.sha256(template).hexdigest()}
(ROOT/'business-documents.json').write_text(json.dumps({'source':source,'documents':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported six original branded PDF documents and recorded source hashes.')
