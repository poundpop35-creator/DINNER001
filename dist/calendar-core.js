import {calendar,courses,schedules} from './data.js?v=20261014f';
import {addDays,today} from './core.js?v=20261014f';
export const weekdays=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
export function monthBounds(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid month');
 const [year,n]=month.split('-').map(Number);
 return {start:month+'-01',end:new Date(Date.UTC(year,n,0,12)).toISOString().slice(0,10)};
}
export function shiftMonth(month,delta){const [year,n]=month.split('-').map(Number);return new Date(Date.UTC(year,n-1+delta,1,12)).toISOString().slice(0,7);}
export function defaultMonth(day=today()){return (day<calendar.lectureStart?calendar.lectureStart:day>calendar.examEnd?calendar.examEnd:day).slice(0,7);}
export function lectureClashes(){
 const result=[];
 for(let i=0;i<schedules.length;i++)for(let j=i+1;j<schedules.length;j++){
  const a=schedules[i],b=schedules[j];
  if(a.course!==b.course&&a.weekday===b.weekday&&a.startTime<b.endTime&&b.startTime<a.endTime)result.push([a,b]);
 }
 return result;
}
export function firstLecture(schedule){
 for(let d=calendar.lectureStart;d<=calendar.lectureEnd;d=addDays(d,1))if(new Date(d+'T12:00:00Z').getUTCDay()===schedule.weekday&&!calendar.exceptions.some(x=>x.kind==='cancelled'&&d>=x.start&&d<=x.end))return d;
 return null;
}
export function calendarEvents({start=calendar.lectureStart,end=calendar.examEnd,type='all',course=''}={}){
 const rows=[],clashes=lectureClashes();
 const selected=courses.filter(c=>c.enrolled&&(!course||c.id===course));
 if(type!=='exam')for(let d=start<calendar.lectureStart?calendar.lectureStart:start;d<=end&&d<=calendar.lectureEnd;d=addDays(d,1)){
  const exception=calendar.exceptions.find(x=>d>=x.start&&d<=x.end),weekday=new Date(d+'T12:00:00Z').getUTCDay();
  if(exception?.kind==='cancelled'){
   rows.push({id:'notice-'+d,type:'notice',date:d,title:exception.title,source:exception.source,course:'',time:'งดบรรยาย'});continue;
  }
  for(const s of schedules.filter(s=>s.weekday===weekday&&selected.some(c=>c.id===s.course))){
   rows.push({...s,id:s.id+'-'+d,type:'lecture',date:d,title:selected.find(c=>c.id===s.course).title,time:s.startTime+'–'+s.endTime,check:exception?.kind==='check'?exception.title:null,clash:clashes.some(pair=>pair.some(x=>x.id===s.id))});
  }
 }
 if(type!=='lecture')for(const c of selected.filter(c=>c.exam&&c.exam>=start&&c.exam<=end))rows.push({id:'exam-'+c.id,type:'exam',date:c.exam,course:c.id,title:c.title,slot:c.slot,time:'คาบ '+c.slot,source:'mr30'});
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||'').localeCompare(b.startTime||'')||a.course.localeCompare(b.course));
}
const icsEscape=v=>String(v).replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');
export function foldICS(line){let result='',row='',bytes=0;const encoder=new TextEncoder();for(const ch of line){const n=encoder.encode(ch).length;if(bytes+n>75){result+=row+'\r\n';row=' ';bytes=1;}row+=ch;bytes+=n;}return result+row;}
const utc=(day,time)=>new Date(`${day}T${time}:00+07:00`).toISOString().replace(/[-:]/g,'').replace('.000','');
export function scheduleICS({type='all',course=''}={}){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RU Study Planner//Class and Exam Calendar//TH','CALSCALE:GREGORIAN','X-WR-CALNAME:'+icsEscape('RU Study Planner · 2/2569')];
 for(const event of calendarEvents({type,course}).filter(x=>x.type!=='notice')){
  const exam=event.type==='exam';
  lines.push('BEGIN:VEVENT',`UID:${exam?event.course+'-269':event.id}@ru-study-planner`,'DTSTAMP:20261014T000000Z');
  if(exam)lines.push('DTSTART;VALUE=DATE:'+event.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+addDays(event.date,1).replaceAll('-',''));
  else lines.push('DTSTART:'+utc(event.date,event.startTime),'DTEND:'+utc(event.date,event.endTime),'STATUS:TENTATIVE','LOCATION:'+icsEscape(event.room));
  lines.push('SUMMARY:'+icsEscape(`${exam?'สอบ':'เรียนตาม ม.ร.30'} ${event.course}${exam?' · คาบ '+event.slot:''}`),'DESCRIPTION:'+icsEscape(event.title+'\n'+(exam?'คาบ '+event.slot+' ยังไม่ระบุชั่วโมงและห้องสอบ ตรวจตารางสอบรายบุคคล':'เวลาไทย '+event.time+' ห้องเรียน '+event.room+'\n'+calendar.note+(event.check?'\n'+event.check:'')+(event.clash?'\nเวลาเรียนตรงกับวิชาอื่นที่ลงไว้':''))),'END:VEVENT');
 }
 return lines.concat('END:VCALENDAR').map(foldICS).join('\r\n')+'\r\n';
}
