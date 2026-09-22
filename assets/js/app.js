/* ============================================================
   JAPA MAKI — motor de interação
   Regras que valem para tudo aqui:
     · só transform, opacity e clip-path são animados
     · FLIP e sheet usam WAAPI (aceleração de hardware + interrompível)
     · nada de movimento se o usuário pediu prefers-reduced-motion
     · nada de hover em ponteiro grosso
   ============================================================ */
(() => {
  'use strict';

  const html = document.documentElement;
  html.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine   = matchMedia('(hover: hover) and (pointer: fine)');
  const EASE   = 'cubic-bezier(.23,1,.32,1)';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------------------------------------------------
     1. HEADER — ganha fundo só depois que o hero sai do topo
     --------------------------------------------------------- */
  (() => {
    const hdr = $('.hdr');
    if (!hdr) return;
    const sentinel = $('#top-sentinel');
    if (!sentinel) return;
    new IntersectionObserver(
      ([e]) => { hdr.toggleAttribute('data-lifted', !e.isIntersecting); },
      { rootMargin: '-8px 0px 0px 0px' }
    ).observe(sentinel);
  })();

  /* ---------------------------------------------------------
     2. STATUS — aberto/fechado calculado no fuso do restaurante,
        não no fuso de quem acessa. Um cliente em Lisboa tem que
        ver o horário do Rio.
     --------------------------------------------------------- */
  (() => {
    const el = $('#status');
    if (!el) return;
    const label = $('#status-label', el);
    let hours;
    try { hours = JSON.parse(el.dataset.hours); } catch { return; }

    const nowInRio = () => {
      const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      const g = t => p.find(x => x.type === t)?.value;
      const map = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
      return { day: map[g('weekday')], min: +g('hour') * 60 + +g('minute') };
    };
    const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

    const paint = () => {
      const { day, min } = nowInRio();
      const today = hours.find(h => h.d === day);
      let open = false, text;
      if (today) {
        const s = toMin(today.start), e = toMin(today.end);
        open = min >= s && min <= e;
        if (open) {
          text = `Aberto agora \u00b7 at\u00e9 ${today.end}`;
        } else if (min < s) {
          const w = s - min;
          text = w <= 90
            ? `Abre em ${w} min`
            : `Abre hoje \u00e0s ${today.start}`;
        } else {
          text = `Fechado \u00b7 abre amanh\u00e3 \u00e0s 18:00`;
        }
      } else {
        text = 'Consulte os hor\u00e1rios';
      }
      el.dataset.open = String(open);
      label.textContent = text;
    };
    paint();
    setInterval(paint, 30000);

    // destaca a linha de hoje na tabela de horários
    const { day } = nowInRio();
    $$('.hours__r').forEach(r => {
      r.toggleAttribute('data-today', +r.dataset.day === day);
    });
  })();

  /* ---------------------------------------------------------
     3. REVELAÇÃO NO SCROLL — clip-path + translate, com stagger
        curto. Cada elemento é desobservado ao entrar: um
        IntersectionObserver que continua vigiando 231 cards é
        desperdício puro.
     --------------------------------------------------------- */
  (() => {
    const items = $$('[data-rv]');
    if (!items.length) return;

    if (reduce.matches) {
      items.forEach(el => el.classList.add('is-in', 'is-done'));
      return;
    }

    const show = el => {
      el.style.setProperty('--rv-d', '0ms');
      el.classList.add('is-in', 'is-done');
    };

    /* Nada é medido aqui de propósito. Um getBoundingClientRect no
       init força o navegador a calcular o primeiro layout na hora —
       85ms de reflow síncrono antes da página aparecer. O próprio
       observer já entrega, no primeiro callback, tudo o que está na
       tela, e faz isso de forma assíncrona. A garantia contra
       conteúdo invisível é o prazo mais abaixo. */

    const io = new IntersectionObserver((entries, obs) => {
      // ordena por posição para o stagger seguir a leitura, não a ordem do DOM
      entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((e, i) => {
          const el = e.target;
          // 45ms entre itens, teto de 6 — stagger longo faz a página parecer lenta
          el.style.setProperty('--rv-d', `${Math.min(i, 6) * 45}ms`);
          el.classList.add('is-in');
          el.addEventListener('transitionend', () => el.classList.add('is-done'), { once: true });
          obs.unobserve(el);
        });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    items.forEach(el => io.observe(el));

    // prazo final: nada fica invisível por causa de uma animação
    setTimeout(() => {
      for (const el of items) {
        if (!el.classList.contains('is-in')) { show(el); io.unobserve(el); }
      }
    }, 2500);
  })();

  /* ---------------------------------------------------------
     4. HEADLINE — as linhas sobem por dentro da máscara
     --------------------------------------------------------- */
  (() => {
    const hero = $('.hero'), title = $('.hero__title');
    if (!hero || !title) return;
    if (reduce.matches) { hero.classList.add('is-in'); title.classList.add('is-in'); return; }
    $$('.ln > span', title).forEach((s, i) => s.style.setProperty('--ln-d', `${i * 90}ms`));
    // dois frames: garante que o estado inicial foi pintado antes de transicionar
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.classList.add('is-in');
      title.classList.add('is-in');
    }));
  })();

  /* ---------------------------------------------------------
     5. PARALLAX DO DISCO — amarrado ao scroll via rAF.
        Escreve transform direto no elemento; setar uma custom
        property no pai recalcularia o estilo de todo filho.
     --------------------------------------------------------- */
  (() => {
    const sun = $('.hero__sun');
    if (!sun || reduce.matches) return;
    let raf = 0, last = -1;
    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      if (y === last) return;
      last = y;
      const vh = innerHeight;
      if (y > vh * 1.25) return;               // fora de vista: não gasta frame
      const p = Math.min(y / vh, 1);
      // sobe mais devagar que a página e encolhe de leve: profundidade
      sun.style.transform =
        `translate3d(-50%, calc(-50% + ${(y * 0.28).toFixed(1)}px), 0) scale(${(1 - p * 0.12).toFixed(4)})`;
      sun.style.opacity = String(1 - p * 0.55);
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
    tick();
  })();

  /* ---------------------------------------------------------
     7. HOVER MAGNÉTICO — o card inclina na direção do cursor.
        O valor não segue o mouse direto: passa por um
        integrador de mola, senão parece elástico de borracha.
        Um único rAF serve todos os cards ativos.
     --------------------------------------------------------- */
  const magnet = (() => {
    if (!fine.matches || reduce.matches) return { attach: () => {} };

    const live = new Set();
    const state = new WeakMap();   // estado criado só no primeiro hover
    let raf = 0;
    const STIFF = 0.14, DAMP = 0.72;   // mola crítica-ish: assenta sem tremer

    const frame = () => {
      raf = 0;
      for (const s of live) {
        for (const k of ['x', 'y', 'z']) {
          s.v[k] = (s.v[k] + (s.t[k] - s.c[k]) * STIFF) * DAMP;
          s.c[k] += s.v[k];
        }
        const done =
          Math.abs(s.t.x - s.c.x) < 0.02 && Math.abs(s.v.x) < 0.02 &&
          Math.abs(s.t.y - s.c.y) < 0.02 && Math.abs(s.v.y) < 0.02 &&
          Math.abs(s.t.z - s.c.z) < 0.0002;
        // string transform completa: garante composição na GPU
        s.el.style.transform = done && s.t.z === 0
          ? ''
          : `perspective(900px) translate3d(0,${s.c.y.toFixed(2)}px,0)` +
            ` rotateX(${(-s.c.y * 0.055).toFixed(3)}deg)` +
            ` rotateY(${(s.c.x * 0.055).toFixed(3)}deg)` +
            ` scale(${(1 + s.c.z).toFixed(4)})`;
        if (done) { live.delete(s); s.el.style.willChange = 'auto'; }
      }
      if (live.size) raf = requestAnimationFrame(frame);
    };
    const wake = s => { live.add(s); s.el.style.willChange = 'transform'; if (!raf) raf = requestAnimationFrame(frame); };

    const get = el => {
      let s = state.get(el);
      if (!s) {
        s = { el, c: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, t: { x: 0, y: 0, z: 0 } };
        state.set(el, s);
      }
      return s;
    };

    /* Dois ouvintes delegados no container, não dois por card.
       Com 244 cards, amarrar um par em cada um custava ~500
       ouvintes registrados antes do primeiro clique — a maior
       parcela do tempo de bloqueio na carga. */
    return {
      attach(root, selector) {
        root.addEventListener('pointermove', ev => {
          if (ev.pointerType !== 'mouse') return;
          const el = ev.target.closest(selector);
          if (!el) return;
          const s = get(el);
          const r = el.getBoundingClientRect();
          s.t.x = ((ev.clientX - r.left) / r.width - 0.5) * 16;
          s.t.y = ((ev.clientY - r.top) / r.height - 0.5) * 10;
          s.t.z = 0.012;
          wake(s);
        }, { passive: true });

        // pointerout borbulha (pointerleave não), então serve na delegação;
        // relatedTarget evita zerar quando o cursor só troca de filho
        root.addEventListener('pointerout', ev => {
          const el = ev.target.closest(selector);
          if (!el || (ev.relatedTarget && el.contains(ev.relatedTarget))) return;
          const s = state.get(el);
          if (!s) return;
          s.t.x = s.t.y = s.t.z = 0;
          wake(s);
        }, { passive: true });
      }
    };
  })();

  /* ---------------------------------------------------------
     8. FILTRO + BUSCA com FLIP
        Medir → mudar o DOM → medir → animar a diferença.
        É a única forma de animar uma remontagem de grid sem
        animar width/height (que dispara layout a cada frame).
     --------------------------------------------------------- */
  (() => {
    const wrap = $('#menu');
    if (!wrap) return;

    const groups  = $$('.group', wrap);
    const chips   = $$('.chip', $('#chips'));
    const input   = $('#q');
    const searchW = $('#search');
    const empty   = $('#empty');
    const countEl = $('#result-count');

    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const cards = $$('[data-vars]', wrap).map(el => ({
      el,
      group: el.closest('.group'),
      box: el.closest('[data-cat]'),
      hay: null                       // preenchido na primeira busca
    }));

    /* Normalizar 231 nomes e descrições na carga é trabalho jogado fora:
       a maioria das visitas nunca digita nada. O índice é montado na
       primeira tecla e reaproveitado a partir daí. */
    let indexed = false;
    const index = () => {
      if (indexed) return;
      indexed = true;
      for (const c of cards) {
        c.hay = norm(`${c.el.dataset.name} ${c.el.dataset.desc || ''} ${c.group.dataset.title}`);
      }
    };

    let cat = 'all', q = '';

    /* --- FLIP ---------------------------------------------- */
    const flip = mutate => {
      if (reduce.matches) { mutate(); return; }

      // 1. primeiro: posições atuais dos cards visíveis
      const first = new Map();
      for (const { el } of cards) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        first.set(el, r);
      }

      // 2. muda o DOM
      mutate();

      // 3. último: posições novas, e anima a diferença
      for (const { el } of cards) {
        const visible = el.offsetParent !== null;
        const a = first.get(el);
        if (!visible) continue;

        const b = el.getBoundingClientRect();
        // grupo com layout pulado por content-visibility: nada a animar
        if (b.height === 0) continue;

        // entrando: não havia posição anterior
        if (!a) {
          el.animate(
            [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 300, easing: EASE, fill: 'none' }
          );
          continue;
        }

        const dx = a.left - b.left, dy = a.top - b.top;
        const sx = a.width / b.width, sy = a.height / b.height;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;

        // cancela o que estivesse rodando: FLIP interrompido não empilha
        el.getAnimations().forEach(x => x.cancel());
        el.animate(
          [
            { transform: `translate3d(${dx}px,${dy}px,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})` },
            { transform: 'translate3d(0,0,0) scale(1)' }
          ],
          { duration: 460, easing: EASE, composite: 'replace' }
        );
      }
    };

    /* --- aplica os dois filtros ---------------------------- */
    const apply = () => {
      const nq = norm(q.trim());
      if (nq) index();
      const terms = nq ? nq.split(/\s+/) : [];
      let shown = 0;

      flip(() => {
        for (const c of cards) {
          const okCat = cat === 'all' || c.group.dataset.slug === cat;
          const okQ   = !terms.length || terms.every(t => c.hay.includes(t));
          const on    = okCat && okQ;
          c.el.hidden = !on;
          if (on) shown++;
        }
        // grupo sem nenhum card visível sai inteiro, com o cabeçalho
        for (const g of groups) {
          g.hidden = !$$('[data-vars]:not([hidden])', g).length;
        }
        empty.hidden = shown > 0;
      });

      countEl.textContent = shown === 1 ? '1 prato' : `${shown} pratos`;
      searchW.toggleAttribute('data-filled', q.length > 0);

      // se o resultado ficou acima da dobra atual, traz o usuário de volta
      // pro começo da lista em vez de deixá-lo num trecho vazio
      const first = $('.group:not([hidden])', wrap) || empty;
      if (first) {
        const top = first.getBoundingClientRect().top;
        if (top < 0 || top > innerHeight * 0.9) {
          const bar = $('.menubar');
          const offset = (bar ? bar.getBoundingClientRect().height : 0) + 76;
          scrollTo({
            top: scrollY + top - offset,
            behavior: reduce.matches ? 'auto' : 'smooth'
          });
        }
      }
    };

    /* --- chips --------------------------------------------- */
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        cat = chip.dataset.cat;
        chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        // centraliza o chip mexendo só na trilha, nunca no scroll da página
        const track = chip.parentElement;
        track.scrollTo({
          left: chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2,
          behavior: reduce.matches ? 'auto' : 'smooth'
        });
        apply();
      });
    });

    /* --- busca: debounce curto, o suficiente pra não
           re-medir o layout a cada tecla ------------------- */
    let t = 0;
    input.addEventListener('input', () => {
      q = input.value;
      clearTimeout(t);
      t = setTimeout(apply, 90);
    });
    $('#q-clear').addEventListener('click', () => {
      input.value = ''; q = ''; apply(); input.focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape' && input.value) { input.value = ''; q = ''; apply(); }
    });

    // atalho: "/" foca a busca. Sem animação — ação de teclado
    // é repetida dezenas de vezes e animar faria parecer lenta.
    addEventListener('keydown', e => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });

    magnet.attach(document.body, '.dish, .row');
  })();

  /* ---------------------------------------------------------
     9. FICHA DO PRATO — <dialog> nativo (foco preso, Esc e
        backdrop de graça) com o painel crescendo a partir do
        card que foi clicado, não do centro da tela.
     --------------------------------------------------------- */
  (() => {
    const dlg = $('#sheet');
    if (!dlg) return;
    const panel = $('.sheet__panel', dlg);
    let origin = null;

    const fill = card => {
      const d = card.dataset;
      // categoria e kanji vivem no container do grupo, não repetidos em
      // cada um dos 244 cards. Declarado aqui, antes de qualquer uso.
      const box = card.closest('[data-cat]');
      const media = $('#sheet-media');
      const img = $('#sheet-img');
      const kanji = $('#sheet-kanji');

      if (d.img) {
        img.src = `assets/img/dish/${d.img}-800.webp`;
        img.alt = d.name;
        media.hidden = false;
        kanji.hidden = true;
      } else {
        media.hidden = true;
        kanji.hidden = false;
        kanji.textContent = box ? box.dataset.kanji : '';
      }
      $('#sheet-cat').textContent = box ? box.dataset.cat : '';
      const pieces = $('#sheet-pieces');
      pieces.textContent = d.pieces || '';
      pieces.hidden = !d.pieces;
      // nome sem o sufixo "(50 Peças)": a contagem já aparece na etiqueta
      $('#sheet-title').textContent = d.clean || d.name;
      const desc = $('#sheet-desc');
      desc.textContent = d.desc || '';
      desc.hidden = !d.desc;

      const vars = JSON.parse(d.vars);
      $('#sheet-vars').innerHTML = vars.map(v => `
        <div class="sheet__var">
          <dt>${v.label === 'Único' ? 'Porção' : v.label}</dt>
          <dd><span class="c">R$</span>${v.price.toFixed(2).replace('.', ',')}</dd>
        </div>`).join('');

      $('#sheet-order').href = dlg.dataset.orderUrl;
    };

    const open = card => {
      origin = card;
      fill(card);
      dlg.showModal();
      // o painel leva o foco pra leitura de tela sem acender o anel de
      // foco de quem abriu com o mouse
      panel.focus({ preventScroll: true });

      if (reduce.matches) return;

      // cresce a partir do retângulo do card de origem
      const a = card.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      const sx = Math.max(a.width / b.width, 0.25);
      const sy = Math.max(a.height / b.height, 0.25);
      const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
      const dy = (a.top + a.height / 2) - (b.top + b.height / 2);

      panel.animate(
        [
          { transform: `translate3d(${dx}px,${dy}px,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`, opacity: 0 },
          { transform: 'translate3d(0,0,0) scale(1,1)', opacity: 1 }
        ],
        { duration: 300, easing: EASE }
      );
      dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    };

    const close = () => {
      if (reduce.matches || !origin) { dlg.close(); return; }
      const a = origin.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      // volta pro card só se ele ainda estiver na tela; senão, sai pra baixo
      const onscreen = a.bottom > 0 && a.top < innerHeight && a.width > 0;
      const to = onscreen
        ? `translate3d(${(a.left + a.width / 2) - (b.left + b.width / 2)}px,${(a.top + a.height / 2) - (b.top + b.height / 2)}px,0) scale(${Math.max(a.width / b.width, .25).toFixed(3)},${Math.max(a.height / b.height, .25).toFixed(3)})`
        : 'translate3d(0,24px,0) scale(.97)';

      // saída mais curta que a entrada: o sistema responde, não delibera
      const anim = panel.animate(
        [{ transform: 'none', opacity: 1 }, { transform: to, opacity: 0 }],
        { duration: 200, easing: EASE }
      );
      anim.finished.then(() => dlg.close()).catch(() => dlg.close());
    };

    document.addEventListener('click', e => {
      const card = e.target.closest('[data-vars]');
      if (card) { open(card); return; }
      if (e.target.closest('[data-close]')) close();
    });

    // clique no backdrop fecha — o <dialog> não faz isso sozinho
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

    // Esc: intercepta pra animar a saída em vez de sumir seco
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });

    // devolve o foco pro card de origem ao fechar
    dlg.addEventListener('close', () => {
      if (origin && document.contains(origin)) origin.focus({ preventScroll: true });
    });
  })();

  /* ---------------------------------------------------------
     10. FOTOS — decodifica fora da thread principal e revela
         por cima do placeholder borrado.
     --------------------------------------------------------- */
  (() => {
    const reveal = img => {
      const done = () => img.closest('.dish__media')?.setAttribute('data-loaded', '');
      if (img.complete && img.naturalWidth) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    };
    $$('.dish__img').forEach(reveal);
  })();

  /* ---------------------------------------------------------
     11. CHIP ATIVO PELO SCROLL — sem filtro aplicado, o chip
         acompanha a seção que está sendo lida.
     --------------------------------------------------------- */
  (() => {
    const chips = $$('.chip');
    if (!chips.length) return;
    const byCat = new Map(chips.map(c => [c.dataset.cat, c]));
    const groups = $$('.group');
    if (!groups.length) return;

    const io = new IntersectionObserver(entries => {
      // só age quando nenhum filtro manual está ativo
      const manual = chips.find(c => c.getAttribute('aria-pressed') === 'true');
      if (!manual || manual.dataset.cat !== 'all') return;
      const top = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!top) return;
      const chip = byCat.get(top.target.dataset.slug);
      if (!chip) return;
      chips.forEach(c => c.classList.toggle('is-near', c === chip));
    }, { rootMargin: '-35% 0px -55% 0px' });

    groups.forEach(g => io.observe(g));
  })();

  /* ---------------------------------------------------------
     12. ANO NO RODAPÉ
     --------------------------------------------------------- */
  const yr = $('#year');
  if (yr) yr.textContent = String(new Date().getFullYear());

})();
