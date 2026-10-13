import test from 'node:test';
import assert from 'node:assert/strict';
import {courses,terms,categoryTargets,studyPhases} from '../dist/data.js';
import {lessons} from '../dist/lessons.js';
import {prep} from '../dist/prep.js';
import {freshState,validateState,loadState,storeState,escapeHTML,thaiDate,today,addDays,courseProgress,nextLesson,exams,examClashes,planSummary,cardsForReview,reviewCard,quizItems,examICS,STORAGE_KEY,dailyPlan,phaseFor,hoursFor,hoursUntil,streak,weekdayIndex,prepResult} from '../dist/core.js';

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
test('learning content: unique lessons numbered 1..N per course, explainable questions, no placeholders',()=>{
 assert.ok(lessons.length>=35);assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
 for(const c of courses.filter(c=>c.enrolled)){const ls=lessons.filter(l=>l.course===c.id);assert.deepEqual(ls.map(l=>l.n),ls.map((_,i)=>i+1),c.id);assert.ok(ls.length>=5);assert.deepEqual(ls.slice(0,5).map(l=>l.part),[1,1,1,1,1]);assert.ok(ls.slice(5).every(l=>l.part===2));}
 for(const l of lessons){assert.ok(l.sections.length>=3,l.id);assert.ok(l.sections.every(s=>s.heading&&s.body.length>=130),l.id);assert.ok(l.example.analysis.length>80,l.id);assert.ok(l.questions.length>=2,l.id);assert.ok(l.cards.length>=2,l.id);assert.ok(l.minutes>=10,l.id);assert.ok(l.easy&&l.easy.points.length===3,l.id);
  for(const q of l.questions){assert.equal(q.options.length,4,l.id);assert.ok(q.answer>=0&&q.answer<q.options.length,l.id);assert.ok(q.explanation.length>20,l.id);assert.equal(new Set(q.options).size,4,l.id);}
  for(const r of l.refs)assert.ok(r.title&&r.detail&&(r.url===null||/^https?:\/\//.test(r.url)),l.id);
 }
 assert.equal(quizItems(freshState()).length,lessons.reduce((n,l)=>n+l.questions.length,0));
});
test('original lesson items keep their positions so saved answers and flashcard reviews stay valid',()=>{
 const first=lessons.find(l=>l.id==='POL1101-1');assert.equal(first.sections[0].heading,'รัฐคือกรอบที่ดำรงต่อเนื่อง');assert.equal(first.questions[0].prompt,'เปลี่ยนนายกรัฐมนตรีภายใต้กติกาเดิม ข้อใดสรุปได้แน่นอนที่สุด');assert.equal(first.cards[0].front,'รัฐ');
 for(const l of lessons.filter(l=>l.part===1)){assert.equal(l.sections.slice(0,3).filter(s=>s.deep).length,0,l.id);assert.ok(l.sections.slice(3).every(s=>s.deep),l.id);}
});
test('progress and resume only count a course own lessons',()=>{
 const s=freshState();s.completed=['POL1101-1','POL1101-2','POL2104-1'];const total=lessons.filter(l=>l.course==='POL1101').length;assert.deepEqual(courseProgress(s,'POL1101'),{done:2,total,percent:Math.round(200/total)});assert.equal(nextLesson(s,'POL1101').id,'POL1101-3');
});
test('quiz mistake filter only selects attempted wrong answers',()=>{
 const s=freshState();const [a,b]=quizItems(s);s.answers[a.id]=(a.answer+1)%4;s.answers[b.id]=b.answer;assert.deepEqual(quizItems(s,'',true).map(q=>q.id),[a.id]);
});
test('flashcards schedule 1, 3, 7 days and return forgotten cards tomorrow',()=>{
 const s=freshState();s.completed=['POL1101-1'];const id=cardsForReview(s)[0].id;const initial=cardsForReview(s).length;reviewCard(s,id,true,'2026-10-10');assert.deepEqual(s.reviews[id],{level:1,due:'2026-10-11'});assert.equal(cardsForReview(s,'','2026-10-10').length,initial-1);
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
test('every lesson has a plain-language layer whose textbook terms become extra flashcards',()=>{
 for(const l of lessons){const x=l.easy;assert.ok(x,l.id);assert.ok(x.one.length>40,l.id);assert.equal(x.points.length,3,l.id);assert.ok(x.points.every(p=>p.length>20),l.id);assert.ok(x.analogy.length>60,l.id);assert.ok(x.remember.length>10,l.id);assert.ok(x.terms.length>=3,l.id);
  const at=l.cards.findIndex(c=>c.front===x.terms[0][0]);assert.ok(at>=0,l.id);assert.deepEqual(l.cards.slice(at,at+x.terms.length),x.terms.map(([front,back])=>({front,back})),l.id);assert.ok(x.terms.every(([f,b])=>f.trim()&&b.length>8),l.id);}
 const text=JSON.stringify(lessons.map(l=>l.easy));for(const name of ['Leviathan','POSDCORB','POCCC','Hawthorne','Kirkpatrick','Duverger','Polyarchy','Wendt','Morgenthau','Merit system'])assert.ok(text.includes(name),name);
});
test('flashcards queue only for lessons already read unless every card is requested',()=>{
 const s=freshState();assert.equal(cardsForReview(s).length,0);assert.ok(cardsForReview(s,'',today(),true).length>150);
 s.completed=['POL2106-3'];const due=cardsForReview(s);assert.ok(due.length>=6);assert.ok(due.every(c=>c.lesson==='POL2106-3'));
 reviewCard(s,'POL2104-1:0',true,'2026-10-10');assert.ok(cardsForReview(s,'POL2104','2026-10-11').some(c=>c.id==='POL2104-1:0'));
});
test('daily plan fills exactly the chosen hours on every non-exam day of each phase',()=>{
 const s=freshState();
 for(let d='2026-10-11';d<='2027-03-22';d=addDays(d,1)){for(const h of [1,2,3,4]){s.todayHours={date:d,hours:h};const p=dailyPlan(s,d);const examDay=exams().some(c=>c.exam===d);
  if(examDay){assert.ok(p.blocks.some(b=>b.id==='examday'),d);assert.ok(p.minutes<=h*60,d);}else assert.equal(p.minutes,h*60,`${d} ${h}h`);
  assert.equal(new Set(p.blocks.map(b=>b.id)).size,p.blocks.length,d);assert.ok(p.blocks.every(b=>b.title&&b.detail&&!/undefined|null/.test(b.title+b.detail)),d);}}
 s.todayHours=null;assert.deepEqual(dailyPlan(s,'2027-03-23').blocks,[]);assert.equal(phaseFor('2027-03-23').id,'done');
});
test('plan follows the weekly rotation, then exam order, then the next exam',()=>{
 const s=freshState();
 assert.equal(phaseFor('2026-10-12').id,'learn');assert.equal(weekdayIndex('2026-10-12'),0);
 const mon=dailyPlan(s,'2026-10-12');assert.equal(mon.blocks.find(b=>b.id==='main').course,'POL2106');assert.equal(mon.blocks.find(b=>b.id==='main').href,'#lesson/POL2106-1');
 s.completed=['POL2106-1','POL2106-2','POL2106-3','POL2106-4','POL2106-5'];assert.equal(dailyPlan(s,'2026-10-12').blocks.find(b=>b.id==='main').href,'#course/POL2106');
 const order=exams().map(c=>c.id);for(let i=0;i<7;i++)assert.equal(dailyPlan(s,addDays('2027-02-01',i)).blocks.find(b=>b.id==='main').course,order[i]);
 assert.equal(dailyPlan(s,'2027-03-14').blocks.find(b=>b.id==='main').course,'POL2303');
 const examDay=dailyPlan(s,'2027-03-21');assert.ok(examDay.blocks.find(b=>b.id==='examday').title.includes('POL2301'));assert.equal(examDay.blocks.find(b=>b.id==='second').course,'POL2107');
 assert.equal(studyPhases.length,4);
});
test('study hours use weekday/weekend defaults with a same-day override',()=>{
 const s=freshState();assert.equal(hoursFor(s,'2026-10-12'),2);assert.equal(hoursFor(s,'2026-10-11'),4);
 s.todayHours={date:'2026-10-12',hours:1};assert.equal(hoursFor(s,'2026-10-12'),1);assert.equal(hoursFor(s,'2026-10-13'),2);
 assert.equal(hoursUntil(s,'2027-03-01','2027-03-08'),5*2+2*4);
});
test('hours, plan checkmarks and streak survive backup; bad values are dropped',()=>{
 const v=freshState();v.hours={weekday:3,weekend:4};v.todayHours={date:'2026-10-11',hours:1};v.planDone={'2026-10-10':['cards','main'],'2026-10-11':['wrap']};
 const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,x)=>memory.set(k,x)};storeState(storage,v);assert.deepEqual(loadState(storage).state,v);
 const bad=validateState({version:1,hours:{weekday:9,weekend:'4'},todayHours:{date:'x',hours:2},planDone:{'2026-10-11':['main','hack','main'],'__proto__':['main'],'nope':['cards']}});
 assert.deepEqual(bad.hours,{weekday:2,weekend:4});assert.equal(bad.todayHours,null);assert.deepEqual(bad.planDone,{'2026-10-11':['main']});
 assert.equal(streak(v,'2026-10-11'),2);assert.equal(streak(v,'2026-10-12'),2);assert.equal(streak(v,'2026-10-13'),0);
});
test('every enrolled course has an exam guide with balanced 5-choice practice questions',()=>{
 assert.deepEqual(Object.keys(prep).sort(),courses.filter(c=>c.enrolled).map(c=>c.id).sort());
 for(const [code,g] of Object.entries(prep)){
  for(const k of ['format','textbook'])assert.ok(g[k].length>15,code+k);for(const k of ['topics','seen','tips','links'])assert.ok(g[k].length>=1,code+k);
  assert.ok(g.links.every(([t,u])=>t&&/^https?:\/\//.test(u)),code);assert.ok(g.questions.length>=20,code);
  const spread=[0,1,2,3,4].map(i=>g.questions.filter(q=>q.answer===i).length);assert.ok(Math.max(...spread)<=Math.ceil(g.questions.length*0.32),`${code} ${spread}`);
  for(const q of g.questions){assert.equal(q.options.length,5,q.prompt);assert.equal(new Set(q.options).size,5,q.prompt);assert.ok(q.answer>=0&&q.answer<5);assert.ok(q.explanation.length>10,q.prompt);
   assert.ok(q.options.slice(0,4).every(o=>o!=='ถูกทุกข้อ'&&o!=='ไม่มีข้อใดถูก'),q.prompt);if(q.lesson)assert.ok(lessons.some(l=>l.id===q.lesson),q.lesson);}
 }
});
test('practice scores survive backup and invalid practice data is dropped',()=>{
 const s=freshState();const q=prep.POL2301.questions;s.prep.POL2301={answers:{0:q[0].answer,1:(q[1].answer+1)%5},submitted:true,best:1,last:1};
 const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,x)=>memory.set(k,x)};storeState(storage,s);const back=loadState(storage).state;
 assert.deepEqual(back.prep.POL2301,{answers:{'0':q[0].answer,'1':(q[1].answer+1)%5},submitted:true,best:1,last:1});
 assert.deepEqual(prepResult(back,'POL2301').correct,1);assert.equal(prepResult(back,'POL2301').answered,2);
 const bad=validateState({version:1,prep:{POL9999:{answers:{0:1}},POL1101:{answers:{0:9,'x':1,999:0,'2':3},submitted:'yes',best:500},['__proto__']:{answers:{}}}});
 assert.deepEqual(Object.keys(bad.prep),['POL1101']);assert.deepEqual(bad.prep.POL1101,{answers:{'2':3},submitted:false,best:null,last:null});
});
test('review and exam phases send four-hour days to the practice exam',()=>{
 const s=freshState();s.todayHours={date:'2027-02-03',hours:4};const extra=dailyPlan(s,'2027-02-03').blocks.find(b=>b.id==='extra');assert.equal(extra.href,`#prep/${extra.course}`);
 s.todayHours={date:'2027-03-14',hours:4};assert.equal(dailyPlan(s,'2027-03-14').blocks.find(b=>b.id==='extra').href,'#prep/POL2303');
});
