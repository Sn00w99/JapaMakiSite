/* pipeline de build: da resposta da API ao index.html */
const { execSync } = require('child_process');
const steps = ['build/data.cjs', 'build/enrich.cjs', 'build/nomes.cjs', 'build/render.cjs', 'build/minify.cjs'];
for (const s of steps) {
  process.stdout.write(`\n▸ ${s}\n`);
  execSync(`node ${s}`, { stdio: 'inherit' });
}
