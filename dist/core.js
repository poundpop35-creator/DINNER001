import {courses,terms,categoryTargets} from './data.js';
import {lessons} from './lessons.js';
export const STORAGE_KEY='ru-study-planner.v1';
export function freshState(){return {version:1,completed:[],notes:{},answers:{},reviews:{},grades:{},termMoves:{},lastLesson:null,transfer:{general:0,free:0},sessions:[],dailyGoal:1,font:'normal'};}
const lessonIds=new Set(lessons.map(l=>l.id));
const courseIds=new Set(courses.map(c=>c.id));
const cardIds=new Set(lessons.flatMap(l=>l.cards.map((_,i)=>`${l.id}:${i}`)));
const questionIds=new Map(lessons.flatMap(l=>l.questions.map((q,i)=>[`${l.id}:${i}`,q])));
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validateState(input){
 if(!plain(input)||input.version!==1)throw new Error('ไฟล์สำรองไม่ใช่รูปแบบ RU Study Planner รุ่น 1');
 const s=freshState();
 if(Array.isArray(input.completed))s.completed=[...new Set(input.completed.filter(x=>lessonIds.has(x)))];
 if(plain(input.notes))for(const [k,v]of Object.entries(input.notes)){if(lessonIds.has(k)&&typeof v==='string'&&v.length<=50000)s.notes[k]=v;}
 if(plain(input.answers))for(const [k,v]of Object.entries(input.answers)){if(questionIds.has(k)&&Number.isInteger(v)&&v>=0&&v<questionIds.get(k).options.length)s.answers[k]=v;}
 if(plain(input.reviews))for(const [k,v]of Object.entries(input.reviews)){if(cardIds.has(k)&&plain(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v.due)&&Number.isFinite(Date.parse(v.due))&&Number.isInteger(v.level)&&v.level>=0&&v.level<=3)s.reviews[k]={due:v.due,level:v.level};}
 if(plain(input.grades))for(const [k,v]of Object.entries(input.grades)){if(courseIds.has(k)&&['A','B+','B','C+','C','D+','D','F'].includes(v))s.grades[k]=v;}
 if(plain(input.termMoves))for(const [k,v]of Object.entries(input.termMoves)){if(courseIds.has(k)&&!courses.find(c=>c.id===k).enrolled&&Number.isInteger(v)&&v>=1&&v<terms.length)s.termMoves[k]=v;}
 if(lessonIds.has(input.lastLesson))s.lastLesson=input.lastLesson;
 if(plain(input.transfer))for(const [k,max]of [['general',30],['free',12]]){if(Number.isInteger(input.transfer[k])&&input.transfer[k]>=0&&input.transfer[k]<=max)s.transfer[k]=input.transfer[k];}
 if(Array.isArray(input.sessions))s.sessions=input.sessions.filter(v=>plain(v)&&lessonIds.has(v.lesson)&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)).slice(-1000).map(v=>({lesson:v.lesson,date:v.date}));
 if([1,2,3].includes(input.dailyGoal))s.dailyGoal=input.dailyGoal;
 if(['normal','large'].includes(input.font))s.font=input.font;
 return s;
}
export function loadState(storage){try{const raw=storage.getItem(STORAGE_KEY);return {state:raw?validateState(JSON.parse(raw)):freshState(),error:null};}catch(error){return {state:freshState(),error:'อ่านข้อมูลที่บันทึกในเครื่องไม่ได้ กรุณานำเข้าไฟล์สำรอง ข้อมูลเดิมจะไม่ถูกเขียนทับจนกว่าจะกู้คืน'};}}
export function storeState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function thaiDate(iso,short=false){if(!iso)return 'รอประกาศ';return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:short?'short':'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${iso}T12:00:00+07:00`));}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function addDays(day,n){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function courseProgress(state,code){const ls=lessons.filter(l=>l.course===code);const done=ls.filter(l=>state.completed.includes(l.id)).length;return {done,total:ls.length,percent:ls.length?Math.round(done/ls.length*100):0};}
export function progress(state){return {done:state.completed.length,total:lessons.length,percent:Math.round(state.completed.length/lessons.length*100)};}
export function nextLesson(state,code){const pool=code?lessons.filter(l=>l.course===code):lessons;return pool.find(l=>!state.completed.includes(l.id))||pool[0];}
export function exams(){return courses.filter(c=>c.enrolled&&c.exam).sort((a,b)=>a.exam.localeCompare(b.exam)||a.slot.localeCompare(b.slot));}
export function examClashes(items){const seen=new Map();const clashes=[];for(const c of items){if(!c.exam||!c.slot)continue;const key=`${c.exam}:${c.slot}`;if(seen.has(key))clashes.push([seen.get(key),c.id]);else seen.set(key,c.id);}return clashes;}
const values={'A':4,'B+':3.5,'B':3,'C+':2.5,'C':2,'D+':1.5,'D':1,'F':0};
export function planSummary(state){
 const planned=Object.fromEntries(Object.keys(categoryTargets).map(k=>[k,0]));const passed={...planned};
 let gradePoints=0,graded=0;
 for(const c of courses){planned[c.category]+=c.credits;const g=state.grades[c.id];if(g&&g!=='F')passed[c.category]+=c.credits;if(g){gradePoints+=values[g]*c.credits;graded+=c.credits;}}
 const earned=Object.values(passed).reduce((a,b)=>a+b,0);const transfer=state.transfer.general+state.transfer.free;
 const termRows=terms.map(t=>{const items=courses.filter(c=>(state.termMoves[c.id]??c.term)===t.id);const credits=items.reduce((n,c)=>n+c.credits,0);return {...t,courses:items,credits,over:credits>t.cap,heavy:items.filter(c=>c.load==='หนัก').length};});
 return {planned,passed,earned,transfer,remaining:126-earned-transfer,gpa:graded?gradePoints/graded:null,graded,termRows};
}
export function cardsForReview(state,code,day=today()){return lessons.filter(l=>!code||l.course===code).flatMap(l=>l.cards.map((card,i)=>({...card,id:`${l.id}:${i}`,lesson:l.id,course:l.course,title:l.title}))).filter(c=>!state.reviews[c.id]||state.reviews[c.id].due<=day);}
export function reviewCard(state,id,remembered,day=today()){if(!cardIds.has(id))return;const prev=state.reviews[id]?.level??0;const level=remembered?Math.min(prev+1,3):0;const interval=remembered?[1,1,3,7][level]:1;state.reviews[id]={level,due:addDays(day,interval)};}
export function checkAnswer(lessonId,index,value){const q=questionIds.get(`${lessonId}:${index}`);return !!q&&q.answer===value;}
export function quizItems(state,course='',mistakes=false){return lessons.filter(l=>!course||l.course===course).flatMap(l=>l.questions.map((q,i)=>({...q,id:`${l.id}:${i}`,lesson:l.id,course:l.course,title:l.title,index:i}))).filter(q=>!mistakes||(q.id in state.answers&&state.answers[q.id]!==q.answer));}
export function examICS(){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RU Study Planner//Exam Calendar//TH','CALSCALE:GREGORIAN'];for(const c of exams()){lines.push('BEGIN:VEVENT',`UID:${c.id}-269@ru-study-planner`,`DTSTAMP:20261010T000000Z`,`DTSTART;VALUE=DATE:${c.exam.replaceAll('-','')}`,`DTEND;VALUE=DATE:${addDays(c.exam,1).replaceAll('-','')}`,`SUMMARY:${c.id} สอบคาบ ${c.slot}`,`DESCRIPTION:${c.title} · คาบ ${c.slot} (ยังไม่ได้ระบุชั่วโมงสอบในแอป) ตรวจตารางสอบรายบุคคลอีกครั้ง`,'END:VEVENT');}return lines.concat('END:VCALENDAR').join('\r\n')+'\r\n';}
