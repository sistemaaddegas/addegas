#!/usr/bin/env node
// Aplica uma nova versão do design no arquivo publicado, mantendo o bloco addegas:head.
// Uso (na raiz do repositório):
//   node scripts/atualizar-design.mjs "/caminho/Addegas.dc.html"                     -> index.html (sistema da adega)
//   node scripts/atualizar-design.mjs "/caminho/Addegas Admin.dc.html" admin.html    -> admin.html (painel da equipe, em /admin)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const src = process.argv[2];
const destino = process.argv[3] || 'index.html';
if (!src) { console.error('Uso: node scripts/atualizar-design.mjs <caminho/arquivo.dc.html> [index.html|admin.html]'); process.exit(1); }
if (!existsSync(destino)) { console.error(`${destino} não existe na raiz do repositório.`); process.exit(1); }

const MARK = /<!-- addegas:head:start -->[\s\S]*?<!-- addegas:head:end -->\n?/;
const bloco = readFileSync(destino, 'utf8').match(MARK)?.[0];
if (!bloco) { console.error(`Bloco addegas:head não encontrado no ${destino} atual.`); process.exit(1); }

let html = readFileSync(src, 'utf8').replace(MARK, '');
if (!html.includes('<x-dc>') || !html.includes('data-dc-script')) {
  console.error('Esse arquivo não parece ser um .dc.html do design.'); process.exit(1);
}
html = html.replace('<html>', () => '<html lang="pt-BR">');
if (!/<meta charset="utf-8">\n/i.test(html)) { console.error('Não achei <meta charset="utf-8"> no arquivo.'); process.exit(1); }
html = html.replace(/<meta charset="utf-8">\n/i, (m) => m + bloco);

const refs = [...new Set([...html.matchAll(/(?<![\w/])(?:assets|data)\/[\w.\-/]+\.\w+/g)].map((m) => m[0]))];
const faltando = refs.filter((r) => !existsSync(r));
writeFileSync(destino, html);
console.log(`${destino} atualizado (${refs.length} arquivos referenciados).`);
if (faltando.length) {
  console.error('ATENÇÃO: o design usa arquivos que não estão no repositório. Copie-os do projeto de design com o mesmo nome:\n  ' + faltando.join('\n  '));
  process.exit(2);
}
