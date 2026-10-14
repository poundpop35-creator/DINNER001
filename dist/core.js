import {courses,terms,categoryTargets,readingWeek,studyPhases,studyHours} from './data.js?v=20261014d';
import {lessons} from './lessons.js?v=20261014d';
import {prep} from './prep.js?v=20261014d';
export const STORAGE_KEY='ru-study-planner.v1';
export function freshState(){return {version:1,completed:[],notes:{},answers:{},reviews:{},grades:{},termMoves:{},lastLesson:null,transfer:{general:0,free:0},sessions:[],dailyGoal:1,font:'normal',hours:{weekday:2,weekend:4},todayHours:null,planDone:{},prep:{}};}
const lessonIds=new Set(lessons.map(l=>l.id));
const courseIds=new Set(courses.map(c=>c.id));
const cardIds=new Set(lessons.flatMap(l=>l.cards.map((_,i)=>`${l.id}:${i}`)));
const questionIds=new Map(lessons.flatMap(l=>l.questions.map((q,i)=>[`${l.id}:${i}`,q])));
export const BLOCK_IDS=new Set(['cards','main','second','deep','extra','wrap','examday']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
export function validateState(input){
 if(!plain(input)||input.version!==1)throw new Error('ไฟล์สำรองไม่ใช่รูปแบบ RU Study Planner รุ่น 1');
 const s=freshState();
 if(Array.isArray(input.completed))s.completed=[...new Set(input.completed.filter(x=>lessonIds.has(x)))];
 if(plain(input.notes))for(const [k,v]of Object.entries(input.notes)){if(lessonIds.has(k)&&typeof v==='string'&&v.length<=50000)s.notes[k]=v;}
 if(plain(input.answers))for(const [k,v]of Object.entries(input.answers)){if(questionIds.has(k)&&Number.isInteger(v)&&v>=0&&v<questionIds.get(k).options.length)s.answers[k]=v;}
 if(plain(input.reviews))for(const [k,v]of Object.entries(input.reviews)){if(cardIds.has(k)&&plain(v)&&isDay(v.due)&&Number.isInteger(v.level)&&v.level>=0&&v.level<=3)s.reviews[k]={due:v.due,level:v.level};}
 if(plain(input.grades))for(const [k,v]of Object.entries(input.grades)){if(courseIds.has(k)&&['A','B+','B','C+','C','D+','D','F'].includes(v))s.grades[k]=v;}
 if(plain(input.termMoves))for(const [k,v]of Object.entries(input.termMoves)){if(courseIds.has(k)&&!courses.find(c=>c.id===k).enrolled&&Number.isInteger(v)&&v>=1&&v<terms.length)s.termMoves[k]=v;}
 if(lessonIds.has(input.lastLesson))s.lastLesson=input.lastLesson;
 if(plain(input.transfer))for(const [k,max]of [['general',30],['free',12]]){if(Number.isInteger(input.transfer[k])&&input.transfer[k]>=0&&input.transfer[k]<=max)s.transfer[k]=input.transfer[k];}
 if(Array.isArray(input.sessions))s.sessions=input.sessions.filter(v=>plain(v)&&lessonIds.has(v.lesson)&&isDay(v.date)).slice(-1000).map(v=>({lesson:v.lesson,date:v.date}));
 if([1,2,3].includes(input.dailyGoal))s.dailyGoal=input.dailyGoal;
 if(['normal','large'].includes(input.font))s.font=input.font;
 if(plain(input.hours))for(const k of ['weekday','weekend']){if(studyHours.includes(input.hours[k]))s.hours[k]=input.hours[k];}
 if(plain(input.todayHours)&&isDay(input.todayHours.date)&&studyHours.includes(input.todayHours.hours))s.todayHours={date:input.todayHours.date,hours:input.todayHours.hours};
 if(plain(input.planDone))for(const k of Object.keys(input.planDone).filter(isDay).sort().slice(-120)){const v=input.planDone[k];if(Array.isArray(v))s.planDone[k]=[...new Set(v.filter(x=>BLOCK_IDS.has(x)))];}
 if(plain(input.prep))for(const [k,v]of Object.entries(input.prep)){if(!Object.hasOwn(prep,k)||!plain(v))continue;const n=prep[k].questions.length,score=x=>Number.isInteger(x)&&x>=0&&x<=n?x:null,answers={};if(plain(v.answers))for(const [i,a]of Object.entries(v.answers)){if(/^\d+$/.test(i)&&Number(i)<n&&Number.isInteger(a)&&a>=0&&a<prep[k].questions[Number(i)].options.length)answers[i]=a;}s.prep[k]={answers,submitted:v.submitted===true,best:score(v.best),last:score(v.last)};}
 return s;
}
export function loadState(storage){try{const raw=storage.getItem(STORAGE_KEY);return {state:raw?validateState(JSON.parse(raw)):freshState(),error:null};}catch(error){return {state:freshState(),error:'อ่านข้อมูลที่บันทึกในเครื่องไม่ได้ กรุณานำเข้าไฟล์สำรอง ข้อมูลเดิมจะไม่ถูกเขียนทับจนกว่าจะกู้คืน'};}}
export function storeState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function thaiDate(iso,short=false){if(!iso)return 'รอประกาศ';return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:short?'short':'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${iso}T12:00:00+07:00`));}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function addDays(day,n){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function daysBetween(from,to){return Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);}
// 0 = Monday … 6 = Sunday, matching readingWeek.
export function weekdayIndex(day){return (new Date(`${day}T12:00:00Z`).getUTCDay()+6)%7;}
export function courseProgress(state,code){const ls=lessons.filter(l=>l.course===code);const done=ls.filter(l=>state.completed.includes(l.id)).length;return {done,total:ls.length,percent:ls.length?Math.round(done/ls.length*100):0};}
export function progress(state){return {done:state.completed.length,total:lessons.length,percent:Math.round(state.completed.length/lessons.length*100)};}
export function nextLesson(state,code){const pool=code?lessons.filter(l=>l.course===code):lessons;return pool.find(l=>!state.completed.includes(l.id))||pool[0];}
export function unreadLesson(state,code){return lessons.find(l=>l.course===code&&!state.completed.includes(l.id))||null;}
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
// Cards join the review queue once their lesson is read (or already reviewed), so the queue never floods on day one.
export function cardsForReview(state,code,day=today(),includeUnread=false){return lessons.filter(l=>(!code||l.course===code)&&(includeUnread||state.completed.includes(l.id)||l.cards.some((_,i)=>state.reviews[`${l.id}:${i}`]))).flatMap(l=>l.cards.map((card,i)=>({...card,id:`${l.id}:${i}`,lesson:l.id,course:l.course,title:l.title}))).filter(c=>!state.reviews[c.id]||state.reviews[c.id].due<=day);}
export function reviewCard(state,id,remembered,day=today()){if(!cardIds.has(id))return;const prev=state.reviews[id]?.level??0;const level=remembered?Math.min(prev+1,3):0;const interval=remembered?[1,1,3,7][level]:1;state.reviews[id]={level,due:addDays(day,interval)};}
export function checkAnswer(lessonId,index,value){const q=questionIds.get(`${lessonId}:${index}`);return !!q&&q.answer===value;}
export function quizItems(state,course='',mistakes=false){return lessons.filter(l=>!course||l.course===course).flatMap(l=>l.questions.map((q,i)=>({...q,id:`${l.id}:${i}`,lesson:l.id,course:l.course,title:l.title,index:i}))).filter(q=>!mistakes||(q.id in state.answers&&state.answers[q.id]!==q.answer));}
export function examICS(){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RU Study Planner//Exam Calendar//TH','CALSCALE:GREGORIAN'];for(const c of exams()){lines.push('BEGIN:VEVENT',`UID:${c.id}-269@ru-study-planner`,`DTSTAMP:20261010T000000Z`,`DTSTART;VALUE=DATE:${c.exam.replaceAll('-','')}`,`DTEND;VALUE=DATE:${addDays(c.exam,1).replaceAll('-','')}`,`SUMMARY:${c.id} สอบคาบ ${c.slot}`,`DESCRIPTION:${c.title} · คาบ ${c.slot} (ยังไม่ได้ระบุชั่วโมงสอบในแอป) ตรวจตารางสอบรายบุคคลอีกครั้ง`,'END:VEVENT');}return lines.concat('END:VCALENDAR').join('\r\n')+'\r\n';}

// ---- Daily study planner (1–4 hours a day around work) ----
export function phaseFor(day){return studyPhases.find(p=>(!p.start||day>=p.start)&&(!p.end||day<=p.end));}
export function hoursFor(state,day=today()){if(state.todayHours&&state.todayHours.date===day)return state.todayHours.hours;return weekdayIndex(day)>=5?state.hours.weekend:state.hours.weekday;}
export function hoursUntil(state,from,to){let total=0;for(let d=from;d<to;d=addDays(d,1))total+=weekdayIndex(d)>=5?state.hours.weekend:state.hours.weekday;return total;}
function lowestProgress(state,skip){return exams().map(c=>c.id).filter(id=>!skip.includes(id)).sort((a,b)=>courseProgress(state,a).percent-courseProgress(state,b).percent)[0];}
function studyTask(state,code,short){
 const l=unreadLesson(state,code);
 if(l)return {title:`${code} · บทที่ ${l.n} ${l.title}`,detail:short?'อ่าน “เข้าใจใน 1 นาที” และคำสำคัญ ถ้ามีเวลาเหลือค่อยอ่านละเอียด':'เปิดเรื่อง → “เข้าใจใน 1 นาที” → อ่านละเอียด → ตอบคำถามท้ายบท แล้วกดอ่านจบ',href:`#lesson/${l.id}`};
 return {title:`${code} · เรียนลึกกับตำรา`,detail:short?'อ่านบันทึกของตัวเอง แล้วทำคำถามทบทวนของวิชานี้':'อ่านตำราหรือดูคำบรรยาย RU on Demand 1 หัวข้อ แล้วจดสรุปด้วยภาษาตัวเองลงบันทึก',href:`#course/${code}`};
}
export function dailyPlan(state,day=today()){
 const hours=hoursFor(state,day),phase=phaseFor(day),list=exams();
 const nextExam=list.find(c=>c.exam>=day)||null;
 const blocks=[];const add=(id,minutes,title,detail,course,href)=>blocks.push({id,minutes,title,detail,course:course||null,href:href||null});
 const result=()=>({day,hours,phase,nextExam,blocks,minutes:blocks.reduce((n,b)=>n+b.minutes,0),done:(state.planDone[day]||[]).filter(id=>blocks.some(b=>b.id===id)).length});
 if(phase.id==='done'||!nextExam)return result();
 const due=cardsForReview(state,'',day).length;
 const cardText=due?`${due} ใบถึงรอบ — นึกคำตอบก่อนเปิดดู`:'ยังไม่มีการ์ดถึงรอบ อ่าน “จำง่าย” ของบทล่าสุดแทน';
 const one=hours===1;
 if(phase.id==='exam'&&nextExam.exam===day){
  const after=list.find(c=>c.exam>day);
  add('cards',15,`${nextExam.id} · อุ่นเครื่องเบา ๆ ก่อนสอบ`,'อ่านเฉพาะ “จำง่าย” และคำสำคัญของทุกบท ไม่เริ่มเรื่องใหม่',nextExam.id,`#course/${nextExam.id}`);
  add('examday',0,`วันนี้สอบ ${nextExam.id} คาบ ${nextExam.slot}`,'ตรวจเวลา ห้องสอบ และสิ่งที่ต้องนำไปจากตารางสอบรายบุคคล ไปถึงก่อนเวลา',nextExam.id,'#exams');
  const tomorrow=after&&after.exam===addDays(day,1);
  if(after&&!one)add('second',tomorrow?hours*60-15:60,tomorrow?`หลังสอบ · เตรียม ${after.id} ที่สอบพรุ่งนี้`:`หลังสอบ · เริ่ม ${after.id}`,tomorrow?'พักสั้น ๆ แล้วอ่าน “เข้าใจใน 1 นาที” + “จำง่าย” ทุกบท ทำคำถามของวิชานี้ และนอนให้พอ':`พักให้หายเหนื่อยก่อน แล้วอ่าน “เข้าใจใน 1 นาที” ของ ${after.id} (สอบ ${thaiDate(after.exam,true)})`,after.id,`#course/${after.id}`);
  return result();
 }
 let main,second;
 if(phase.id==='learn')[,main,second]=readingWeek[weekdayIndex(day)];
 else if(phase.id==='review'){const i=daysBetween(phase.start,day);main=list[i%list.length].id;second=main==='POL2106'?'POL2107':main==='POL2107'?'POL2106':(i%2?'POL2107':'POL2106');}
 else {main=nextExam.id;second=list.find(c=>c.exam>nextExam.exam)?.id||main;}
 add('cards',one?10:15,'อุ่นเครื่องด้วยแฟลชการ์ด',cardText,null,'#review');
 if(phase.id==='learn'){
  const m=studyTask(state,main,false);add('main',one?40:60,m.title,m.detail,main,m.href);
  if(!one){const s=studyTask(state,second,true);add('second',30,s.title,s.detail,second,s.href);}
  if(hours>=3)add('deep',60,`${main} · ฟังคำบรรยาย`,`เปิด RU on Demand ค้นรหัส ${main} ดู 1 ตอน แล้วเติมสิ่งที่อาจารย์เน้นลงบันทึกของบทที่เกี่ยวข้อง`,main,`#course/${main}`);
  if(hours>=4){const low=lowestProgress(state,[main,second]);const x=studyTask(state,low,false);add('extra',60,x.title,`วิชาที่คืบหน้าน้อยที่สุดตอนนี้ · ${x.detail}`,low,x.href);}
  add('wrap',one?10:15,'ปิดท้าย: เช็กความเข้าใจ','ตอบคำถามข้อที่เคยผิด แล้วเขียนสรุป 3 บรรทัดว่าวันนี้เข้าใจอะไร',null,'#review');
 }else if(phase.id==='review'){
  add('main',one?40:60,`${main} · ทบทวนทั้งวิชา`,'อ่าน “เข้าใจใน 1 นาที” ทุกบท + บันทึกของตัวเอง แล้วทำคำถามทบทวนของวิชานี้',main,`#course/${main}`);
  if(!one)add('second',30,`${second} · วิชาหนัก ทบทวนซ้ำ`,'อ่าน “จุดที่มักสับสน” ทุกบท แล้วลองอธิบายนักคิดหรือแนวคิดหลักโดยไม่เปิดดู',second,`#course/${second}`);
  if(hours>=3)add('deep',60,`${main} · อ่านตำราส่วนที่ยังไม่มั่นใจ`,'เลือกหัวข้อที่ตอบผิดหรืออธิบายไม่ได้ อ่านตำราหรือฟังคำบรรยายเฉพาะส่วนนั้น',main,`#course/${main}`);
  if(hours>=4)add('extra',60,`${main} · ทำแนวข้อสอบ`,'ทำข้อสอบเสมือนแบบจำลองสอบ แล้วอ่านเฉลยข้อที่ผิดและเปิดตำราหัวข้อนั้น',main,`#prep/${main}`);
  add('wrap',one?10:15,'ปิดท้าย: จดสิ่งที่ยังไม่แม่น','เขียน 3 เรื่องที่ยังไม่มั่นใจ ไว้เปิดดูก่อนเริ่มพรุ่งนี้',null,'#notes');
 }else{
  const left=daysBetween(day,nextExam.exam);
  add('main',one?40:60,`${main} · สอบ ${thaiDate(nextExam.exam,true)} (อีก ${left} วัน)`,'อ่าน “เข้าใจใน 1 นาที” + “จำง่าย” ทุกบท แล้วทำคำถามทั้งหมดของวิชานี้',main,`#course/${main}`);
  if(!one)add('second',30,second===main?`${main} · จุดที่มักสับสน`:`${second} · เตรียมวิชาถัดไป`,second===main?'อ่าน “จุดที่มักสับสน” ทุกบท แล้วอธิบายออกเสียงโดยไม่เปิดดู':'อ่านสรุปง่ายเบา ๆ ให้คุ้นก่อนถึงคิวเต็ม',second,`#course/${second}`);
  if(hours>=3)add('deep',60,`${main} · เก็บจุดที่ยังไม่แม่น`,'ทบทวนข้อที่เคยตอบผิดและบันทึกของตัวเอง ไม่เริ่มอ่านเรื่องใหม่ที่ยาว',main,`#course/${main}`);
  if(hours>=4)add('extra',60,`${main} · ทำแนวข้อสอบอีกรอบ`,'ทำข้อสอบเสมือนแบบจำลองสอบให้ได้คะแนนดีกว่ารอบก่อน แล้วเก็บข้อที่ยังผิด',main,`#prep/${main}`);
  add('wrap',one?10:15,left===1?'เตรียมตัวสอบพรุ่งนี้':'ปิดท้าย: ข้อที่เคยผิด',left===1?'เตรียมของตามตารางสอบรายบุคคล ตั้งนาฬิกาปลุก และนอนให้พอ':'ทำคำถามข้อที่เคยผิดของวิชานี้อีกครั้ง',null,left===1?'#exams':'#review');
 }
 return result();
}
export function activeDays(state){const days=new Set(state.sessions.map(s=>s.date));for(const [d,v]of Object.entries(state.planDone))if(v.length)days.add(d);return days;}
export function streak(state,day=today()){const days=activeDays(state);let d=days.has(day)?day:addDays(day,-1),n=0;while(days.has(d)){n++;d=addDays(d,-1);}return n;}
// ---- Exam-style practice sets ----
export function prepResult(state,code){const g=prep[code];if(!g)return null;const p=state.prep[code]||{answers:{},submitted:false,best:null,last:null};const total=g.questions.length,answered=Object.keys(p.answers).length,correct=g.questions.filter((q,i)=>p.answers[i]===q.answer).length;return {...p,total,answered,correct};}

