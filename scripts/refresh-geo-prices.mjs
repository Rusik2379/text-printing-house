// Refresh the reference example where our approved stickerpack formula differs.
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),context={};context.window=context;vm.createContext(context);
for(const name of ['sticker-services','stickerpack-pricing','sticker-pricing','stickerpack-calculator','sticker-special-calculator'])vm.runInContext(await readFile(new URL(name+'.js',root),'utf8'),context);
const file=new URL('service-enrichment.json',root),original=await readFile(file,'utf8'),data=JSON.parse(original);
const source=JSON.parse(await readFile(new URL('seo-content.json',root),'utf8')).service_search_terms['4.4'];
const service=data.services['4.4'],configuration={print:'uv',material:'white',width:100,height:150};
const quantities=[source.points[0].qty,source.points.at(-1).qty];
const points=quantities.map(quantity=>{const quote=context.TEXT_QUOTE_STICKER_SERVICE('4.4',{...configuration,quantity});if(!quote)throw new Error('Invalid stickerpack GEO example');return {quantity,total:quote.total,unit:quote.total/quantity};});
const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
const [first,last]=points,discount=Math.round((1-last.unit/first.unit)*100);
service.priceExample={configuration,label:source.config,points,reason:'Пример пересчитан по действующей формуле стикерпаков нашего сайта.'};
service.answers.find(a=>a.title==='Сколько стоит').text=`Для одинаковой конфигурации «${source.config}»: ${format(first.quantity)} шт. — ${format(first.unit)} ₽/шт., ${format(last.quantity)} шт. — ${format(last.unit)} ₽/шт. Цена за единицу снижается примерно на ${discount}%.`;
const updated=JSON.stringify(data,null,2)+'\n';if(updated!==original)await writeFile(file,updated);
console.log('Stickerpack GEO example refreshed from the current calculator.');
