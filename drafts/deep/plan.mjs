// Work list for the deep-content workflow, computed from what is on disk:
// a part still needs writing if drafts/deep/CODE/<kind>-<n>.js is missing; it needs checking until <kind>-<n>.checked exists.
// Usage: node drafts/deep/plan.mjs [CODE,CODE,…]   (prints the workflow args as JSON)
import {existsSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const ROOT = '/home/user/DINNER001', D = `${ROOT}/drafts/deep`;
const order = (process.argv[2] || 'POL1101,POL2104,POL2200,POL2303,POL2106,POL2301,POL2107').split(',');
const {lessons} = await import(pathToFileURL(`${ROOT}/dist/lessons.js`).href);
const planOf = code => [...readFileSync(`${D}/_briefs/${code}.md`, 'utf8').matchAll(/^(\d+)\. (.+?) — (.+)$/gm)].map(m => ({n: Number(m[1]), title: m[2], scope: m[3]}));
const items = [];
for (const code of order) {
  const base = lessons.filter(l => l.course === code && l.part === 1).map(l => ({n: l.n, title: l.title}));
  const plan = planOf(code);
  // Part 2 titles: use the written part when it exists (writers may refine titles), else the plan.
  const part2 = [];
  for (let n = 6; ; n++) {
    const f = `${D}/${code}/lessons-${n}.js`;
    if (existsSync(f)) part2.push({n, title: (await import(pathToFileURL(f).href)).lesson.title, scope: plan.find(p => p.n === n)?.scope || ''});
    else if (plan.find(p => p.n === n)) part2.push(plan.find(p => p.n === n));
    else break;
  }
  const map = [...base.map(l => `${l.n}. ${l.title} (ภาค 1 พื้นฐาน)`), ...part2.map(l => `${l.n}. ${l.title} (ภาค 2)`)].join('\n');
  const all = [...base.map(l => ({kind: 'expand', n: l.n, title: l.title})), ...part2.map(l => ({kind: 'lessons', n: l.n, title: l.title, scope: l.scope}))];
  all.forEach((l, i) => {
    const file = `${D}/${code}/${l.kind}-${l.n}.js`;
    const write = !existsSync(file), check = !existsSync(file.replace(/\.js$/, '.checked'));
    if (!write && !check) return;
    const next = all[i + 1] ? `บทที่ ${all[i + 1].n} ${all[i + 1].title}` : `แนวข้อสอบ ${code} (หน้าเตรียมสอบในแอป)`;
    const g = i % 4;
    items.push({code, kind: l.kind, n: l.n, title: l.title, scope: l.scope || '', file, marker: file.replace(/\.js$/, '.checked'), brief: `${D}/_briefs/${code}.md`, map, next, positions: [g, (g + 2) % 4, (g + 1) % 4, (g + 3) % 4], write, check});
  });
}
console.log(JSON.stringify({items}));
