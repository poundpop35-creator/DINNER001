// Database content and personal progress have separate storage keys and lifecycles.
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const day = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(x+'T12:00:00Z').toISOString().slice(0,10) === x;
const text = x => typeof x === 'string';
const strings = x => Array.isArray(x) && x.every(text);
const webURL = x => { try { return ['https:','http:'].includes(new URL(x).protocol); } catch { return false; } };
function requireValue(ok, message) { if (!ok) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: '+message); }
export function validateCatalog(c) {
 requireValue(plain(c) && c.version===1 && day(c.updated),'version');
 requireValue(plain(c.config) && plain(c.config.meta) && plain(c.config.calendar),'settings');
 for (const key of ['courses','terms','lessons','schedules']) requireValue(Array.isArray(c[key]) && c[key].length>0,key);
 requireValue(plain(c.counts)&&['courses','terms','lessons','schedules','prep'].every(key=>Number.isInteger(c.counts[key])&&c.counts[key]>0&&Object.keys(c[key]||{}).length===c.counts[key]),'catalog counts');
 const unique=(rows,key)=>new Set(rows.map(r=>r[key])).size===rows.length;
 requireValue(unique(c.courses,'id') && unique(c.lessons,'id') && unique(c.terms,'id') && unique(c.schedules,'id'),'duplicate ID');
 const courseIds=new Set(c.courses.map(x=>x.id)), termIds=new Set(c.terms.map(x=>x.id));
 requireValue(c.terms.every(t=>Number.isInteger(t.id)&&text(t.name)&&text(t.label)&&Number.isInteger(t.cap)&&t.cap>0),'terms');
 requireValue(c.courses.every(x=>/^POL\d{4}$/.test(x.id)&&text(x.title)&&text(x.reason)&&termIds.has(x.term)&&Number.isInteger(x.credits)&&x.credits>0&&typeof x.enrolled==='boolean'&&['core','required','elective','faculty'].includes(x.category)&&['หนัก','กลาง','เบากว่า'].includes(x.load)&&((x.exam===null&&x.slot===null)||(day(x.exam)&&['A','B'].includes(x.slot)))),'courses');
 const questions=qs=>Array.isArray(qs)&&qs.every(q=>text(q.prompt)&&strings(q.options)&&q.options.length>=2&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length&&text(q.explanation));
 requireValue(c.lessons.every(l=>courseIds.has(l.course)&&l.id===`${l.course}-${l.n}`&&Number.isInteger(l.n)&&l.n>0&&text(l.title)&&text(l.intro)&&text(l.trap)&&text(l.reflection)&&Number.isFinite(l.minutes)&&Array.isArray(l.sections)&&l.sections.every(s=>text(s.heading)&&text(s.body))&&plain(l.example)&&text(l.example.situation)&&text(l.example.analysis)&&Array.isArray(l.cards)&&l.cards.every(x=>text(x.front)&&text(x.back))&&questions(l.questions)&&plain(l.easy)&&text(l.easy.one)&&strings(l.easy.points)&&text(l.easy.analogy)&&text(l.easy.remember)&&Array.isArray(l.easy.terms)&&l.easy.terms.every(t=>strings(t)&&t.length===2)),'lessons');
 requireValue(c.courses.filter(x=>x.enrolled).every(x=>c.lessons.some(l=>l.course===x.id)),'enrolled course without lessons');
 requireValue(plain(c.prep)&&Object.entries(c.prep).every(([code,g])=>courseIds.has(code)&&plain(g)&&text(g.format)&&text(g.textbook)&&strings(g.topics)&&strings(g.seen)&&strings(g.tips)&&questions(g.questions)&&Array.isArray(g.links)&&g.links.every(l=>strings(l)&&l.length===2&&webURL(l[1]))),'exam guides');
 const time=x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
 requireValue(c.schedules.every(s=>courseIds.has(s.course)&&Number.isInteger(s.weekday)&&s.weekday>=0&&s.weekday<=6&&time(s.startTime)&&time(s.endTime)&&s.startTime<s.endTime&&text(s.room)&&Number.isInteger(s.page)),'class schedules');
 const cfg=c.config,cal=cfg.calendar;
 requireValue(day(cal.lectureStart)&&day(cal.lectureEnd)&&cal.lectureStart<=cal.lectureEnd&&day(cal.examStart)&&day(cal.examEnd)&&day(cal.verified)&&cal.timezone==='Asia/Bangkok'&&Array.isArray(cal.exceptions)&&cal.exceptions.every(x=>day(x.start)&&day(x.end)&&x.start<=x.end&&['cancelled','check'].includes(x.kind)&&text(x.title)),'calendar');
 requireValue(plain(cfg.categories)&&plain(cfg.categoryTargets)&&strings(cfg.courseColors)&&cfg.courseColors.every(x=>/^#[0-9a-f]{6}$/i.test(x)),'categories');
 requireValue(Array.isArray(cfg.sources)&&cfg.sources.every(s=>text(s.title)&&text(s.detail)&&(s.url===null||webURL(s.url))&&(!s.listingUrl||webURL(s.listingUrl))&&(!s.backupUrl||/^\.\/sources\/[a-z0-9.-]+\.pdf$/.test(s.backupUrl))),'sources');
 requireValue(Array.isArray(cfg.readingWeek)&&cfg.readingWeek.length===7&&cfg.readingWeek.every(x=>strings(x)&&courseIds.has(x[1])&&courseIds.has(x[2]))&&Array.isArray(cfg.studyPhases)&&cfg.studyPhases.length===4&&Array.isArray(cfg.studyHours),'study rhythm');
 return c;
}
export function contentCacheKey(config) { return 'ru-study-catalog.v1:'+(config.url||'snapshot'); }
export async function loadContent({config,fetcher=fetch,storage,fallback,timeout=8000}) {
 let failure=null;
 if (config.url && config.publishableKey) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try {
   const url=new URL(config.url);
   requireValue(url.protocol==='https:' && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && url.pathname==='/' && !url.username && !url.password,'Supabase URL');
   requireValue(config.publishableKey.startsWith('sb_publishable_'),'publishable key');
   const response=await fetcher(`${url.origin}/rest/v1/rpc/ru_study_catalog`,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}',signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('อ่านฐานข้อมูลไม่สำเร็จ');
   const catalog=validateCatalog(await response.json());
   try { storage?.setItem(contentCacheKey(config),JSON.stringify(catalog)); } catch { /* Reading still works when cache is full. */ }
   return {catalog,source:'supabase',warning:null};
  } catch { failure='เชื่อมต่อข้อมูลล่าสุดไม่ได้ กำลังใช้สำเนาเดิม ตรวจประกาศมหาวิทยาลัยก่อนเดินทางหรือสอบ'; }
  finally { clearTimeout(timer); }
 }
 let cached=null;
 if(failure)try{cached=validateCatalog(JSON.parse(storage?.getItem(contentCacheKey(config))||'null'));}catch{/* Invalid cache must not replace a complete catalog. */}
 let snapshot;
 try{snapshot=validateCatalog(await fallback());}catch(error){if(cached)return {catalog:cached,source:'cache',warning:failure};throw error;}
 if(cached&&cached.updated>=snapshot.updated)return {catalog:cached,source:'cache',warning:failure};
 return {catalog:snapshot,source:'snapshot',warning:failure};
}
