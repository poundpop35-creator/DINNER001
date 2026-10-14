# Supabase — RU Study Planner

สถานะ 14 ต.ค. 2569: **ย้ายเนื้อหาและสร้างพื้นที่ข้อมูลส่วนตัวเรียบร้อยแล้ว**
โปรเจ็กต์เป้าหมาย `RU-Study-Planner` / `yikfrloyijdbwglswcww` (Seoul)
โปรเจ็กต์ระบบลงทะเบียนเดิมไม่ได้ถูกแก้ไข

## สิ่งที่ตรวจจริงแล้ว

- public catalog API ผ่าน validation: terms 7, courses 28, lessons 35, guides 7, schedules 7; practice 173 ข้อ
- schema migrations: `ru_study_published_content`, `ru_study_private_workspace_and_images`
- SQL seed อยู่ใน database/seed.sql; เป็นข้อมูลการเรียนสาธารณะเท่านั้น
- workspace ส่วนตัวมี RLS ผูก auth.uid() กับ user_id และ save RPC ตรวจ revision
- storage bucket `ru-study-notes` เป็น private รองรับ JPG/PNG/WebP/GIF ไม่เกิน 5 MB/รูป
- anonymous/cross-user reads/writes ถูกปฏิเสธ และ revision conflict ถูกตรวจจริงด้วย database/verify-access.sql (transaction rollback)
- security advisors ไม่มีรายการเตือน ณ เวลาตรวจ

## เหลือการตั้งค่าเข้าสู่ระบบโดยเจ้าของโปรเจ็กต์

ตอนตรวจ `/auth/v1/settings`: Google false, email true, email confirmation required, anonymous sign-in false
เครื่องมือ Supabase ในเซสชันนี้ไม่มีการตั้งค่า Auth provider/URL; ไม่ได้ดึงหรือขอรหัสลับ Google

1. ไป Authentication → URL Configuration ตั้ง Site URL เป็น URL หน้าแอปหลัก และใส่ Redirect URL ทั้งหน้า Vercel และ `https://poundpop35-creator.github.io/RU-Study-Planner/` หากใช้งานทั้งคู่
2. เปิด Authentication → Sign In / Providers → Google โดยใช้ Client ID และ Client Secret จาก Google Cloud ตั้ง Authorized Redirect URI เป็น `https://yikfrloyijdbwglswcww.supabase.co/auth/v1/callback`
3. โหลดแอปใหม่แล้วเปิดหน้า “บัญชีและการซิงก์” ปุ่ม Google จะเปิดตาม settings จริง
4. ทางเลือกอีเมล/รหัสผ่านต้องยืนยันอีเมลและมี SMTP ที่ส่งถึงผู้ใช้ได้ ไม่อ้างว่า Google หรืออีเมลของผู้ใช้ผ่าน end-to-end แล้ว
5. หลังเข้าบัญชี เลือกคัดลอกข้อมูลก่อนเข้าสู่ระบบหนึ่งครั้ง หากมีข้อมูลเดิม ต้องตั้งใจเลือกแทนที่ข้อมูลบัญชีและมีสำเนากู้คืนอัตโนมัติ

## บันทึกและรูปส่วนตัว

สมุดจด Quill เก็บ Delta ที่ผ่านตัวกรอง ไม่ใช้ innerHTML ของผู้ใช้ โครงสร้างสี/ไฮไลต์และรูปถูกเก็บใน `ru_study_workspaces.payload` แยกตามเจ้าของ รูปเป็น ID อ้างถึง private storage ไม่เก็บ URL สาธารณะหรือ URL ที่หมดอายุลงเนื้อหา

ก่อนลงชื่อ: localStorage / IndexedDB ของ origin นี้ หลังลงชื่อ: cache แยก user ID และ RPC สำหรับ owner เท่านั้น หากเครื่องอื่นแก้ก่อนจะหยุดการซิงก์และให้เลือกฉบับ ไม่เขียนทับเงียบ ๆ

“ส่งออกโน้ตพร้อมรูป” รวม snapshot และ image data ลง JSON ในเครื่อง ไม่ส่งไปบริการอื่น การย้าย GitHub Pages → Vercel ต้องนำเข้าสำรองหรือเข้าสู่บัญชีเดียวกัน เพราะ localStorage/IndexedDB ไม่ข้าม origin

## แก้เนื้อหาใน Table Editor

| ตาราง | ใช้แก้ |
|---|---|
| ru_study_courses | ชื่อวิชา ภาระอ่าน ภาคที่วางแผน หน่วยกิต วันสอบและคาบ |
| ru_study_terms | ชื่อภาคและเพดานหน่วยกิตเพื่อวางแผน |
| ru_study_lessons | ชื่อและเนื้อหารายบท; `content` มี sections, cards, questions, easy |
| ru_study_exam_guides | รูปแบบฝึก หัวข้อ ตำรา และคำถามแบบฝึกแต่ละวิชา |
| ru_study_class_schedules | วันประจำสัปดาห์ เวลา ห้องเรียน และหน้าต้นฉบับ |
| ru_study_settings | config: แหล่งข้อมูลและช่วงปฏิทิน / counts: จำนวนรายการที่คาด / updated: วันที่แก้เนื้อหา |

วันฐานข้อมูลใช้ ค.ศ. เช่น `2027-03-12` แอปแสดง พ.ศ. และใช้เวลา Asia/Bangkok
weekday: 0 อาทิตย์ … 6 เสาร์ เวลาเรียน `11:10` ไม่ใช่เลขทศนิยม
ID บท เช่น `POL1101-1` ต้องคงเดิม เพื่อเก็บความคืบหน้าและสมุดจดของผู้ใช้
เมื่อเพิ่ม/ลบจำนวนรายการ ต้องแก้ counts ใน transaction เดียวกัน เพื่อไม่รับข้อมูลที่ขาดบางส่วนมาแทนชุดเดิม
เมื่อแก้เนื้อหาให้ปรับ updated เป็นวันที่แก้จริง แล้วกด “โหลดเนื้อหาล่าสุด” ในหน้า ตั้งค่า

## การทำงานเมื่อเครือข่ายมีปัญหา

Supabase → สำเนาที่เคยอ่านสำเร็จและตรวจรูปแบบแล้ว → `content.snapshot.json`
สำเนาครบทุกบทอยู่กับเว็บเพื่อให้อ่านต่อได้เมื่อ API ขัดข้อง ไม่ใช่การซิงก์ข้อมูลส่วนตัว
เมื่อต่อ Supabase แล้วจะมีแถบแจ้งชัดหากกำลังใช้ข้อมูลสำรอง ไม่แสดงว่าอัปเดตล่าสุดสำเร็จ
แก้เนื้อหาจากฐานข้อมูลได้โดยไม่ต้องแก้ HTML/JavaScript; อัปเดตไฟล์สำรองเป็นช่วง ๆ ก่อนเผยแพร่รอบถัดไป

## ความเป็นส่วนตัว

ตารางเนื้อหาเปิดอ่านได้ แต่ anonymous/authenticated เขียนไม่ได้
ตาราง workspace และรูปอ่าน/เขียนได้เฉพาะเจ้าของที่ผ่าน Supabase Auth
ฝั่งหน้าเว็บใช้เฉพาะ publishable key ไม่ใช้ service_role/secret key
ไม่มีการย้ายข้อมูลส่วนตัวจากอุปกรณ์ของผู้ใช้โดย agent ข้อมูลจะซิงก์จากแอปหลังผู้ใช้เข้าสู่บัญชี

## การทดสอบที่ยังไม่ได้ทำ

ยังไม่ได้เข้า Google ด้วยบัญชีผู้ใช้ ยังไม่ได้ทำ browser QA กับการเลือกข้อความ/วางรูป/print layout บนอุปกรณ์จริง รุ่นนี้ผ่าน automated logic/render tests และการทดสอบฐานข้อมูลจริง
