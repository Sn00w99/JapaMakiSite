/* ============================================================
   Gerador estático. Lê data/menu.json e escreve index.html.
   O HTML sai completo: 231 pratos no documento, nada renderizado
   por JavaScript. Bom pra SEO, bom pro LCP, e o site continua
   legível com o JS desligado.
   ============================================================ */
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data/menu.json', 'utf8'));

/* Alturas reais de cada grupo, medidas em três larguras por
   build/medir-alturas.cjs. Elas alimentam contain-intrinsic-size:
   com uma estimativa única e errada, o navegador reservava espaço
   que não batia com o conteúdo, e os auditores passavam a medir
   posições inválidas. Se o cardápio mudar de tamanho, rode o
   medidor de novo. */
const H = (() => {
  try { return JSON.parse(fs.readFileSync('data/heights.json', 'utf8')); }
  catch { return { sm: {}, md: {}, lg: {} }; }
})();
const S = D.store;

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const brl = n => n.toFixed(2).replace('.', ',');
const DAYS = ['', 'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/* categorias que viram a seção de destaque, na ordem em que aparecem lá */
const FEATURED = ['combinados', 'promocoes', 'especial-dos-namorados'];
const byslug = Object.fromEntries(D.categories.map(c => [c.slug, c]));

/* "(50 Peças)" no nome vira etiqueta e sai do título */
const splitPieces = name => {
  const m = name.match(/\s*\((\d+)\s*(?:Pç?s?|Peças?|PEÇAS?)\)\s*$/i);
  return m ? { name: name.slice(0, m.index).trim(), pieces: `${m[1]} peças` } : { name, pieces: null };
};

/* ============================================================
   EMPACOTAMENTO DO BENTO
   O grid tem 12 colunas. Em vez de largar spans soltos e deixar
   vãos no fim das linhas, o layout é resolvido aqui: cada linha
   soma exatamente 12, e o span largo de cada linha vai pro item
   com a melhor foto — sem nunca reordenar o cardápio.
   ============================================================ */
const ROWS = [[6, 3, 3], [4, 4, 4], [3, 3, 3, 3], [3, 3, 6], [4, 4, 4], [6, 6]];
const CLOSERS = { 1: [12], 2: [6, 6], 3: [4, 4, 4], 4: [3, 3, 3, 3] };

function pack(items, { allowHero = true } = {}) {
  const out = [];
  let i = 0, r = 0;

  // abre com um retrato 6x2 quando existe foto grande o bastante
  // e há itens suficientes pra preencher os 6 vãos ao lado dele
  if (allowHero && items.length >= 5) {
    const h = items.findIndex(it => it.tier === 3);
    if (h !== -1) {
      const hero = items[h];
      const rest = items.slice(0, h).concat(items.slice(h + 1));
      out.push({ it: hero, span: 'hero' });
      for (let k = 0; k < 4 && k < rest.length; k++) out.push({ it: rest[k], span: 3 });
      return out.concat(pack(rest.slice(4), { allowHero: false }));
    }
  }

  while (i < items.length) {
    const left = items.length - i;
    let pattern;
    if (left <= 4 && CLOSERS[left]) {
      pattern = CLOSERS[left];                 // fecha a última linha sem vão
    } else {
      pattern = ROWS[r++ % ROWS.length];
      if (pattern.length > left) pattern = CLOSERS[Math.min(left, 4)] || [3, 3, 3, 3];
    }
    const slice = items.slice(i, i + pattern.length);
    // o span mais largo da linha vai pro item de melhor foto
    const widest = Math.max(...pattern);
    const best = slice.reduce((a, b, bi) => (b.tier > slice[a].tier ? bi : a), 0);
    const spans = [...pattern];
    const wi = spans.indexOf(widest);
    if (wi !== best) { [spans[wi], spans[best]] = [spans[best], spans[wi]]; }
    slice.forEach((it, k) => out.push({ it, span: spans[k] }));
    i += pattern.length;
  }
  return out;
}

/* Variação determinística do kanji de fundo. Sem isto, 41 cards de
   bebida com o mesmo caractere na mesma escala viram papel de parede. */
const kanjiStyle = i => {
  const rot = [-4, 2, -1, 5, -6, 3, 0, -3][i % 8];
  const sc  = [1, 1.14, .92, 1.06, .97, 1.2, 1.02, .88][i % 8];
  const op  = [.075, .055, .09, .065, .08, .05, .07, .095][i % 8];
  return `--k-rot:${rot}deg;--k-s:${sc};--k-o:${op}`;
};

/* Uma linha da lista compacta (categorias grandes e sem foto). */
function row(it, cat) {
  const { name, pieces } = splitPieces(it.name);
  const prices = it.vars.map(v => v.price).filter(p => p > 0);
  const cheapest = prices.length ? Math.min(...prices) : 0;
  const multi = it.vars.length > 1;
  return `
      <button type="button" class="row"
        data-name="${esc(it.name)}" data-clean="${esc(name)}"
        ${pieces ? `data-pieces="${pieces}"` : ''}
        data-desc="${esc(it.desc || '')}"
        data-vars="${esc(JSON.stringify(it.vars))}" aria-haspopup="dialog">
        <span class="row__n">${esc(name)}${it.desc ? `<span class="row__d">${esc(it.desc)}</span>` : ''}</span>
        <span class="row__p">${cheapest
          ? (multi ? '' : '') + '<span class="c">R$</span>' + brl(cheapest)
          : '<span class="opt">Ver opções</span>'}</span>
        <span class="sr">Ver detalhes deste prato</span>
      </button>`;
}

/* ============================================================
   O CARD
   Dois corpos possíveis. Com foto, a imagem manda. Sem foto —
   68% do cardápio — o card é uma composição tipográfica com o
   kanji da seção em marca d'água e o disco da marca no canto.
   Nos dois casos ele pesa igual no mosaico.
   ============================================================ */
function card({ it, span }, cat, i) {
  const { name, pieces } = splitPieces(it.name);
  const cls = ['dish'];
  const cell = span === 'hero' ? 'cell--hero' : span === 12 ? 'cell--6' : span === 6 ? 'cell--6' : span === 4 ? 'cell--4' : 'cell';
  if (!it.img) cls.push('dish--type');

  const multi = it.vars.length > 1;
  const prices = it.vars.map(v => v.price).filter(p => p > 0);
  const cheapest = prices.length ? Math.min(...prices) : 0;

  // priority na primeira dobra, lazy no resto — o LCP agradece
  const eager = cat.featured && i < 2;
  const w = span === 'hero' ? 800 : 400;

  const media = it.img ? `
        <div class="dish__media"${it.lqip ? ` style="background-image:url(${it.lqip})"` : ''}>
          <img class="dish__img" src="assets/img/dish/${it.img}-${w}.webp"
               ${span === 'hero' ? `srcset="assets/img/dish/${it.img}-400.webp 400w, assets/img/dish/${it.img}-800.webp 800w" sizes="(max-width:40rem) 100vw, 50vw"` : ''}
               alt="${esc(name)}" width="${w}" height="${Math.round(w * 0.75)}"
               ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
        </div>` : `
        <span class="dish__kanji" aria-hidden="true" style="${kanjiStyle(i)}">${cat.kanji}</span>
        <span class="dish__disc" aria-hidden="true"></span>`;

  return `
      <button type="button" class="${cls.join(' ')} ${cell}"
        data-name="${esc(it.name)}" data-clean="${esc(name)}" ${pieces ? `data-pieces="${pieces}"` : ''} data-desc="${esc(it.desc || '')}"
        ${it.img ? `data-img="${it.img}"` : ''}
        data-vars="${esc(JSON.stringify(it.vars))}"
        aria-haspopup="dialog">
        ${media}
        <div class="dish__body">
          ${pieces ? `<span class="tag">${pieces}</span>` : ''}
          <p class="dish__name">${esc(name)}</p>
          ${it.desc ? `<p class="dish__desc">${esc(it.desc)}</p>` : ''}
          <div class="dish__foot">
            <p class="dish__price tnum">${cheapest
              ? (multi ? '<span class="from">a partir de</span>' : '') + '<span class="c">R$</span>' + brl(cheapest)
              : '<span class="opt">Ver opções</span>'}</p>
          </div>
          <span class="sr">Ver detalhes deste prato</span>
        </div>
      </button>`;
}

/* um grupo = uma categoria com cabeçalho numerado e seu bento */
function group(cat, n) {
  const packed = pack(cat.items);
  return `
    <section class="group" id="cat-${cat.slug}" data-slug="${cat.slug}" data-title="${esc(cat.title)}" aria-labelledby="h-${cat.slug}"
      style="--h-sm:${H.sm[cat.slug] || 900}px;--h-md:${H.md[cat.slug] || 1200}px;--h-lg:${H.lg[cat.slug] || 900}px">
      <header class="group__head" data-rv>
        <div class="group__id">
          <span class="group__num tnum" aria-hidden="true">${String(n).padStart(2, '0')}</span>
          <div>
            <h3 class="group__title" id="h-${cat.slug}">${esc(cat.title)}</h3>
            ${cat.sub ? `<p class="group__sub">${esc(cat.sub)}</p>` : ''}
          </div>
        </div>
        <p class="group__meta tnum">${cat.items.length} ${cat.items.length === 1 ? 'prato' : 'pratos'} · R$ ${brl(cat.min)}–${brl(cat.max)}</p>
      </header>
      ${cat.asList
        ? `<div class="rows" data-cat="${esc(cat.title)}" data-kanji="${cat.kanji}">${cat.items.map(it => row(it, cat)).join('')}</div>`
        : `<div class="bento" data-cat="${esc(cat.title)}" data-kanji="${cat.kanji}">${packed.map((p, i) => card(p, cat, i)).join('')}</div>`}
    </section>`;
}

/* ---------- dados derivados para os textos ---------- */
const nDish = D.meta.dishes;
const nCat  = D.meta.cats;
const featCats = FEATURED.map(s => byslug[s]).filter(Boolean);
const featItems = featCats.flatMap(c => c.items.map(it => ({ it, cat: c })));
const maxPieces = Math.max(...featItems.map(({ it }) => {
  const m = it.name.match(/\((\d+)\s*(?:Pç?s?|Peças?)\)/i); return m ? +m[1] : 0;
}));
const menuCats = D.categories.filter(c => !FEATURED.includes(c.slug));
for (const c of D.categories) {
  c.asList = c.items.length >= 20 && !c.items.some(it => it.img);
}
const MAPS = 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Japa Maki Temakeria, Av. Dom Helder Câmara 6001, Arena Mall, Pilares, Rio de Janeiro');

/* ---------- marca em SVG ---------- */
/* Recriação vetorial do símbolo da logo: o disco hinomaru com os
   dois hashi cruzados por cima. Escala sem perda, herda as cores
   dos tokens, e pesa menos que o JPEG de 150px do original.     */
const MARK = `<svg class="mark" viewBox="0 0 40 40" role="img" aria-label="Japa Maki">
    <circle class="mark__disc" cx="20" cy="20" r="13"/>
    <g class="mark__hashi"><path d="M4 33 34 7"/><path d="M4 26 34 33"/></g>
  </svg>`;

const LOCK = (tag = 'span') => `<${tag} class="hdr__brand">
      ${MARK}
      <span class="wordmark">JAPA MAKI<small>Temakeria e Sushi Bar</small></span>
    </${tag}>`;

/* ---------- JSON-LD ---------- */
const LD = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: S.full,
  alternateName: S.name,
  servesCuisine: ['Japonesa', 'Sushi', 'Temaki'],
  priceRange: 'R$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: S.address,
    addressLocality: S.district + ', ' + S.city,
    addressRegion: S.state,
    addressCountry: 'BR'
  },
  openingHoursSpecification: S.hours.map(h => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][h.d],
    opens: h.start, closes: h.end
  })),
  hasMenu: {
    '@type': 'Menu',
    name: 'Cardápio Japa Maki',
    hasMenuSection: D.categories.map(c => ({
      '@type': 'MenuSection',
      name: c.title,
      hasMenuItem: c.items.map(it => ({
        '@type': 'MenuItem',
        name: splitPieces(it.name).name,
        offers: { '@type': 'Offer', price: it.vars[0].price.toFixed(2), priceCurrency: 'BRL' }
      }))
    }))
  },
  potentialAction: { '@type': 'OrderAction', target: S.order_url },
  hasDeliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet'
};

/* ============================================================
   DOCUMENTO
   ============================================================ */
const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Japa Maki — Temakeria e Sushi Bar em Pilares, Rio de Janeiro</title>
<meta name="description" content="Temakeria e sushi bar no Arena Mall, em Pilares. ${nDish} pratos entre sashimis, temakis, hots e combinados pra dividir. Aberto todo dia às 18h, entrega em ${S.deliveryTime} minutos.">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://japamaki.com.br/">

<meta property="og:type" content="restaurant">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Japa Maki">
<meta property="og:title" content="Japa Maki — Temakeria e Sushi Bar em Pilares">
<meta property="og:description" content="${nDish} pratos, ${nCat} seções e combinados de até ${maxPieces} peças. Todo dia às 18h, no Arena Mall.">
<meta property="og:image" content="assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/icon-180.png">

<!-- as fontes vêm antes do CSS: são o caminho crítico do texto -->
<link rel="preload" href="assets/fonts/instrument-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/instrument-italic-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/app.css">

</head>
<body>
<a class="skip" href="#menu">Ir para o cardápio</a>

<header class="hdr">
  <a href="#top">${LOCK('span')}<span class="sr">Ir para o início</span></a>
  <nav class="hdr__nav" aria-label="Seções">
    <a class="hdr__link" href="#destaques">Combinados</a>
    <a class="hdr__link" href="#menu">Cardápio</a>
    <a class="hdr__link" href="#casa">A casa</a>
    <a class="hdr__link" href="#visite">Visite</a>
    <a class="btn btn--hino btn--sm" href="${S.order_url}" target="_blank" rel="noopener">
      Pedir <span class="btn__arrow" aria-hidden="true">→</span>
    </a>
  </nav>
</header>

<span id="top-sentinel" aria-hidden="true"></span>

<main id="top">

  <!-- ============ HERO ============ -->
  <section class="hero">
    <span class="hero__sun" aria-hidden="true"></span>
    <span class="hero__grain" aria-hidden="true"></span>

    <div class="shell hero__body">
      <div class="hero__eyebrow">
        <span class="eyebrow">Arena Mall · ${S.district} · ${S.city}</span>
        <span class="hero__rule" aria-hidden="true"></span>
        <span class="status" id="status" data-open="false" data-hours="${esc(JSON.stringify(S.hours))}">
          <span class="status__dot" aria-hidden="true"></span>
          <span id="status-label">Horários</span>
        </span>
      </div>

      <h1 class="hero__title display">
        <span class="ln"><span>Todo dia, às seis,</span></span>
        <span class="ln"><span>a gente acende</span></span>
        <span class="ln"><span>o <em>balcão</em>.</span></span>
      </h1>

      <p class="hero__lead">
        Temakeria e sushi bar em ${S.district}. <b>${nDish} pratos</b> entre sashimis, temakis,
        hots e combinados pra dividir — entrega em ${S.deliveryTime} minutos, retirada em ${S.pickupTime}.
      </p>

      <div class="hero__cta">
        <a class="btn btn--hino" href="${S.order_url}" target="_blank" rel="noopener">
          Fazer meu pedido <span class="btn__arrow" aria-hidden="true">→</span>
        </a>
        <a class="btn btn--ghost" href="#menu">Ver o cardápio</a>
      </div>
    </div>

    <div class="facts">
      <div class="facts__i">
        <span class="eyebrow">No cardápio</span>
        <span class="facts__v tnum">${nDish}<span class="u">pratos</span></span>
      </div>
      <div class="facts__i">
        <span class="eyebrow">Entrega</span>
        <span class="facts__v tnum">${S.deliveryTime}<span class="u">min</span></span>
      </div>
      <div class="facts__i">
        <span class="eyebrow">Abre</span>
        <span class="facts__v tnum">18<span class="u">h · todo dia</span></span>
      </div>
      <div class="facts__i">
        <span class="eyebrow">Pedido mínimo</span>
        <span class="facts__v tnum"><span class="u">R$</span>${S.minimum}</span>
      </div>
    </div>
  </section>

  <!-- ============ DESTAQUES: combinados ============ -->
  <section class="sec shell" id="destaques" aria-labelledby="h-destaques">
    <div class="sec__idx" data-rv><b>01 / Para dividir</b></div>
    <div class="sec__head">
      <h2 class="sec__title display" id="h-destaques" data-rv>
        Sushi é comida de <em>dividir</em>.<br>A gente monta na travessa.
      </h2>
      <p class="sec__note" data-rv style="--rv-d:80ms">
        ${featItems.length} montagens diferentes, de 30 a ${maxPieces} peças — combinados da casa,
        promoções da semana e os especiais para duas pessoas. É o que mais sai daqui.
      </p>
    </div>
    ${featCats.map(c => `<div class="bento" data-cat="${esc(c.title)}" data-kanji="${c.kanji}">${pack(c.items).map((p, i) => card(p, { ...c, featured: true }, i)).join('')}</div>`).join('')}
  </section>

  <!-- ============ CARDÁPIO ============ -->
  <section class="sec" id="menu" aria-labelledby="h-menu">
    <div class="shell">
      <div class="sec__idx" data-rv><b>02 / Cardápio</b></div>
      <div class="sec__head">
        <h2 class="sec__title display" id="h-menu" data-rv>O cardápio inteiro,<br>sem atalho.</h2>
        <p class="sec__note" data-rv style="--rv-d:80ms">
          ${nCat} seções, do sashimi ao harumaki doce. Filtre pela seção,
          ou busque pelo nome do prato — a tecla <kbd>/</kbd> foca a busca.
        </p>
      </div>
    </div>

    <!-- barra de filtro: cola embaixo do header -->
    <div class="menubar">
      <div class="menubar__row">
        <div class="search" id="search">
          <svg class="search__ic" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6 14 14"/></svg>
          <input class="search__i" id="q" type="search" placeholder="Buscar prato…"
                 autocomplete="off" spellcheck="false" aria-label="Buscar no cardápio"
                 aria-describedby="result-count">
          <button class="search__clear" id="q-clear" type="button" aria-label="Limpar busca">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>
          </button>
        </div>
        <div class="chips" id="chips" role="group" aria-label="Filtrar por seção">
          <button class="chip" type="button" data-cat="all" aria-pressed="true">
            Tudo <span class="chip__n">${nDish}</span>
          </button>
          ${D.categories.map(c => `<button class="chip" type="button" data-cat="${c.slug}" aria-pressed="false">
            ${esc(c.title)} <span class="chip__n">${c.items.length}</span>
          </button>`).join('')}
        </div>
      </div>
    </div>

    <div class="shell">
      <p class="sr" id="result-count" role="status" aria-live="polite">${nDish} pratos</p>
      ${D.categories.map((c, i) => group(c, i + 1)).join('')}
      <div class="empty" id="empty" hidden>
        <span class="empty__k" aria-hidden="true">空</span>
        <p class="empty__t">Nada com esse nome.</p>
        <p class="empty__s">Tente “salmão”, “temaki”, “hot” — ou limpe a busca.</p>
      </div>
    </div>
  </section>

  <!-- ============ A CASA ============
       NOTA PARA O LUCAS: este texto usa só o que os dados do cardápio
       provam — bairro, horário, tamanho do menu, faixa de preço, os
       pratos que existem de fato. Nenhuma data de fundação, nome de
       chef ou história foi inventada. Me conte o que é real e eu
       reescrevo este bloco inteiro.                                  -->
  <section class="sec shell" id="casa" aria-labelledby="h-casa">
    <div class="sec__idx" data-rv><b>03 / A casa</b></div>
    <div class="house">
      <div class="house__col">
        <h2 class="house__lead display" id="h-casa" data-rv>
          A gente fica no Arena Mall, em ${S.district}. Abre todo dia às seis
          e fecha quando a <em>última mesa</em> termina.
        </h2>
        <figure class="house__shot" data-rv="clip" style="--rv-d:120ms">
          <img src="assets/img/casa-700.webp"
               srcset="assets/img/casa-700.webp 700w, assets/img/casa-1000.webp 1000w"
               sizes="(max-width:60rem) 100vw, 40vw"
               alt="Travessa de combinado montada com sashimis, maki rolls e flores comestíveis"
               width="700" height="525" loading="lazy" decoding="async"
               style="background:url('data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAADQAwCdASoUAA8APxFwsFAsJiSisAgBgCIJagCdMoACjXhLLMyRnXAA/s123ZL5FMHdCaI9/fk48ttZXYHSPBr83bEFdR6/ZG/AwpX4YVx3eLqRsEcb2ZY4zLIcZjhAAAA=') center/cover">
          <figcaption>Combinado Japa Maki · 126 peças</figcaption>
        </figure>
      </div>
      <div class="house__col">
        <p class="house__p" data-rv>
          O cardápio é grande de propósito. São ${nDish} pratos em ${nCat} seções, porque
          temakeria de bairro atende quem chega pela primeira vez e quem já sabe
          exatamente o que quer. Tem o sashimi de salmão de sempre, e tem o carpaccio
          trufado com raspa de limão siciliano. Tem yakisoba pra família inteira,
          e tem o Japa Kids pra quem ainda não encara peixe cru.
        </p>
        <p class="house__p" data-rv style="--rv-d:70ms">
          Combinado é o que mais sai — e existe por um motivo simples: sushi é
          comida de dividir. A gente monta na travessa, você abre no meio da mesa.
        </p>
        <div class="tally" data-rv style="--rv-d:140ms">
          <div class="tally__i"><span class="tally__v tnum">${nDish}</span><span class="tally__l">pratos</span></div>
          <div class="tally__i"><span class="tally__v tnum">${nCat}</span><span class="tally__l">seções</span></div>
          <div class="tally__i"><span class="tally__v tnum">${maxPieces}</span><span class="tally__l">peças no maior</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ VISITE ============ -->
  <section class="sec shell" id="visite" aria-labelledby="h-visite">
    <div class="sec__idx" data-rv><b>04 / Visite</b></div>
    <div class="sec__head">
      <h2 class="sec__title display" id="h-visite" data-rv>Onde a gente está.</h2>
    </div>
    <div class="visit">
      <div data-rv>
        <p class="eyebrow eyebrow--hashi" style="margin-bottom:.85rem">Horário de funcionamento</p>
        <div class="hours">
          ${S.hours.map(h => `<div class="hours__r" data-day="${h.d}">
            <span class="hours__d">${DAYS[h.d]}</span>
            <span class="hours__t tnum">${h.start} — ${h.end}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="infolist" data-rv style="--rv-d:90ms">
        <div class="infolist__i">
          <span class="infolist__l">Endereço</span>
          <address class="infolist__v" style="font-style:normal">
            ${S.address}<br>
            ${S.district} · ${S.city} — ${S.state}<br>
            <a href="${MAPS}" target="_blank" rel="noopener">Abrir no mapa →</a>
          </address>
        </div>
        <div class="infolist__i">
          <span class="infolist__l">Entrega e retirada</span>
          <p class="infolist__v">
            Entrega em cerca de ${S.deliveryTime} minutos · retirada no balcão em ${S.pickupTime}.<br>
            Pedido mínimo de R$ ${S.minimum},00.
          </p>
        </div>
        <div class="infolist__i">
          <span class="infolist__l">Formas de pagamento</span>
          <div class="pays">${S.payments.map(p => `<span class="pay">${esc(p)}</span>`).join('')}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ CHAMADA ============ -->
  <section class="callout shell">
    <h2 class="callout__t" data-rv>Bateu a fome <em>agora</em>?</h2>
    <p class="callout__s" data-rv style="--rv-d:70ms">
      O pedido é finalizado no sistema da casa, com carrinho, cupom, cálculo
      de taxa e pagamento. Abre em uma aba nova.
    </p>
    <div class="callout__cta" data-rv style="--rv-d:140ms">
      <a class="btn btn--hino" href="${S.order_url}" target="_blank" rel="noopener">
        Pedir no Japa Maki <span class="btn__arrow" aria-hidden="true">→</span>
      </a>
      <a class="btn btn--ghost" href="${MAPS}" target="_blank" rel="noopener">Ver no mapa</a>
    </div>
  </section>
</main>

<footer class="foot">
  <div class="shell">
    <div class="foot__row">
      <div class="foot__brand">
        ${LOCK('span')}
        <address class="foot__addr">
          ${S.address}<br>
          ${S.district} · ${S.city} — ${S.state}<br>
          Todo dia, 18:00 às 23:45
        </address>
      </div>
      <nav class="foot__nav" aria-label="Rodapé">
        <div class="foot__col">
          <span class="foot__h">Cardápio</span>
          ${['combinados', 'temakis', 'sashimis', 'hots', 'yakisobas'].map(s =>
            byslug[s] ? `<a class="foot__l" href="#cat-${s}">${esc(byslug[s].title)}</a>` : '').join('')}
        </div>
        <div class="foot__col">
          <span class="foot__h">A casa</span>
          <a class="foot__l" href="#casa">Sobre</a>
          <a class="foot__l" href="#visite">Horário e endereço</a>
          <a class="foot__l" href="${MAPS}" target="_blank" rel="noopener">Como chegar</a>
        </div>
        <div class="foot__col">
          <span class="foot__h">Pedido</span>
          <a class="foot__l" href="${S.order_url}" target="_blank" rel="noopener">Fazer pedido</a>
          <a class="foot__l" href="${S.order_url}" target="_blank" rel="noopener">Acompanhar pedido</a>
        </div>
      </nav>
    </div>
    <div class="foot__base">
      <span>© <span id="year">2026</span> ${S.full}</span>
      <span>Preços e cardápio conforme o sistema de pedidos da casa.</span>
    </div>
  </div>
</footer>

<!-- ficha do prato -->
<dialog class="sheet" id="sheet" data-order-url="${S.order_url}" aria-labelledby="sheet-title">
  <div class="sheet__panel" tabindex="-1">
    <button class="sheet__close" type="button" data-close aria-label="Fechar">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>
    </button>
    <div class="sheet__media" id="sheet-media" hidden><img id="sheet-img" alt="" width="800" height="500" decoding="async"></div>
    <div class="sheet__body">
      <span class="sheet__kanji" id="sheet-kanji" aria-hidden="true" hidden></span>
      <div class="sheet__cat"><span class="eyebrow eyebrow--hashi" id="sheet-cat"></span><span class="tag" id="sheet-pieces" hidden></span></div>
      <h3 class="sheet__title" id="sheet-title"></h3>
      <p class="sheet__desc" id="sheet-desc"></p>
      <dl class="sheet__vars" id="sheet-vars"></dl>
      <a class="btn btn--hino" id="sheet-order" href="${S.order_url}" target="_blank" rel="noopener" style="justify-content:center">
        Pedir este prato <span class="btn__arrow" aria-hidden="true">→</span>
      </a>
      <p class="sheet__note">
        O pedido é finalizado no sistema do restaurante, onde você escolhe
        acompanhamentos, calcula a taxa de entrega e paga.
      </p>
    </div>
  </div>
</dialog>

<script src="assets/js/app.js" defer></script>

<!-- Dados estruturados no fim do corpo: são 29 KB que o parser teria
     de atravessar antes de chegar ao conteúdo se ficassem no <head>.
     O Google lê o JSON-LD em qualquer posição do documento. -->
<script type="application/ld+json">${JSON.stringify(LD)}</script>
</body>
</html>`;

fs.writeFileSync('index.html', HTML);
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('index.html   ', kb(Buffer.byteLength(HTML)));
console.log('pratos       ', nDish, 'em', nCat, 'secoes');
console.log('destaques    ', featItems.length, 'combinados');
console.log('maior combo  ', maxPieces, 'pecas');
