# Japa Maki — Temakeria e Sushi Bar

Site do Japa Maki (Arena Mall, Pilares — Rio de Janeiro), recriado a
partir do cardápio digital da casa. HTML, CSS e JavaScript puros: sem
framework, sem build no servidor, sem runtime. O `index.html` é um
arquivo estático que sobe em qualquer hospedagem.

```sh
npm install     # só para os scripts de build
npm run dev     # sobe em http://127.0.0.1:4173
npm run build   # regera o index.html
```

---

## Placar de auditoria

Lighthouse 13, mediana de três execuções, servido com gzip.

| | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|
| **Desktop** | **100** | **100** | **100** | **100** |
| **Celular** | **94** | **100** | **100** | **100** |

Core Web Vitals no celular (rede 1,6 Mbps, CPU 4× mais lenta):
**LCP 2,86 s · CLS 0,000 · TBT 134 ms**.
No desktop: LCP 0,57 s · TBT 2 ms.

`axe-core` com as regras WCAG 2.0/2.1/2.2 A e AA: **nenhuma violação**.

### Sobre o 94 no celular

O número é limitado pelo LCP, e o LCP do relatório é uma **simulação**,
não uma medição. O `PerformanceObserver` no mesmo cenário de rede e CPU
registra o LCP real em **1,09 s** — o Lighthouse extrapola 2,86 s a
partir do seu modelo.

Foi verificado se valia reduzir o documento: com o cardápio cortado de
23 para 3 seções, o HTML caiu de 283 KB para 107 KB e o LCP simulado
**não se moveu** (2,86 s), com ganho de 1 ponto. Ou seja, servir menos
cardápio não compra performance — só custaria SEO e a versão sem
JavaScript. Por isso os 231 pratos continuam no documento.

---

## Decisões de projeto

### A paleta saiu da logo, por amostragem

A logo original tem 150×150 px. As cores foram medidas pixel a pixel,
não estimadas a olho:

| token | cor | de onde vem |
|---|---|---|
| `--sumi` | `#000000` | 85,3% da arte da logo |
| `--hinomaru` | `#D43932` | média dos 898 pixels do disco vermelho |
| `--hashi` | `#E17342` | os palitos cruzados e a assinatura manuscrita |
| `--washi` | `#F4F1EA` | o wordmark |

O `primary_color` cadastrado no sistema da casa é literalmente
`#000000` — a marca nunca havia sido explorada.

Todo par de cor foi medido contra WCAG AA antes de entrar
(`npm run contraste`). Três decisões saíram dessa medição:

- o vermelho da marca dá 4,20:1 sobre o card e **não passa** em texto
  pequeno, então ele é usado como elemento gráfico, e `--hinomaru-text`
  (`#F04A3D`, 5,19:1) cobre os casos de texto;
- o botão vermelho usa **branco puro**, não o washi: assim o vermelho
  da marca fica intacto e o contraste sobe de 4,20 para 4,74:1;
- o piso de texto legível é `--ink-3` (`#8C867F`), que dá 5,26:1 sobre
  o card. Nada mais claro que isso carrega texto.

### 68% do cardápio não tem foto — e isso virou o sistema

Das 231 receitas, só 74 têm fotografia, com qualidade irregular: sete
em 700 px, 42 em 450–700 px e 25 abaixo de 450 px. Seções inteiras
(Pokés, Robatas, Harumakis Doces, Sobremesas) não têm nenhuma.

Em vez de buracos no mosaico, a ausência virou peça de composição: o
prato sem foto ganha um card tipográfico com o kanji da seção em marca
d'água, o disco da marca no canto e o nome em corpo grande. Os dois
tipos pesam igual no grid.

O kanji recebe rotação, escala e opacidade variando por posição
(`kanjiStyle` em `build/render.cjs`) — o mesmo caractere repetido na
mesma escala vira papel de parede.

### Bebidas tem layout próprio

São 41 itens sem nenhuma foto. Quarenta e um cards grandes com o mesmo
kanji atrás seriam ruído, então essa seção vira lista densa de duas a
quatro colunas — que é como uma carta de bebidas se lê de verdade. A
regra está em `render.cjs`: 20 itens ou mais e nenhuma foto.

Seis bebidas têm preço `0` no sistema porque o valor vem da opção
escolhida. Elas mostram **"Ver opções"**, não "R$ 0,00".

### O mosaico é empacotado no build, não pelo navegador

O grid tem 12 colunas. Em vez de largar spans soltos e pedir
`grid-auto-flow: dense` para fechar os vãos, `pack()` resolve o layout
em tempo de build: cada linha soma exatamente 12 e o span mais largo de
cada linha vai para o item com a melhor foto — sem nunca reordenar o
cardápio.

### O cardápio inteiro está no HTML

231 pratos, nada renderizado por JavaScript. Com o JS desligado, os 244
cards continuam visíveis e legíveis, com preço, descrição e link de
pedido. Só o selo "aberto agora" degrada, para "Horários".

Para o navegador não calcular o layout de tudo de uma vez, cada seção
usa `content-visibility: auto`. Isso exige dizer que altura reservar, e
uma estimativa única não serve: as seções vão de 272 px a 2476 px.
`npm run alturas` mede a altura real de cada uma em três larguras e
grava `data/heights.json`, que o render injeta como `--h-sm/md/lg`.

Esse detalhe não é cosmético. Com a estimativa errada, o navegador
posiciona conteúdo em coordenadas inválidas e o auditor de
acessibilidade passa a medir alvos de toque errado — era a origem de
três falhas de `target-size` em botões que têm 377×52 px. Com as
alturas medidas, o `axe` fica limpo **e** a performance sobe de 89 para
94.

### Nomes de prato: ortografia corrigida, conteúdo intacto

O cardápio vem do PDV da casa, onde os nomes foram digitados sem acento
e com caixa inconsistente: `salmao`, `filadelfia`, `MEIO HOT
FILADELFIA`, `Maki roll- kani`.

`build/nomes.cjs` corrige **só ortografia e caixa** — 144 nomes, dos
quais 65 tinham erro de letra. Nenhuma palavra foi adicionada, removida
ou trocada por sinônimo, e nenhum preço foi tocado. Cada alteração fica
registrada em **`data/renames.json`** para auditoria.

Uma exceção que o script respeita: `Arroz à Japa Maki` mantém o acento
do `à`, porque a lista de palavras minúsculas devolve a palavra
original, não a versão sem acento.

---

## Movimento

Regras que valem para todo o `assets/js/app.js`:

- só `transform`, `opacity` e `clip-path` são animados;
- as curvas são fortes, não as embutidas do CSS —
  `--ease-out: cubic-bezier(.23,1,.32,1)`;
- transições de interface ficam abaixo de 300 ms; a saída é mais rápida
  que a entrada (ficha: entra em 300 ms, sai em 200 ms);
- nada de `scale(0)`: as entradas partem de `scale(.94–.97)`;
- `prefers-reduced-motion` remove deslocamento e escala, mas **mantém**
  as transições de opacidade e cor, que ajudam a entender a mudança de
  estado;
- todo `:hover` com movimento está atrás de
  `@media (hover: hover) and (pointer: fine)`.

**O que se move**

| onde | como |
|---|---|
| headline | as três linhas sobem por dentro de uma máscara, 90 ms entre elas |
| disco hinomaru | parallax no scroll, escrito direto no `transform` do elemento |
| revelação | `clip-path` + deslocamento, escalonado 45 ms por item com teto de 6 |
| filtro e busca | FLIP com a Web Animations API — mede, muda o DOM, mede, anima a diferença |
| ficha do prato | cresce a partir do retângulo do card clicado, e volta pra ele se ainda estiver na tela |
| hover dos cards | mola integrada quadro a quadro, com dois ouvintes delegados para os 244 cards |

**Duas salvaguardas que existem por precaução:**

O estado inicial de `[data-rv]` é `opacity: 0`. Se o
`IntersectionObserver` não disparar, o conteúdo ficaria invisível para
sempre — o pior modo de falha possível. Um prazo de 2,5 s revela
qualquer bloco que tenha ficado para trás. E o estado inicial só é
aplicado sob `html.js`, então sem JavaScript tudo nasce visível.

Ao filtrar, a página encurta muito e o scroll podia ficar além do
conteúdo, mostrando preto. O filtro devolve o usuário ao começo dos
resultados. A trilha de chips é centralizada mexendo no `scrollLeft`
dela, não com `scrollIntoView` — que mexeria no scroll da janela e
cancelaria esse retorno.

---

## Estrutura

```
index.html              gerado — 283 KB (37 KB com gzip)
assets/
  css/app.css           fonte do CSS (o build embute minificado no <head>)
  js/app.js             fonte do JS
  js/app.min.js         gerado — 9,7 KB (4,0 KB com gzip)
  fonts/                Instrument Serif + Inter, subconjunto latino, 89 KB
  img/dish/             148 webp (dois tamanhos por foto)
build/
  all.cjs               roda o pipeline inteiro
  data.cjs              resposta da API -> data/menu.json, com a curadoria
  enrich.cjs            kanji, títulos curtos, faixa de preço, qualidade da foto
  nomes.cjs             ortografia e caixa dos nomes de prato
  render.cjs            monta o index.html e o JSON-LD
  minify.cjs            minifica e embute o CSS
  imagens.cjs           fotos -> webp, placeholders, ícone, og:image
  medir-alturas.cjs     alturas reais por seção, para o content-visibility
  contrast.cjs          confere a paleta contra WCAG AA
  serve.cjs             servidor local com gzip, como em produção
data/
  menu.json             cardápio tratado, 231 pratos em 23 seções
  renames.json          toda correção de nome, para auditoria
  heights.json          alturas medidas em 412 / 900 / 1440 px
fonte/                  respostas cruas da API e fotos originais
```

## Curadoria do cardápio

Das 28 categorias e 313 itens do sistema, o site mostra **23 categorias
e 231 pratos**. Ficaram de fora cinco categorias que são mecânica
interna do PDV, não comida:

`Acréscimos` (13 itens como "Acréscimo R$ 1,00") · `Complementos` (24) ·
`Marcação Obrigatória — Molhos, Utensílios e Complementos` (1) ·
`Diversos` (1) · `Ifood` (43, duplicata do cardápio para outro canal).

Nenhum preço, descrição ou nome de prato foi alterado além da
ortografia descrita acima.

## Onde o botão "Pedir" leva

Todo caminho de pedido aponta para `japamaki.saipos.com/home`, que abre
em aba nova. Carrinho, endereço, cupom, cálculo de taxa e pagamento
continuam no sistema da casa — este site é a vitrine.

## Pendência

A seção **"A casa"** foi escrita apenas com o que os dados provam:
bairro, horário, tamanho do cardápio, faixa de preço e pratos que
existem de fato. Nenhuma data de fundação, nome de chef ou história foi
inventada. O trecho está marcado com um comentário em
`build/render.cjs` para ser trocado por algo real.
