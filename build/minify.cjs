/* ============================================================
   Minificação e inlining do CSS.

   O CSS inteiro entra no <head> em vez de virar um request. Ele
   é o único recurso que bloqueia o render, e 9 KB comprimidos
   pesam menos que o custo de ida e volta pra buscá-lo. O JS
   continua arquivo separado porque é `defer` e cacheável.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const kb = n => (n / 1024).toFixed(1) + ' KB';
const gz = s => require('zlib').gzipSync(Buffer.from(s), { level: 9 }).length;

/* ---------- CSS ---------- */
const cssRaw = fs.readFileSync('assets/css/app.css', 'utf8');
const css = esbuild.transformSync(cssRaw, { loader: 'css', minify: true }).code.trim();

/* os @font-face apontam para ../fonts/ porque o arquivo vivia em
   assets/css/. Inline no <head>, o caminho passa a ser relativo à raiz. */
const cssInline = css.replace(/\.\.\/fonts\//g, 'assets/fonts/');

/* ---------- JS ---------- */
const jsRaw = fs.readFileSync('assets/js/app.js', 'utf8');
const js = esbuild.transformSync(jsRaw, {
  loader: 'js', minify: true, target: 'es2022',
  legalComments: 'none'
}).code;
fs.writeFileSync('assets/js/app.min.js', js);

/* ---------- HTML ---------- */
let html = fs.readFileSync('index.html', 'utf8');

const before = Buffer.byteLength(html);

html = html.replace(
  '<link rel="stylesheet" href="assets/css/app.css">',
  '<style>' + cssInline + '</style>'
);
html = html.replace('assets/js/app.js', 'assets/js/app.min.js');

/* tira o comentário de desenvolvimento e o espaço em branco entre tags,
   sem tocar no conteúdo de texto (que mudaria a renderização) */
html = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/>\s*\n\s*</g, '><')
  .replace(/\s{2,}/g, ' ');

fs.writeFileSync('index.html', html);

console.log('CSS   ', kb(cssRaw.length), '->', kb(css.length), '| gzip', kb(gz(css)));
console.log('JS    ', kb(jsRaw.length), '->', kb(js.length), '| gzip', kb(gz(js)));
console.log('HTML  ', kb(before), '->', kb(Buffer.byteLength(html)), '| gzip', kb(gz(html)));
console.log('\nrequests no caminho crítico: HTML + 3 fontes (o CSS foi embutido)');
