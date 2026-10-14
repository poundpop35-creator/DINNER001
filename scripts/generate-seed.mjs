// Reproducible, escaped content seed. No network, credentials or database writes.
import {readFile,writeFile} from 'node:fs/promises';
import {validateCatalog} from '../dist/content-client.js';
const c=validateCatalog(JSON.parse(await readFile(new URL('../dist/content.snapshot.json',import.meta.url),'utf8')));
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const statements=['-- Generated from content.snapshot.json. Apply only to the new RU Study Planner project.','begin;'];
function seed(table,rows,keys){
 const cols=Object.keys(rows[0]);const update=cols.filter(k=>!keys.includes(k)).map(k=>`${k}=excluded.${k}`).join(',');
 statements.push(`insert into public.${table} (${cols.join(',')}) select ${cols.join(',')} from jsonb_populate_recordset(null::public.${table},${literal(rows)}) on conflict (${keys.join(',')}) do update set ${update};`);
}
seed('ru_study_terms',c.terms,['id']);
seed('ru_study_courses',c.courses.map((v,position)=>({...v,position})),['id']);
seed('ru_study_lessons',c.lessons.map(({id,course,n,title,...content})=>({id,course,n,title,content})),['id']);
seed('ru_study_exam_guides',Object.entries(c.prep).map(([course,content])=>({course,content})),['course']);
seed('ru_study_class_schedules',c.schedules.map(({startTime,endTime,...v})=>({...v,start_time:startTime,end_time:endTime})),['id']);
seed('ru_study_settings',[{key:'config',value:c.config},{key:'counts',value:c.counts},{key:'updated',value:c.updated}],['key']);
statements.push('commit;','');
await writeFile(new URL('../database/seed.sql',import.meta.url),statements.join('\n'));
console.log(`Prepared ${c.courses.length} courses, ${c.lessons.length} lessons, ${Object.values(c.prep).reduce((n,g)=>n+g.questions.length,0)} practice questions and ${c.schedules.length} schedules.`);
