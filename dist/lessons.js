// Lessons come from the content catalog (Supabase, or the bundled snapshot) plus deep content shipped with the app in dist/deep/.
// Part 1 (n = 1–5): catalog lessons with the "เจาะลึก" additions appended. Part 2 (n ≥ 6): full textbook-based lessons.
import {catalog} from './content.js?v=20261014g';
import {deep} from './deep/index.js?v=20261014g';
const cardsOf=list=>(list||[]).map(([front,back])=>({front,back}));
const questionsOf=list=>(list||[]).map(([prompt,options,answer,explanation])=>({prompt,options,answer,explanation}));
const sectionsOf=(list,isDeep)=>(list||[]).map(({heading,body,list,table})=>({heading,body,list:list||null,table:table||null,deep:isDeep}));
// Reading time: about 450 Thai characters a minute for study reading, plus a few minutes for the quiz, rounded to 5.
const minutesOf=l=>{const chars=[l.hook,l.intro,...l.sections.flatMap(s=>[s.body,...(s.list||[]),...(s.table?s.table.rows.flat():[])]),l.example.situation,l.example.analysis,l.trap].join('').length;return Math.max(10,Math.round((chars/450+3)/5)*5);};
// Labels are added by the page, so drop any written into the text.
const unlabel=t=>String(t||'').replace(/^(เปิดเรื่อง|ชวนอ่านต่อ|บทถัดไป)\s*[:：]\s*/,'');
const plainRefs=list=>(list||[]).map(({title,detail,url})=>({title,detail,url:typeof url==='string'&&/^https?:\/\/[^\s"'<>]+$/.test(url)?url:null}));
const reflection='ลองอธิบายแนวคิดในบทนี้ด้วยภาษาของตัวเอง พร้อมยกตัวอย่างใหม่หนึ่งกรณี และบอกข้อจำกัดของคำอธิบายนั้น';
// Card and question order is append-only so saved flashcard reviews and answers keep pointing at the same items.
function part1(l){
 const plain={...l,part:1,hook:'',sections:l.sections.map(s=>({...s,list:null,table:null,deep:false})),refs:[],teaser:''};
 const x=deep.expand[l.course]?.[l.n];if(!x)return plain;
 const out={...plain,hook:unlabel(x.hook),sections:[...plain.sections,...sectionsOf(x.sections,true)],cards:[...l.cards,...cardsOf(x.cards)],questions:[...l.questions,...questionsOf(x.questions)],refs:plainRefs(x.refs),teaser:unlabel(x.teaser)};
 return {...out,minutes:minutesOf(out)};
}
function part2(course,l){
 const out={id:`${course}-${l.n}`,course,n:l.n,part:2,title:l.title,intro:l.intro,hook:unlabel(l.hook),sections:sectionsOf(l.sections,false),example:{situation:l.example.situation,analysis:l.example.analysis},trap:l.trap,easy:l.easy,cards:[...cardsOf(l.cards),...cardsOf(l.easy?.terms)],questions:questionsOf(l.questions),refs:plainRefs(l.refs),teaser:unlabel(l.teaser),reflection};
 return {...out,minutes:minutesOf(out)};
}
const catalogIds=new Set(catalog.lessons.map(l=>l.id));
const courseOrder=[...new Set(catalog.lessons.map(l=>l.course))];
// A lesson the catalog already holds (edited in the database) wins over the bundled copy with the same ID.
export const lessons=courseOrder.flatMap(course=>[...catalog.lessons.filter(l=>l.course===course).map(part1),...(deep.lessons[course]||[]).filter(l=>!catalogIds.has(`${course}-${l.n}`)).map(l=>part2(course,l))]);
