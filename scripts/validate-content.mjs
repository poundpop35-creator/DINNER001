// Validate deep lesson content for one course: node scripts/validate-content.mjs POL1101
// Checks dist/deep/<CODE>.expand.js (extra depth for lessons 1–5) and dist/deep/<CODE>.lessons.js (new lessons 6+).
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const code = process.argv[2];
if (!/^POL\d{4}$/.test(code || '')) { console.error('usage: node scripts/validate-content.mjs POL1101'); process.exit(2); }
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const str = (v, min, where, name) => { if (typeof v !== 'string' || v.trim().length < min) err(where, `${name} must be text of at least ${min} characters (got ${typeof v === 'string' ? v.trim().length : typeof v})`); else if (/[<>]/.test(v)) err(where, `${name} must not contain < or > (HTML is not rendered)`); else if (/undefined|null|TODO|lorem/i.test(v)) err(where, `${name} contains a placeholder word`); };
const arr = (v, min, max, where, name) => { if (!Array.isArray(v) || v.length < min || v.length > max) { err(where, `${name} must be an array with ${min}–${max} items (got ${Array.isArray(v) ? v.length : typeof v})`); return false; } return true; };

function section(s, where) {
  if (!s || typeof s !== 'object') return err(where, 'section must be an object');
  str(s.heading, 4, where, 'heading'); str(s.body, 350, where, 'body');
  if (s.list !== undefined && arr(s.list, 2, 12, where, 'list')) s.list.forEach((x, i) => str(x, 8, `${where} list[${i}]`, 'item'));
  if (s.table !== undefined) {
    const t = s.table;
    if (!t || !arr(t.head, 2, 6, where, 'table.head') || !arr(t.rows, 2, 14, where, 'table.rows')) return;
    t.head.forEach((h, i) => str(h, 1, `${where} table.head[${i}]`, 'header'));
    t.rows.forEach((r, i) => { if (!Array.isArray(r) || r.length !== t.head.length) err(where, `table.rows[${i}] must have ${t.head.length} cells`); else r.forEach((c, j) => str(c, 1, `${where} table[${i}][${j}]`, 'cell')); });
  }
  const extra = Object.keys(s).filter(k => !['heading', 'body', 'list', 'table'].includes(k)); if (extra.length) err(where, `unknown section keys: ${extra.join(', ')}`);
}
function cards(v, min, where) { if (arr(v, min, 12, where, 'cards')) v.forEach((c, i) => { if (!Array.isArray(c) || c.length !== 2) err(where, `cards[${i}] must be [front, back]`); else { str(c[0], 2, `${where} cards[${i}]`, 'front'); str(c[1], 8, `${where} cards[${i}]`, 'back'); } }); }
function questions(v, min, where) {
  if (!arr(v, min, 8, where, 'questions')) return;
  v.forEach((q, i) => {
    const w = `${where} q${i + 1}`;
    if (!Array.isArray(q) || q.length !== 4) return err(w, 'question must be [prompt, [4 options], answerIndex, explanation]');
    const [p, o, a, x] = q; str(p, 15, w, 'prompt'); str(x, 30, w, 'explanation');
    if (!Array.isArray(o) || o.length !== 4 || new Set(o).size !== 4) err(w, 'needs exactly 4 different options'); else o.forEach((t, j) => str(t, 1, `${w} option${j + 1}`, 'option'));
    if (!Number.isInteger(a) || a < 0 || a > 3) err(w, 'answer must be 0–3');
  });
}
function refs(v, min, where) {
  if (!arr(v, min, 10, where, 'refs')) return;
  v.forEach((r, i) => {
    const w = `${where} ref${i + 1}`;
    if (!r || typeof r !== 'object') return err(w, 'ref must be {title, detail, url?}');
    str(r.title, 5, w, 'title'); str(r.detail, 10, w, 'detail');
    if (r.url !== undefined && (typeof r.url !== 'string' || !/^https?:\/\/[^\s"'<>]+$/.test(r.url))) err(w, 'url must be a plain http(s) URL or omitted');
    const extra = Object.keys(r).filter(k => !['title', 'detail', 'url'].includes(k)); if (extra.length) err(w, `unknown ref keys: ${extra.join(', ')}`);
  });
}

const expandPath = resolve(`dist/deep/${code}.expand.js`), lessonsPath = resolve(`dist/deep/${code}.lessons.js`);
const allQuestions = [];
if (existsSync(expandPath)) {
  const {expand} = await import(pathToFileURL(expandPath).href + `?t=${process.hrtime.bigint()}`);
  if (!expand || typeof expand !== 'object') err('expand', 'file must export const expand = {1:{...},...,5:{...}}');
  else for (const n of [1, 2, 3, 4, 5]) {
    const x = expand[n], w = `${code}-${n} (expand)`;
    if (!x) { err(w, 'missing'); continue; }
    str(x.hook, 80, w, 'hook'); str(x.teaser, 30, w, 'teaser');
    if (arr(x.sections, 3, 6, w, 'sections')) x.sections.forEach((s, i) => section(s, `${w} section${i + 1}`));
    cards(x.cards, 2, w); questions(x.questions, 1, w); refs(x.refs, 2, w);
    (x.questions || []).forEach(q => allQuestions.push(q));
    const extra = Object.keys(x).filter(k => !['hook', 'sections', 'cards', 'questions', 'refs', 'teaser'].includes(k)); if (extra.length) err(w, `unknown keys: ${extra.join(', ')}`);
  }
} else warn('expand', `${expandPath} not found yet`);

if (existsSync(lessonsPath)) {
  const {lessons} = await import(pathToFileURL(lessonsPath).href + `?t=${process.hrtime.bigint()}`);
  if (!Array.isArray(lessons) || lessons.length < 4) err('lessons', 'file must export const lessons = [ {n:6,...}, ... ] with at least 4 lessons');
  else lessons.forEach((l, i) => {
    const w = `${code}-${l?.n ?? '?'}`;
    if (l.n !== 6 + i) err(w, `n must be ${6 + i} (lessons numbered from 6 in order)`);
    str(l.title, 6, w, 'title'); str(l.intro, 60, w, 'intro'); str(l.hook, 80, w, 'hook'); str(l.trap, 40, w, 'trap');
    if (i < lessons.length - 1) str(l.teaser, 30, w, 'teaser'); else if (l.teaser !== undefined) str(l.teaser, 30, w, 'teaser');
    if (arr(l.sections, 5, 9, w, 'sections')) l.sections.forEach((s, j) => section(s, `${w} section${j + 1}`));
    if (!l.example) err(w, 'example missing'); else { str(l.example.situation, 60, w, 'example.situation'); str(l.example.analysis, 80, w, 'example.analysis'); }
    const e = l.easy;
    if (!e) err(w, 'easy missing'); else {
      str(e.one, 40, w, 'easy.one'); str(e.analogy, 60, w, 'easy.analogy'); str(e.remember, 10, w, 'easy.remember');
      if (arr(e.points, 3, 3, w, 'easy.points')) e.points.forEach((p, j) => str(p, 20, `${w} easy.points[${j}]`, 'point'));
      cards(e.terms, 3, `${w} easy.terms`);
    }
    cards(l.cards, 2, w); questions(l.questions, 3, w); refs(l.refs, 3, w);
    (l.questions || []).forEach(q => allQuestions.push(q));
    const extra = Object.keys(l).filter(k => !['n', 'title', 'intro', 'hook', 'sections', 'example', 'trap', 'easy', 'cards', 'questions', 'refs', 'teaser'].includes(k)); if (extra.length) err(w, `unknown keys: ${extra.join(', ')}`);
  });
} else warn('lessons', `${lessonsPath} not found yet`);

if (allQuestions.length >= 8) {
  const spread = [0, 1, 2, 3].map(i => allQuestions.filter(q => q[2] === i).length);
  if (Math.max(...spread) > allQuestions.length * 0.4) err('answers', `correct answers bunch on one position (${spread.join('/')}); vary the position of the right option`);
}
for (const w of warnings) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(errors.length ? `${code}: ${errors.length} error(s)` : `${code}: OK`);
process.exit(errors.length ? 1 : 0);
