import {courses} from './data.js?v=20261014g';
import {escapeHTML as e} from './core.js?v=20261014g';

export function studySections(active='prep'){
 return `<nav class="study-sections" aria-label="แยกเนื้อหาการเรียน"><a href="#courses" ${active==='prep'?'aria-current="page"':''}><strong>ติวก่อนเรียน</strong><span>ปูพื้นฐานและฝึกด้วยตัวเอง</span></a><a href="#classroom" ${active==='classroom'?'aria-current="page"':''}><strong>เนื้อหาจากห้องเรียน</strong><span>เอกสารและคำสอนของอาจารย์</span></a><a href="#notes" ${active==='notes'?'aria-current="page"':''}><strong>สมุดจดของฉัน</strong><span>พิมพ์ เขียนด้วยปากกา และเก็บรูป</span></a></nav>`;
}
export function prepNotice(){
 return '<aside class="content-origin"><strong>ติวก่อนเรียน · เนื้อหาที่เรียบเรียงเพื่อปูพื้นฐาน</strong><p>ส่วนนี้ไม่ใช่คำบรรยายหรือเอกสารของอาจารย์ในห้องเรียน เนื้อหาจริงจะเพิ่มแยกไว้เมื่อคุณส่งมา</p><a href="#classroom">ดูพื้นที่เนื้อหาจากห้องเรียน →</a></aside>';
}
export function classroomPage(){
 return `<div class="page-heading"><div><div class="eyebrow">CLASSROOM MATERIALS</div><h1>เนื้อหาจากห้องเรียน</h1><p>พื้นที่สำหรับเอกสาร คำบรรยาย และหัวข้อที่อาจารย์สอนจริง</p></div></div>${studySections('classroom')}<section class="panel classroom-empty"><span class="origin-label">รอเนื้อหาจากคุณ</span><h2>ยังไม่ได้รับเนื้อหาจากอาจารย์</h2><p>เมื่อคุณส่งเอกสารหรือเนื้อหาที่เรียนจริงมา จะจัดแยกตามวิชาไว้ที่นี่ เนื้อหาติวก่อนเรียนยังอยู่ในเมนูของตัวเอง และความคืบหน้าการติวไม่นับว่าเรียนเนื้อหาจากอาจารย์แล้ว</p><a class="button secondary" href="#courses">ไปติวก่อนเรียน</a></section><div class="classroom-grid">${courses.filter(c=>c.enrolled).map(c=>`<article class="panel classroom-course"><span class="cc-code">${c.id}</span><h2>${e(c.title)}</h2><p class="classroom-state">ยังไม่มีเนื้อหาจากอาจารย์</p><button class="button secondary" data-action="nb-new" data-course="${c.id}" data-source="classroom">จดจากห้องเรียนวิชานี้</button></article>`).join('')}</div>`;
}
