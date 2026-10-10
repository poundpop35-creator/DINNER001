import test from 'node:test';
import assert from 'node:assert/strict';
import {courses,terms,categoryTargets} from '../dist/data.js';
import {lessons} from '../dist/lessons.js';
import {freshState,validateState,loadState,storeState,escapeHTML,thaiDate,today,addDays,courseProgress,nextLesson,exams,examClashes,planSummary,cardsForReview,reviewCard,quizItems,examICS,STORAGE_KEY} from '../dist/core.js';

test('enrolled courses and dates exactly match supplied registration screenshot',()=>{
 assert.deepEqual(courses.filter(c=>c.enrolled).map(c=>[c.id,c.credits,c.exam,c.slot]),[
 ['POL1101',3,'2027-03-12','B'],['POL2104',3,'2027-03-10','A'],['POL2106',3,'2027-03-19','A'],['POL2107',3,'2027-03-22','B'],['POL2200',3,'2027-03-13','B'],['POL2301',3,'2027-03-21','B'],['POL2303',3,'2027-03-15','B']]);
 assert.equal(courses.filter(c=>c.enrolled).reduce((n,c)=>n+c.credits,0),21);
 assert.deepEqual(examClashes(exams()),[]);
 assert.deepEqual(exams().map(c=>c.id),['POL2104','POL1101','POL2200','POL2303','POL2106','POL2301','POL2107']);
});
test('no future exam dates are inferred from this semester',()=>assert.ok(courses.filter(c=>!c.enrolled).every(c=>c.exam===null&&c.slot===null)));
test('plan has 28 distinct courses, 84 credits and matches all four categories',()=>{
 const s=planSummary(freshState());assert.equal(courses.length,28);assert.equal(new Set(courses.map(c=>c.id)).size,28);assert.deepEqual(s.planned,{core:18,required:24,elective:24,faculty:18});
 assert.deepEqual(s.termRows.map(t=>t.credits),[21,9,18,18,9,9,0]);assert.ok(s.termRows.every(t=>!t.over&&t.heavy<=2));
 assert.equal(courses.find(c=>c.id==='POL2104').category,'faculty');
});
test('all required courses and foundation order remain represented',()=>{
 assert.deepEqual(courses.filter(c=>c.category==='core').map(c=>c.id).sort(),['POL1101','POL2106','POL2107','POL2200','POL2300','POL4100']);
 assert.deepEqual(courses.filter(c=>c.category==='required').map(c=>c.id).sort(),['POL2108','POL2301','POL2302','POL2303','POL3300','POL3301','POL3302','POL3311']);
 assert.ok(courses.find(c=>c.id==='POL4100').term>courses.find(c=>c.id==='POL2300').term);
 assert.equal(courses.find(c=>c.id==='POL4329').title,'แรงงานศึกษา');
});
test('expected transfer and enrolled credits are never counted as completed',()=>{
 const s=planSummary(freshState());assert.equal(s.transfer,0);assert.equal(s.earned,0);assert.equal(s.remaining,126);assert.equal(s.gpa,null);
});
test('credit and GPA calculation respects F and excludes approved transfers',()=>{
 const v=freshState();v.transfer={general:30,free:12};v.grades={POL1101:'A',POL2104:'F',POL2106:'B'};const s=planSummary(v);
 assert.equal(s.earned,6);assert.equal(s.remaining,78);assert.equal(s.transfer,42);assert.equal(s.gpa,7/3);
});
test('moving future courses can flag an overloaded summer',()=>{
 const s=freshState();s.termMoves.POL4100=1;const p=planSummary(s);assert.equal(p.termRows[1].credits,12);assert.equal(p.termRows[1].over,true);
 assert.equal(p.termRows.flatMap(t=>t.courses).length,28);
});
test('same day same slot is a clash; same day another slot is not',()=>{
 assert.deepEqual(examClashes([{id:'A',exam:'2027-03-10',slot:'A'},{id:'B',exam:'2027-03-10',slot:'A'},{id:'C',exam:'2027-03-10',slot:'B'}]),[['A','B']]);
});
test('learning content has 35 unique lessons, 70 explainable questions and no placeholder lessons',()=>{
 assert.equal(lessons.length,35);assert.equal(new Set(lessons.map(l=>l.id)).size,35);
 for(const c of courses.filter(c=>c.enrolled)){const ls=lessons.filter(l=>l.course===c.id);assert.deepEqual(ls.map(l=>l.n),[1,2,3,4,5]);}
 for(const l of lessons){assert.equal(l.sections.length,3);assert.ok(l.sections.every(s=>s.body.length>=130));assert.ok(l.example.analysis.length>80);assert.equal(l.questions.length,2);assert.ok(l.cards.length>=2);
  for(const q of l.questions){assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<q.options.length);assert.ok(q.explanation.length>20);assert.equal(new Set(q.options).size,4);}
 }
 assert.equal(quizItems(freshState()).length,70);
});
test('progress and resume only count a course own lessons',()=>{
 const s=freshState();s.completed=['POL1101-1','POL1101-2','POL2104-1'];assert.deepEqual(courseProgress(s,'POL1101'),{done:2,total:5,percent:40});assert.equal(nextLesson(s,'POL1101').id,'POL1101-3');
});
test('quiz mistake filter only selects attempted wrong answers',()=>{
 const s=freshState();const [a,b]=quizItems(s);s.answers[a.id]=(a.answer+1)%4;s.answers[b.id]=b.answer;assert.deepEqual(quizItems(s,'',true).map(q=>q.id),[a.id]);
});
test('flashcards schedule 1, 3, 7 days and return forgotten cards tomorrow',()=>{
 const s=freshState();const id=cardsForReview(s)[0].id;const initial=cardsForReview(s).length;reviewCard(s,id,true,'2026-10-10');assert.deepEqual(s.reviews[id],{level:1,due:'2026-10-11'});assert.equal(cardsForReview(s,'','2026-10-10').length,initial-1);
 reviewCard(s,id,true,'2026-10-11');assert.deepEqual(s.reviews[id],{level:2,due:'2026-10-14'});reviewCard(s,id,true,'2026-10-14');assert.equal(s.reviews[id].due,'2026-10-21');reviewCard(s,id,false,'2026-10-21');assert.deepEqual(s.reviews[id],{level:0,due:'2026-10-22'});
});
test('backup roundtrip preserves Thai notes, grades, answers and review state',()=>{
 const s=freshState();s.notes['POL1101-1']='รัฐ ≠ รัฐบาล\nคำถาม: ทำไม?';s.completed=['POL1101-1'];s.answers['POL1101-1:0']=1;s.transfer.general=30;s.grades.POL1101='A';s.lastLesson='POL1101-1';reviewCard(s,'POL1101-1:0',true,'2026-10-10');
 const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};assert.equal(storeState(storage,s),true);assert.deepEqual(loadState(storage).state,s);
});
test('invalid backup cannot inject paths, HTML execution or arbitrary course records',()=>{
 const value=JSON.parse('{"version":1,"completed":["POL1101-1","POL1101-1","unknown"],"notes":{"__proto__":"x","POL1101-1":"<img src=x onerror=alert(1)>"},"termMoves":{"POL1101":3,"POL4100":99},"transfer":{"general":-1,"free":900},"answers":{"POL1101-1:0":999}}');
 const safe=validateState(value);assert.deepEqual(safe.completed,['POL1101-1']);assert.deepEqual(safe.termMoves,{});assert.deepEqual(safe.transfer,{general:0,free:0});assert.deepEqual(safe.answers,{});assert.equal(Object.prototype.polluted,undefined);
 assert.equal(escapeHTML(safe.notes['POL1101-1']),'&lt;img src=x onerror=alert(1)&gt;');assert.throws(()=>validateState({version:2}));assert.throws(()=>validateState(null));
});
test('corrupted storage is reported, not silently overwritten',()=>{
 let writes=0;const broken={getItem(){return '{oops'},setItem(){writes++}};const r=loadState(broken);assert.ok(r.error);assert.equal(writes,0);
 assert.equal(storeState({setItem(){throw Error('quota')}},freshState()),false);
});
test('Thai exam dates use Buddhist year; calendar contains no fabricated hours',()=>{
 assert.match(thaiDate('2027-03-10'),/2570/);assert.match(today(),/^\d{4}-\d{2}-\d{2}$/);assert.equal(addDays('2027-12-31',1),'2028-01-01');
 const ics=examICS();assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,7);assert.ok(ics.includes('DTSTART;VALUE=DATE:20270310'));assert.ok(ics.includes('DTEND;VALUE=DATE:20270311'));assert.ok(!ics.includes('DTSTART;TZID'));assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
