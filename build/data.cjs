const fs=require('fs');
const m=JSON.parse(fs.readFileSync('fonte/api-menu.json','utf8'));
const store=JSON.parse(fs.readFileSync('fonte/api-store.json','utf8'))[0];
const SKIP=new Set(['Acréscimos','Complementos','Diversos','Ifood','Marcação Obrigatória - Molhos, Utensílios e Complementos !!!']);
// slugify
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const cats=new Map();
for(const it of m.items){
  const c=it.category_item; if(!c) continue;
  const name=c.desc_store_category_item;
  if(SKIP.has(name)) continue;
  if(c.enabled!=='Y') continue;
  if(!cats.has(c.id_store_category_item)) cats.set(c.id_store_category_item,{id:c.id_store_category_item,name,order:c.order,items:[]});
  const vars=(it.variations||[]).filter(v=>v.enabled==='Y')
    .sort((a,b)=>a.order-b.order)
    .map(v=>({label:v.variation?.desc_store_variation||'Único',price:Number(v.price)}));
  if(!vars.length) continue;
  cats.get(c.id_store_category_item).items.push({
    id:it.id_store_item,
    name:it.desc_store_item.trim().replace(/\s+/g,' '),
    desc:(it.detail||it.desc_store_item_delivery||'').trim().replace(/\s+/g,' ').replace(/^-\s*/,'')||null,
    img:it.img_path?it.img_path.split('/').pop():null,
    order:it.order,
    vars
  });
}
const out=[...cats.values()].filter(c=>c.items.length).sort((a,b)=>a.order-b.order);
out.forEach(c=>{c.slug=slug(c.name.replace(/!+/g,'').split(' - ')[0]);c.items.sort((a,b)=>a.order-b.order)});
const data={
  store:{
    name:'Japa Maki',
    full:'Japa Maki — Temakeria e Sushi Bar',
    address:'Av. Dom Helder Câmara, 6001 — Loja K, Arena Mall',
    district:'Pilares', city:'Rio de Janeiro', state:'RJ',
    deliveryTime:store.delivery_time, pickupTime:store.pickup_time,
    minimum:store.minimum_value,
    order_url:'https://japamaki.saipos.com/home',
    hours:store.schedules_service.sort((a,b)=>a.day_week-b.day_week).map(s=>({d:s.day_week,start:s.start_time,end:s.end_time})),
    payments:[...new Set(store.site_payment_types.map(p=>p.store_payment_type?.desc_store_payment_type).filter(Boolean))],
    cards:[...new Set(store.site_payment_types.map(p=>p.site_delivery_payment_type?.desc_payment_type).filter(Boolean))]
  },
  categories:out
};
fs.writeFileSync('data/menu.json',JSON.stringify(data));
const n=out.reduce((a,c)=>a+c.items.length,0);
console.log('categorias:',out.length,'| pratos:',n,'| com foto:',out.reduce((a,c)=>a+c.items.filter(i=>i.img).length,0));
console.log('bytes:',fs.statSync('data/menu.json').size);
console.log(out.map(c=>` ${String(c.items.length).padStart(2)}  ${c.slug.padEnd(28)} ${c.name}`).join('\n'));
console.log('\npayments:',data.store.payments.join(', '));
console.log('hours sample:',JSON.stringify(data.store.hours));
