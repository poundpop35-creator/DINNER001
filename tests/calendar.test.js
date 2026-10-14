import test from 'node:test';
import assert from 'node:assert/strict';
import {schedules} from '../dist/data.js';
import {calendarEvents,firstLecture,lectureClashes,monthBounds,shiftMonth,defaultMonth,activityMonth,scheduleICS} from '../dist/calendar-core.js';
test('filter focus chooses a month containing the selected activity, before, during and after the semester',()=>{
 assert.equal(activityMonth('exam','2026-10-14'),'2027-03');
 assert.equal(activityMonth('lecture','2026-10-14'),'2026-11');
 assert.equal(activityMonth('all','2026-10-14'),'2026-11');
 assert.equal(activityMonth('lecture','2027-01-20'),'2027-01');
 assert.equal(activityMonth('lecture','2027-01-20','POL2104'),'2027-01');
 assert.equal(activityMonth('exam','2027-02-12','POL2104'),'2027-03');
 assert.equal(activityMonth('lecture','2027-04-01'),'2027-03');
});
test('lecture rows exactly match official MR30 pages 142–143, including unusual POL1101 time',()=>{
 const expected={POL1101:[1,'11:10','13:40','KTB 401','2026-11-16'],POL2104:[3,'13:30','15:20','KLB 501','2026-11-18'],POL2106:[3,'13:30','15:20','VPB 501','2026-11-18'],POL2107:[4,'17:30','19:20','VKB 301','2026-11-19'],POL2200:[5,'13:30','15:20','VPB 401','2026-11-20'],POL2301:[3,'11:30','13:20','KLB 301','2026-11-18'],POL2303:[2,'11:30','13:20','KLB 201','2026-11-17']};
 assert.equal(schedules.length,7);for(const s of schedules)assert.deepEqual([s.weekday,s.startTime,s.endTime,s.room,firstLecture(s)],expected[s.course]);
 assert.deepEqual(lectureClashes().map(p=>p.map(s=>s.course)),[['POL2104','POL2106']]);
});
test('calendar bounds, cancelled lecture date, verification period, and semester end are respected',()=>{
 assert.equal(calendarEvents({start:'2026-11-01',end:'2026-11-15',type:'lecture'}).length,0);
 assert.equal(calendarEvents({start:'2026-11-16',end:'2026-11-20',type:'lecture'}).length,7);
 const cancelled=calendarEvents({start:'2027-01-20',end:'2027-01-20'});assert.equal(cancelled.length,1);assert.equal(cancelled[0].type,'notice');
 assert.ok(calendarEvents({start:'2027-01-21',end:'2027-01-26',type:'lecture'}).every(x=>x.check));
 assert.equal(calendarEvents({start:'2027-03-06',end:'2027-03-31',type:'lecture'}).length,0);
 assert.equal(calendarEvents({type:'exam'}).length,7);
 assert.ok(calendarEvents({type:'exam'}).every(x=>!x.room&&!x.startTime));
 assert.deepEqual(calendarEvents({type:'exam',course:'POL2104'}).map(x=>[x.course,x.date,x.slot]),[['POL2104','2027-03-10','A']]);
 assert.ok(calendarEvents({type:'lecture',course:'POL2104'}).filter(x=>x.type==='lecture').every(x=>x.course==='POL2104'&&x.clash));
});
test('calendar navigation handles year boundaries, leap February and Bangkok display selection',()=>{
 assert.deepEqual(monthBounds('2028-02'),{start:'2028-02-01',end:'2028-02-29'});assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2027-01',-1),'2026-12');assert.equal(defaultMonth('2026-10-14'),'2026-11');assert.equal(defaultMonth('2027-02-01'),'2027-02');assert.equal(defaultMonth('2029-01-01'),'2027-03');
});
test('ICS uses accurate UTC for Bangkok lectures, all-day exams, stable IDs and UTF-8 folding',()=>{
 const exams=scheduleICS({type:'exam'}),lecture=scheduleICS({type:'lecture',course:'POL1101'});
 assert.equal((exams.match(/BEGIN:VEVENT/g)||[]).length,7);assert.ok(exams.includes('DTSTART;VALUE=DATE:20270310'));assert.ok(!exams.includes('DTSTART:'));assert.ok(exams.includes('UID:POL1101-269@ru-study-planner'));
 assert.ok(lecture.includes('DTSTART:20261116T041000Z'));assert.ok(lecture.includes('DTEND:20261116T064000Z'));assert.ok(lecture.includes('LOCATION:KTB 401'));assert.ok(lecture.includes('STATUS:TENTATIVE'));
 const all=scheduleICS();assert.ok(!all.includes('20270120T'));for(const line of all.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);assert.ok(all.replace(/\r\n /g,'').includes('ปรัชญาการเมืองเบื้องต้น'));
});
