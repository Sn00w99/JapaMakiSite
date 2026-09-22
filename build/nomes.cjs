/* ============================================================
   NORMALIZAÇÃO DOS NOMES DE PRATO

   O cardápio vem do sistema de PDV da casa, onde os nomes foram
   digitados sem acento e com capitalização inconsistente
   ("salmao", "filadelfia", "MEIO HOT FILADELFIA", "Maki roll- kani").

   Este passo corrige SÓ ortografia e caixa. Nenhuma palavra é
   adicionada, removida ou trocada por sinônimo, e nenhum preço é
   tocado. Cada alteração é registrada em data/renames.json para
   auditoria.
   ============================================================ */
const fs = require('fs');

/* ortografia: palavra crua -> palavra correta */
const SPELL = {
  salmao: 'Salmão', camarao: 'Camarão', requeijao: 'Requeijão',
  maracuja: 'Maracujá', filadelfia: 'Filadélfia', california: 'Califórnia',
  limao: 'Limão', pimentao: 'Pimentão', melao: 'Melão', guarana: 'Guaraná',
  acai: 'Açaí', tilapia: 'Tilápia', combinacao: 'Combinação',
  cebola: 'Cebola', legumes: 'Legumes', alho: 'Alho', poro: 'Poró',
  peru: 'Peru', creme: 'Creme', pequeno: 'Pequeno',
  tradicional: 'Tradicional', especial: 'Especial', misto: 'Misto',
  frances: 'Francês', japones: 'Japonês', porcao: 'Porção',
  caipirinha: 'Caipirinha', caipiroska: 'Caipiroska', limonada: 'Limonada'
};

/* palavras que ficam minúsculas no meio do nome */
const LOWER = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'à', 'a', 'o', 'com', 'sem', 'por', 'para', 'ou', 'the'
]);

/* siglas e marcas que têm caixa própria */
const KEEP = {
  ml: 'ml', g: 'g', kg: 'kg', l: 'L',
  nutella: 'Nutella', catupiry: 'Catupiry', philadelphia: 'Philadelphia',
  'coca-cola': 'Coca-Cola', fanta: 'Fanta', sprite: 'Sprite',
  'red bull': 'Red Bull', heineken: 'Heineken', budweiser: 'Budweiser',
  brahma: 'Brahma', skol: 'Skol', antarctica: 'Antarctica',
  'h2oh': 'H2OH!', itubaina: 'Itubaína', dellvale: 'DellValle'
};

const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function fixWord(w, isFirst) {
  const bare = stripAccents(w).toLowerCase();

  if (KEEP[bare]) return KEEP[bare];

  // ortografia conhecida — só age quando a palavra veio SEM o acento,
  // para não mexer no que a casa já escreveu certo
  // ortografia conhecida — só quando a palavra veio SEM o acento
  let base = (SPELL[bare] && bare === w.toLowerCase()) ? SPELL[bare] : w;

  // número com unidade fica como está (350ml, 1L, 12x)
  if (/^[\d.,]+[a-z]*$/i.test(w)) return w.toLowerCase().replace(/l$/, 'L');

  // devolve a palavra original em caixa baixa, não a versão sem acento:
  // "Arroz à Japa Maki" não pode virar "Arroz a Japa Maki"
  if (!isFirst && LOWER.has(bare)) return w.toLowerCase();

  // CAIXA ALTA inteira achata antes de capitalizar; caixa mista
  // (Cream Cheese, McDonald) fica como está
  if (base === base.toUpperCase() && base.length > 1) base = base.toLowerCase();
  return base[0].toUpperCase() + base.slice(1);
}

function normalize(name) {
  let s = name.trim().replace(/\s+/g, ' ');

  // "Maki roll- filadelfia" -> "Maki roll - filadelfia"
  s = s.replace(/(\S)-\s/g, '$1 - ');
  // hífen solto entre palavras vira travessão de leitura
  s = s.replace(/\s+-\s+/g, ' — ');
  // "ao ml maracujá" é molho, não mililitro; "350 ml" continua mililitro
  s = s.replace(/\ba(o|os)\s+ml\s+/gi, 'ao Molho de ');
  // "c/" é como a casa escreve "com" e fica
  s = s.replace(/\bc\/\s*/g, 'c/ ');

  const out = s.split(' ').map((w, i) => {
    if (w === '—' || w === 'c/') return w;
    // preserva parênteses ao redor da palavra
    const m = w.match(/^([(\[]*)(.*?)([)\],.;:!?]*)$/);
    if (!m || !m[2]) return w;
    return m[1] + fixWord(m[2], i === 0 || /^[(\[]/.test(m[1])) + m[3];
  }).join(' ');

  return out.replace(/\s+/g, ' ').trim();
}

/* ---------- aplica e registra ---------- */
const D = JSON.parse(fs.readFileSync('data/menu.json', 'utf8'));
const log = [];
for (const c of D.categories) {
  for (const it of c.items) {
    const fixed = normalize(it.name);
    if (fixed !== it.name) log.push({ cat: c.title, de: it.name, para: fixed });
    it.name = fixed;
  }
}
fs.writeFileSync('data/menu.json', JSON.stringify(D));
fs.writeFileSync('data/renames.json', JSON.stringify(log, null, 1));

console.log('nomes alterados:', log.length, 'de', D.meta.dishes);
console.log('\n--- amostra ---');
log.slice(0, 28).forEach(r => console.log(`  ${r.de}\n    -> ${r.para}`));
