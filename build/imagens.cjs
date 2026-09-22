/* ============================================================
   PROCESSAMENTO DE IMAGENS

   Roda quando as fotos em fonte/fotos/ mudam. Produz:
     assets/img/dish/<hash>-400.webp   cards normais
     assets/img/dish/<hash>-800.webp   card retrato e ficha do prato
     assets/img/casa-700|1000.webp     retrato da seção "A casa"
     assets/img/icon-180.png           ícone de toque
     assets/img/og.jpg                 imagem de compartilhamento
     data/dims.json                    largura real de cada foto
     data/lqip.json                    placeholder de 20px, em base64
     data/casa-lqip.txt

   Nenhuma imagem é ampliada: o arquivo -800 de uma foto de 450px sai
   com 450px. Antes o -800 simplesmente não era gerado nesses casos e
   o card quebrava.

   Precisa de: npm i -D sharp
   ============================================================ */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = 'fonte/fotos';
const OUT = 'assets/img/dish';
const LARGURAS = [400, 800];
/* a melhor foto do acervo: usada na seção "A casa" e na imagem de
   compartilhamento. Se ela sair do cardápio, troque o hash. */
const DESTAQUE = 'd2091654f0fc10fad1799ae19ef827a1';

const kb = n => (n / 1024).toFixed(1) + ' KB';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const arquivos = fs.readdirSync(SRC).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  if (!arquivos.length) { console.error('nenhuma foto em', SRC); process.exit(1); }

  const dims = {}, lqip = {};
  let bytes = 0, reduzidas = 0;

  for (const f of arquivos) {
    const p = path.join(SRC, f);
    const base = path.basename(f, path.extname(f));
    const meta = await sharp(p).metadata();
    dims[base] = { w: meta.width, h: meta.height };

    for (const w of LARGURAS) {
      const alvo = Math.min(w, meta.width);      // nunca amplia
      if (alvo < w) reduzidas++;
      const destino = path.join(OUT, `${base}-${w}.webp`);
      await sharp(p)
        .resize({ width: alvo, height: Math.round(alvo * 0.75), fit: 'cover', position: 'centre' })
        .webp({ quality: 72, effort: 6 })
        .toFile(destino);
      bytes += fs.statSync(destino).size;
    }

    const ph = await sharp(p).resize(20, 15, { fit: 'cover' }).blur(1).webp({ quality: 30 }).toBuffer();
    lqip[base] = 'data:image/webp;base64,' + ph.toString('base64');
  }

  fs.writeFileSync('data/dims.json', JSON.stringify(dims));
  fs.writeFileSync('data/lqip.json', JSON.stringify(lqip));

  /* --- retrato da seção "A casa" --- */
  const destaque = path.join(SRC, DESTAQUE + '.jpeg');
  if (fs.existsSync(destaque)) {
    for (const w of [700, 1000]) {
      await sharp(destaque)
        .resize({ width: w, height: Math.round(w * 0.75), fit: 'cover', position: 'centre' })
        .webp({ quality: 76, effort: 6 })
        .toFile(`assets/img/casa-${w}.webp`);
    }
    const ph = await sharp(destaque).resize(20, 15, { fit: 'cover' }).blur(1).webp({ quality: 30 }).toBuffer();
    fs.writeFileSync('data/casa-lqip.txt', 'data:image/webp;base64,' + ph.toString('base64'));
  }

  /* --- ícone de toque, a partir do SVG da marca --- */
  await sharp(fs.readFileSync('assets/img/icon.svg'), { density: 600 })
    .resize(180, 180).png({ compressionLevel: 9 }).toFile('assets/img/icon-180.png');

  /* --- imagem de compartilhamento: a foto escurecida com a marca por cima --- */
  if (fs.existsSync(destaque)) {
    const fundo = await sharp(destaque).resize(1200, 630, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: .46, saturation: 1.1 }).toBuffer();
    const marca = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".55"/>
        <stop offset=".55" stop-color="#000" stop-opacity=".2"/>
        <stop offset="1" stop-color="#000" stop-opacity=".93"/></linearGradient></defs>
      <rect width="1200" height="630" fill="url(#g)"/>
      <circle cx="86" cy="500" r="17" fill="#D43932"/>
      <g stroke="#F5844C" stroke-width="5.5" stroke-linecap="round" fill="none">
        <path d="M65 521 107 483"/><path d="M65 511 107 521"/></g>
      <text x="118" y="493" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="800" fill="#F4F1EA" letter-spacing="1">JAPA MAKI</text>
      <text x="119" y="519" font-family="Georgia,serif" font-style="italic" font-size="21" fill="#E17342">Temakeria e Sushi Bar</text>
      <text x="64" y="590" font-family="Helvetica,Arial,sans-serif" font-size="17" font-weight="600" fill="#A8A29C" letter-spacing="3">ARENA MALL · PILARES · RIO DE JANEIRO</text>
      <text x="64" y="205" font-family="Georgia,serif" font-size="74" fill="#F4F1EA">Todo dia, às seis,</text>
      <text x="64" y="285" font-family="Georgia,serif" font-size="74" fill="#F4F1EA">a gente acende</text>
      <text x="64" y="365" font-family="Georgia,serif" font-size="74" fill="#F4F1EA">o <tspan font-style="italic" fill="#F5844C">balcão</tspan>.</text>
    </svg>`);
    await sharp(fundo).composite([{ input: marca }]).jpeg({ quality: 84, mozjpeg: true }).toFile('assets/img/og.jpg');
  }

  console.log('fotos processadas:', arquivos.length, '->', arquivos.length * 2, 'arquivos webp');
  console.log('peso em disco:    ', kb(bytes));
  console.log('sem ampliar:      ', reduzidas, 'variantes saíram no tamanho da fonte');
  console.log('og.jpg:           ', kb(fs.statSync('assets/img/og.jpg').size));
})();
