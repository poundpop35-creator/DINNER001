// Validate deep lesson content for one course: node scripts/validate-content.mjs POL1101
// Checks dist/deep/<CODE>.expand.js (extra depth for lessons 1–5) and dist/deep/<CODE>.lessons.js (new lessons 6+).
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeChecker} from './content-rules.mjs';

const code = process.argv[2];
if (!/^POL\d{4}$/.test(code || '')) { console.error('usage: node scripts/validate-content.mjs POL1101'); process.exit(2); }
const {errors, warnings, err, warn, expandLesson, partLesson, answerSpread} = makeChecker();

const expandPath = resolve(`dist/deep/${code}.expand.js`), lessonsPath = resolve(`dist/deep/${code}.lessons.js`);
const allQuestions = [];
if (existsSync(expandPath)) {
  const {expand} = await import(pathToFileURL(expandPath).href + `?t=${process.hrtime.bigint()}`);
  if (!expand || typeof expand !== 'object') err('expand', 'file must export const expand = {1:{...},...,5:{...}}');
  else for (const n of [1, 2, 3, 4, 5]) {
    expandLesson(expand[n], `${code}-${n} (expand)`);
    (expand[n]?.questions || []).forEach(q => allQuestions.push(q));
  }
} else warn('expand', `${expandPath} not found yet`);

if (existsSync(lessonsPath)) {
  const {lessons} = await import(pathToFileURL(lessonsPath).href + `?t=${process.hrtime.bigint()}`);
  if (!Array.isArray(lessons) || lessons.length < 4) err('lessons', 'file must export const lessons = [ {n:6,...}, ... ] with at least 4 lessons');
  else lessons.forEach((l, i) => {
    partLesson(l, `${code}-${l?.n ?? '?'}`, {n: 6 + i, last: i === lessons.length - 1});
    (l?.questions || []).forEach(q => allQuestions.push(q));
  });
} else warn('lessons', `${lessonsPath} not found yet`);

answerSpread(allQuestions);
for (const w of warnings) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(errors.length ? `${code}: ${errors.length} error(s)` : `${code}: OK`);
process.exit(errors.length ? 1 : 0);
