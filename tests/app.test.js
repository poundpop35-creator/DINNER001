// Render/event integration against a minimal host. Not a layout or browser E2E test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons} from '../dist/lessons.js';
import {prep} from '../dist/prep.js';
import {STORAGE_KEY,escapeHTML,today} from '../dist/core.js';

const memory=new Map(),elements=new Map(),listeners={};
const element=()=>({innerHTML:'',textContent:'',value:'',hidden:false,files:[],classList:{add(){},remove(){},contains(){return false}},focus(){},scrollIntoView(){},append(){},remove(){},click(){}});
function get(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}
globalThis.document={querySelector:get,getElementById:id=>get('#'+id),addEventListener:(type,fn)=>listeners[type]=fn,body:element(),documentElement:{dataset:{}},createElement:element,title:''};
globalThis.location={hash:'#home'};
globalThis.window={localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},scrollY:0,scrollTo(){},addEventListener:(type,fn)=>listeners[type]=fn};
globalThis.confirm=()=>true;
await import('../dist/app.js');
const html=()=>get('#main').innerHTML;
const navigate=hash=>{location.hash=hash;listeners.hashchange();};
const click=(action,data={})=>listeners.click({target:{closest:()=>({dataset:{action,...data}})}});
const saved=()=>JSON.parse(memory.get(STORAGE_KEY));

test('every main route and all 35 lesson pages render without runtime errors',()=>{
 for(const route of ['home','courses','review','plan','calendar','exams','resources','notes','about','settings']){navigate('#'+route);assert.ok(html().length>500,route);assert.ok(!html().includes('[object Object]'),route);assert.ok(!html().includes('undefined'),route);}
 for(const l of lessons){navigate('#lesson/'+l.id);assert.ok(html().includes(l.title),l.id);assert.ok(html().includes(l.example.analysis),l.id);assert.equal((html().match(/class="question-block"/g)||[]).length,2,l.id);}
 navigate('#lesson/missing');assert.ok(html().includes('ไม่พบหน้าที่เลือก'));
});

test('calendar filters, selected-day details, references and resource links work together',()=>{
 navigate('#calendar');assert.ok(html().includes('มีเวลาเรียนชนกัน 1 คู่'));assert.ok(html().includes('mr30-2-2569-p142-143.pdf'));
 click('cal-jump',{month:'2026-11'});click('cal-day',{date:'2026-11-18'});assert.ok(html().includes('KLB 501'));assert.ok(html().includes('VPB 501'));
 click('cal-filter',{type:'exam'});click('cal-view',{view:'list'});assert.equal((html().match(/calendar-event exam-event/g)||[]).length,7);
 listeners.change({target:{id:'calendar-course',value:'POL2104'}});assert.equal((html().match(/calendar-event exam-event/g)||[]).length,1);assert.ok(html().includes('คาบ A'));assert.ok(html().includes('10 มี.ค. 2570'));
 navigate('#resources');assert.ok(html().includes('https://ondemand.ru.ac.th/'));assert.ok(html().includes('https://bookstore.ru.ac.th/'));assert.equal((html().match(/class="panel desk-course"/g)||[]).length,7);
 navigate('#course/POL1101');assert.ok(html().includes('11:10–13:40'));assert.ok(html().includes('https://bookstore.ru.ac.th/'));
});
test('notes save immediately and render as text, never executable user HTML',()=>{
 navigate('#lesson/POL1101-1');listeners.input({target:{id:'lesson-note',dataset:{lesson:'POL1101-1'},value:'<script>unsafe()</script>\nรัฐกับรัฐบาลต่างกัน'}});
 assert.equal(saved().notes['POL1101-1'],'<script>unsafe()</script>\nรัฐกับรัฐบาลต่างกัน');
 navigate('#notes');assert.ok(html().includes('&lt;script&gt;unsafe()&lt;/script&gt;'));assert.ok(!html().includes('<script>unsafe()'));
 navigate('#lesson/POL1101-1');assert.ok(html().includes('รัฐกับรัฐบาลต่างกัน'));
});
test('completion updates progress and remains reversible without changing earned credits',()=>{
 navigate('#lesson/POL1101-1');click('complete',{id:'POL1101-1'});assert.ok(saved().completed.includes('POL1101-1'));navigate('#course/POL1101');assert.ok(html().includes('เรียนแล้ว 1 / 5 บท'));
 navigate('#plan');assert.ok(html().includes('สอบผ่านที่บันทึก 0 นก.'));navigate('#lesson/POL1101-1');click('complete',{id:'POL1101-1'});assert.ok(!saved().completed.includes('POL1101-1'));
});
test('answers show explanation and mistakes review does not skip it after correction',()=>{
 navigate('#lesson/POL1101-1');click('answer',{lesson:'POL1101-1',index:'0',value:'0'});assert.ok(html().includes('ลองทบทวนแนวคิดอีกนิด'));assert.ok(html().includes(lessons[0].questions[0].explanation));
 navigate('#review');click('mode',{mode:'quiz'});listeners.change({target:{id:'mistakes-only',checked:true,classList:{contains(){return false}}}});assert.ok(html().includes(lessons[0].questions[0].prompt));
 click('retry-one',{id:'POL1101-1:0'});click('answer',{lesson:'POL1101-1',index:'0',value:'1'});assert.ok(html().includes('ถูกต้อง'));assert.ok(html().includes(lessons[0].questions[0].explanation));
});
test('search finds actual lesson content and displays a useful empty state',()=>{
 navigate('#courses');listeners.input({target:{id:'lesson-search',value:'ม่านแห่งความไม่รู้'}});assert.ok(get('#library-results').innerHTML.includes('POL2106-5'));
 listeners.input({target:{id:'lesson-search',value:'NONEXISTENT-TOPIC-XYZ'}});assert.ok(get('#library-results').innerHTML.includes('ยังไม่พบหัวข้อนี้'));
});
test('lesson pages open with the one-minute summary, analogy, memory hook and terms',()=>{
 for(const l of lessons){navigate('#lesson/'+l.id);const h=html();assert.ok(h.includes('เข้าใจใน 1 นาที'),l.id);for(const t of [l.easy.one,...l.easy.points,l.easy.analogy,l.easy.remember])assert.ok(h.includes(escapeHTML(t)),l.id);for(const [front] of l.easy.terms)assert.ok(h.includes(escapeHTML(front)),l.id);}
});
test('home shows a daily plan; ticking a block and choosing hours are saved',()=>{
 navigate('#home');assert.ok(html().includes('แผนวันนี้'));assert.ok(html().includes('data-action="block"'));
 click('hours',{value:'3'});assert.equal(saved().todayHours.hours,3);assert.equal(saved().todayHours.date,today());assert.ok(html().includes('ฟังคำบรรยาย'));
 click('block',{id:'main'});assert.deepEqual(saved().planDone[today()],['main']);assert.ok(html().includes('aria-pressed="true"'));
 click('block',{id:'main'});assert.deepEqual(saved().planDone[today()],[]);
 click('hours',{value:'9'});assert.equal(saved().todayHours.hours,3);
});
test('search covers the plain-language layer and textbook terms',()=>{
 navigate('#courses');listeners.input({target:{id:'lesson-search',value:'POSDCORB'}});assert.ok(get('#library-results').innerHTML.includes('POL2301-2'));
 listeners.input({target:{id:'lesson-search',value:''}});
});
test('exam guides render for every course and both practice modes score correctly',()=>{
 for(const code of Object.keys(prep)){navigate('#prep/'+code);const h=html();assert.ok(h.includes('ข้อสอบเสมือน'),code);assert.equal((h.match(/class="mock-q/g)||[]).length,prep[code].questions.length,code);assert.ok(!h.includes('undefined'),code);assert.ok(h.includes(escapeHTML(prep[code].textbook)),code);}
 navigate('#prep/missing');assert.ok(html().includes('ไม่พบหน้าที่เลือก'));
 navigate('#exams');assert.ok(html().includes('#prep/POL2106'));navigate('#course/POL2106');assert.ok(html().includes('แนวข้อสอบ POL2106'));
 const qs=prep.POL2106.questions;navigate('#prep/POL2106');
 click('prep-answer',{course:'POL2106',index:'0',value:String(qs[0].answer)});assert.equal(saved().prep.POL2106.answers['0'],qs[0].answer);assert.ok(html().includes(escapeHTML(qs[0].explanation)));
 click('prep-answer',{course:'POL2106',index:'0',value:String((qs[0].answer+1)%5)});assert.equal(saved().prep.POL2106.answers['0'],qs[0].answer,'practice answers lock');
 click('prep-mode',{course:'POL2106',mode:'exam'});assert.deepEqual(saved().prep.POL2106.answers,{});
 click('prep-answer',{course:'POL2106',index:'1',value:String((qs[1].answer+1)%5)});click('prep-answer',{course:'POL2106',index:'1',value:String(qs[1].answer)});
 assert.equal(saved().prep.POL2106.answers['1'],qs[1].answer,'exam answers can change before submit');assert.ok(!html().includes(escapeHTML(qs[1].explanation)),'no key before submit');
 click('prep-submit',{course:'POL2106'});assert.equal(saved().prep.POL2106.submitted,true);assert.equal(saved().prep.POL2106.best,1);assert.ok(html().includes(escapeHTML(qs[1].explanation)));
 click('prep-answer',{course:'POL2106',index:'2',value:'0'});assert.equal(saved().prep.POL2106.answers['2'],undefined,'locked after submit');
 click('prep-reset',{course:'POL2106'});assert.deepEqual(saved().prep.POL2106.answers,{});assert.equal(saved().prep.POL2106.best,1);
 click('prep-mode',{course:'POL2106',mode:'practice'});
});

