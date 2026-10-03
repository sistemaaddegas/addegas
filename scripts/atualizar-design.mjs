#!/usr/bin/env node
// Aplica uma nova versão do design (Addegas.dc.html) no index.html, mantendo o bloco addegas:head.
// Uso (na raiz do repositório): node scripts/atualizar-design.mjs "/caminho/Addegas.dc.html"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('Uso: node scripts/atualizar-design.mjs <caminho/Addegas.dc.html>'); process.exit(1); }

const MARK = /<!-- addegas:head:start -->[\s\S]*?<!-- addegas:head:end -->\n?/;
const bloco = readFileSync('index.html', 'utf8').match(MARK)?.[0];
if (!bloco) { console.error('Bloco addegas:head não encontrado no index.html atual.'); process.exit(1); }

let html = readFileSync(src, 'utf8').replace(MARK, '');
if (!html.includes('<x-dc>') || !html.includes('data-dc-script')) {
  console.error('Esse arquivo não parece ser o Addegas.dc.html do design.'); process.exit(1);
}
html = html.replace('<html>', () => '<html lang="pt-BR">');
if (!/<meta charset="utf-8">\n/i.test(html)) { console.error('Não achei <meta charset="utf-8"> no arquivo.'); process.exit(1); }
html = html.replace(/<meta charset="utf-8">\n/i, (m) => m + bloco);

const refs = [...new Set([...html.matchAll(/(?<![\w/])(?:assets|data)\/[\w.\-]+/g)].map((m) => m[0]))];
const faltando = refs.filter((r) => !existsSync(r));
writeFileSync('index.html', html);
console.log(`index.html atualizado (${refs.length} arquivos referenciados).`);
if (faltando.length) {
  console.error('ATENÇÃO: o design usa arquivos que não estão no repositório. Copie-os do projeto de design com o mesmo nome:\n  ' + faltando.join('\n  '));
  process.exit(2);
}
