/* ============================================================
   MEDIÇÃO DAS ALTURAS DE GRUPO

   O cardápio inteiro — 231 pratos — existe no HTML, sem render por
   JavaScript. Para o navegador não calcular o layout de tudo de uma
   vez, cada grupo usa content-visibility:auto, e aí precisa dizer
   que altura reservar enquanto está fora da tela.

   Uma estimativa única não serve: os grupos vão de 272px a 2476px.
   Quando a reserva não bate com o conteúdo real, o navegador
   posiciona coisas em lugares inválidos, o scroll salta e os
   auditores de acessibilidade passam a medir alvos de toque errado.

   Este script sobe o site, mede a altura real de cada grupo em três
   larguras e grava data/heights.json, que o render injeta como
   --h-sm / --h-md / --h-lg em cada seção.

   Rode depois de qualquer mudança que altere o tamanho do cardápio.

   Precisa de: npm i -D puppeteer-core  +  Chrome instalado
   ============================================================ */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORTA = 4178;
const LARGURAS = { sm: 412, md: 900, lg: 1440 };

const CHROMES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};

(async () => {
  const chrome = CHROMES.find(p => fs.existsSync(p));
  if (!chrome) {
    console.error('Chrome não encontrado. Defina CHROME_PATH e rode de novo.');
    console.error('Sem esta medição o site funciona: o render cai para as');
    console.error('estimativas padrão de data/heights.json, se ele existir.');
    process.exit(1);
  }

  const raiz = process.cwd();
  const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(raiz, p);
    if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  }).listen(PORTA);

  const b = await puppeteer.launch({ executablePath: chrome, headless: 'shell', args: ['--no-sandbox'] });
  const saida = {};

  for (const [nome, largura] of Object.entries(LARGURAS)) {
    const p = await b.newPage();
    await p.setViewport({ width: largura, height: 900, deviceScaleFactor: 1 });
    await p.goto(`http://127.0.0.1:${PORTA}/`, { waitUntil: 'networkidle2' });
    // percorre a página para acionar os observadores e carregar as fotos,
    // senão os grupos seriam medidos antes de existirem de fato
    await p.evaluate(async () => {
      const H = document.body.scrollHeight;
      for (let y = 0; y < H; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 1500));
    saida[nome] = await p.evaluate(() => Object.fromEntries(
      [...document.querySelectorAll('.group')].map(g => [g.dataset.slug, Math.round(g.getBoundingClientRect().height)])
    ));
    await p.close();
    console.log(`  ${nome} (${largura}px) medido — ${Object.keys(saida[nome]).length} grupos`);
  }

  await b.close();
  servidor.close();
  fs.writeFileSync('data/heights.json', JSON.stringify(saida, null, 1));
  console.log('\ndata/heights.json atualizado. Rode o build de novo para aplicar.');
})();
