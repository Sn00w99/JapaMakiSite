const fs=require('fs'),path=require('path');
const d=JSON.parse(fs.readFileSync('data/menu.json','utf8'));
const lqip=JSON.parse(fs.readFileSync('data/lqip.json','utf8'));
const dims=JSON.parse(fs.readFileSync('data/dims.json','utf8'));
// kanji per category for the typographic cards
const KANJI={
  'promocoes':'特','especial-dos-namorados':'恋','combinados':'膳','entradas':'前',
  'refogados':'炒','harumakis':'巻','sashimis':'刺','sushis':'寿','dupla-de-joes':'双',
  'temakis':'手','gunkans-e-especiais':'軍','maki-rolls':'巻','hots':'熱',
  'pokes-e-tirashis':'丼','yakisobas':'麺','teppan':'鉄','robatas':'炉',
  'iscas-com-molho':'揚','empanados-e-cozinha-contemporanea':'衣','harumakis-doces':'甘',
  'bebidas':'飲','sobremesas':'菓','japa-kids':'子'
};
// short display names (the API names carry explanatory suffixes we keep as the subtitle)
const SHORT={
  'promocoes':['Promoções','O que vale a pena hoje'],
  'especial-dos-namorados':['Especial dos Namorados','Combinados para dividir a dois'],
  'combinados':['Combinados','Travessas para a mesa inteira'],
  'entradas':['Entradas','Para começar devagar'],
  'refogados':['Refogados','Na manteiga, com bifum'],
  'harumakis':['Harumakis','Rolinhos de massa crocante recheados'],
  'sashimis':['Sashimis','Lâminas de peixe'],
  'sushis':['Sushis','Lâminas de peixe sobre o bolinho de arroz'],
  'dupla-de-joes':['Dupla de Joes','Dois a dois'],
  'temakis':['Temakis','Cone de alga enrolado na hora'],
  'gunkans-e-especiais':['Gunkans e Especiais','Barquinhas e criações da casa'],
  'maki-rolls':['Maki Rolls','Enrolados crus'],
  'hots':['Hots','Rolls fritos'],
  'pokes-e-tirashis':['Pokés e Tirashis','Na tigela, tudo junto'],
  'yakisobas':['Yakisobas','Macarrão na chapa'],
  'teppan':['Teppan','Grelhados na chapa'],
  'robatas':['Robatas','Espetos na brasa'],
  'iscas-com-molho':['Iscas com Molho','Fritas, para petiscar'],
  'empanados-e-cozinha-contemporanea':['Empanados e Cozinha Contemporânea','Panko, tempurá e invenções'],
  'harumakis-doces':['Harumakis Doces','Rolinhos crocantes de sobremesa'],
  'bebidas':['Bebidas','Para acompanhar'],
  'sobremesas':['Sobremesas','O final'],
  'japa-kids':['Japa Kids','Para os pequenos']
};
const tiers={};
for(const c of d.categories){
  c.kanji=KANJI[c.slug]||'味';
  const s=SHORT[c.slug]; if(s){c.title=s[0];c.sub=s[1]} else {c.title=c.name.replace(/\s*!+\s*$/,'');c.sub=null}
  for(const it of c.items){
    if(!it.img){it.tier=0;continue}
    const b=it.img.replace(/\.[^.]+$/,'');
    it.img=b;
    it.lqip=lqip[b]||null;
    // tier 2 = big source (good photo, can carry a hero cell), 1 = small/weak source
    const w=(dims[b]||{}).w||0;
    it.tier = w>=700?3 : w>=450?2 : 1;
    it.w=w;
    tiers[it.tier]=(tiers[it.tier]||0)+1;
  }
  // price range for the category label
  const ps=c.items.flatMap(i=>i.vars.map(v=>v.price)).filter(p=>p>0);
  c.min=ps.length?Math.min(...ps):0; c.max=ps.length?Math.max(...ps):0;
}
d.meta={generated:new Date().toISOString(),dishes:d.categories.reduce((a,c)=>a+c.items.length,0),cats:d.categories.length};
fs.writeFileSync('data/menu.json',JSON.stringify(d));
console.log('pratos:',d.meta.dishes,'| categorias:',d.meta.cats,'| tiers',JSON.stringify(tiers));
console.log('json:',(fs.statSync('data/menu.json').size/1024).toFixed(1),'KB');
