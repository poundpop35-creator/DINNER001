// Work on deep content one lesson per file, so writers and fact-checkers only load the lesson they own.
//   node scripts/deep-parts.mjs split POL1101          dist/deep/POL1101.{expand,lessons}.js → drafts/deep/POL1101/expand-1.js … lessons-11.js (existing parts are kept)
//   node scripts/deep-parts.mjs check <part file>…     validate part files (same rules as validate-content.mjs)
//   node scripts/deep-parts.mjs merge POL1101          drafts/deep/POL1101/*.js → dist/deep/POL1101.{expand,lessons}.js (only complete sets), then validate
// A part file is an ES module: export const lesson = {...}; expand-K.js adds depth to foundation lesson K (1–5), lessons-N.js is Part 2 lesson N (≥ 6).
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeChecker} from './content-rules.mjs';

const load = async file => (await import(pathToFileURL(resolve(file)).href + `?t=${process.hrtime.bigint()}`));
const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16)}`)}'`;
const flat = v => v === null || typeof v !== 'object';
const inline = v => Array.isArray(v) ? `[${v.map(inline).join(', ')}]` : flat(v) ? (typeof v === 'string' ? quote(v) : String(v)) : `{ ${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${k}: ${inline(x)}`).join(', ')} }`;
// One string per line keeps long Thai paragraphs easy to find and edit; small rows (cards, questions, refs, table rows) stay on one line.
function serialize(v, depth = 0) {
  const pad = '  '.repeat(depth), inner = '  '.repeat(depth + 1);
  if (flat(v)) return inline(v);
  if (Array.isArray(v)) {
    if (v.length && v.every(x => flat(x)) && inline(v).length <= 100) return inline(v);
    const one = x => flat(x) || (Array.isArray(x) && x.every(y => flat(y) || (Array.isArray(y) && y.every(flat)))) || (!Array.isArray(x) && Object.values(x).every(flat));
    return `[\n${v.map(x => inner + (one(x) ? inline(x) : serialize(x, depth + 1))).join(',\n')},\n${pad}]`;
  }
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return `{\n${entries.map(([k, x]) => `${inner}${k}: ${serialize(x, depth + 1)}`).join(',\n')},\n${pad}}`;
}

function checkPart(chk, file, lesson) {
  const m = basename(file).match(/^(expand|lessons)-(\d+)\.js$/);
  if (!m) return chk.err(file, 'part files are named expand-K.js or lessons-N.js');
  const [, kind, num] = m, n = Number(num), where = `${basename(resolve(file, '..'))}-${n} (${kind})`;
  if (kind === 'expand') { if (n < 1 || n > 5) chk.err(where, 'expand parts are numbered 1–5'); chk.expandLesson(lesson, where); }
  else chk.partLesson(lesson, where, {n, last: false});
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'split') {
  const code = rest[0], dir = `drafts/deep/${code}`;
  mkdirSync(dir, {recursive: true});
  let wrote = 0;
  const put = (name, lesson) => { const f = `${dir}/${name}.js`; if (existsSync(f)) return; writeFileSync(f, `// ${code} ${name} — one lesson of deep content; merge with: node scripts/deep-parts.mjs merge ${code}\nexport const lesson = ${serialize(lesson)};\n`); wrote++; };
  if (existsSync(`dist/deep/${code}.expand.js`)) { const {expand} = await load(`dist/deep/${code}.expand.js`); for (const k of Object.keys(expand)) put(`expand-${k}`, expand[k]); }
  if (existsSync(`dist/deep/${code}.lessons.js`)) { const {lessons} = await load(`dist/deep/${code}.lessons.js`); for (const l of lessons) put(`lessons-${l.n}`, l); }
  console.log(`${dir}: ${wrote} new part file(s)`);
} else if (cmd === 'check') {
  const chk = makeChecker();
  for (const file of rest) { try { checkPart(chk, file, (await load(file)).lesson); } catch (e) { chk.err(file, `cannot load: ${e.message.split('\n')[0]}`); } }
  for (const e of chk.errors) console.log('ERROR ' + e);
  console.log(chk.errors.length ? `${chk.errors.length} error(s)` : `OK (${rest.length} part file(s))`);
  process.exit(chk.errors.length ? 1 : 0);
} else if (cmd === 'merge') {
  const code = rest[0], dir = `drafts/deep/${code}`;
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /^(expand|lessons)-\d+\.js$/.test(f)) : [];
  const nums = kind => files.filter(f => f.startsWith(kind + '-')).map(f => Number(f.match(/\d+/)[0])).sort((a, b) => a - b);
  const ex = nums('expand'), ls = nums('lessons');
  if (ex.join() === '1,2,3,4,5') {
    const parts = {}; for (const k of ex) parts[k] = (await load(`${dir}/expand-${k}.js`)).lesson;
    writeFileSync(`dist/deep/${code}.expand.js`, `// Deep-dive additions for ${code} lessons 1–5. Original writing; sources listed per lesson in refs.\n// Merged by scripts/deep-parts.mjs — edit here, or split into drafts/deep/${code}/ to work lesson by lesson.\nexport const expand = ${serialize(parts)};\n`);
    console.log(`dist/deep/${code}.expand.js: lessons 1–5`);
  } else console.log(`expand not merged: parts ${ex.join(',') || 'none'} (needs 1–5)`);
  if (ls.length >= 4 && ls.every((n, i) => n === 6 + i)) {
    const list = []; for (const n of ls) list.push((await load(`${dir}/lessons-${n}.js`)).lesson);
    writeFileSync(`dist/deep/${code}.lessons.js`, `// New lessons for ${code} (Part 2). Original writing; sources listed per lesson in refs.\n// Merged by scripts/deep-parts.mjs — edit here, or split into drafts/deep/${code}/ to work lesson by lesson.\nexport const lessons = ${serialize(list)};\n`);
    console.log(`dist/deep/${code}.lessons.js: lessons ${ls[0]}–${ls[ls.length - 1]}`);
  } else console.log(`lessons not merged: parts ${ls.join(',') || 'none'} (needs 6, 7, … with at least 4)`);
} else {
  console.error('usage: node scripts/deep-parts.mjs split CODE | check FILE… | merge CODE');
  process.exit(2);
}
