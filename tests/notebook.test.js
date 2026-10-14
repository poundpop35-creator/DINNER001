import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDelta,deltaText,validateNotebook,newNote,findNotes,legacyNotes,referencedImages,validateEnvelope} from '../dist/notebook-core.js';
import {freshState,validateState} from '../dist/core.js';
import {createStudySpace,workspaceKey} from '../dist/study-space.js';

test('note round trip preserves Thai, color, highlight, image IDs, recall and course links',()=>{
 const n=newNote({course:'POL1101',lesson:'POL1101-1',title:'รัฐกับรัฐบาล'}),id='123e4567-e89b-12d3-a456-426614174000.png';
 n.delta={ops:[{insert:'อำนาจอธิปไตย',attributes:{bold:true,color:'#1d4ed8',background:'#fef08a'}},{insert:'\n'},{insert:{studyImage:id}},{insert:'\n'}]};n.question='รัฐคืออะไร';n.answer='องค์ประกอบของรัฐ';
 const copy=validateNotebook(JSON.parse(JSON.stringify({version:1,notes:[n]})));
 assert.deepEqual(copy.notes[0],n);assert.deepEqual(referencedImages(copy),[id]);assert.ok(deltaText(n.delta).includes('อำนาจอธิปไตย'));
});
test('unsafe HTML, URLs, embeds and formatting cannot become executable note content',()=>{
 const d=cleanDelta({ops:[{insert:'<script>alert(1)</script>',attributes:{link:'javascript:alert(1)',color:'url(evil)',onclick:'evil',background:'#fef08a'}},{insert:{image:'https://tracker.test/x'}},{insert:{video:'javascript:x'}},{insert:{studyImage:'../../other-user/file.png'}}]});
 assert.equal(d.ops.length,2);assert.deepEqual(d.ops[0].attributes,{background:'#fef08a'});assert.equal(d.ops[0].insert,'<script>alert(1)</script>');
 assert.throws(()=>cleanDelta({ops:[{insert:'x'.repeat(200001)}]}));
});
test('search, pinning, archive and legacy copy do not discard original lesson notes',()=>{
 const a=newNote({id:'a',title:'หนึ่ง',course:'POL1101',text:'รัฐบาล'}),b=newNote({id:'b',title:'สอง'}),c=newNote({id:'c',title:'เก่า'});b.pinned=true;c.archived=true;
 const book={version:1,notes:[a,b,c]};assert.deepEqual(findNotes(book).map(n=>n.id),['b','a']);assert.deepEqual(findNotes(book,{query:'รัฐบาล'}).map(n=>n.id),['a']);assert.deepEqual(findNotes(book,{archived:true}).map(n=>n.id),['c']);
 const p=freshState();p.notes['POL1101-1']='ต้นฉบับ';assert.equal(legacyNotes(p,[])[0].id,'legacy-POL1101-1');assert.equal(p.notes['POL1101-1'],'ต้นฉบับ');
});
test('guest notebook persists separately from progress key and preserves formatting after reload',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const one=createStudySpace({storage,progress:freshState()});const book=one.notebook();book.notes.push(newNote({id:'n1',text:'อ่านตอนเย็น'}));assert.equal(one.saveNotebook(book),true);
 const two=createStudySpace({storage,progress:freshState()});assert.equal(deltaText(two.notebook().notes[0].delta),'อ่านตอนเย็น\n');assert.ok(map.has(workspaceKey('guest')));assert.equal(map.has('ru-study-planner.v1'),false);
 assert.equal(validateEnvelope(two.snapshot(),validateState).notebook.notes.length,1);
});
test('corrupt and quota-limited notebook storage is reported without silently replacing old data',()=>{
 const map=new Map([[workspaceKey('guest'),'BROKEN']]),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};const s=createStudySpace({storage,progress:freshState()});s.notebook().notes.push(newNote());assert.equal(s.saveNotebook(s.notebook()),false);assert.equal(map.get(workspaceKey('guest')),'BROKEN');assert.equal(s.info().locked,true);
 const full=createStudySpace({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},progress:freshState()});assert.equal(full.saveNotebook(full.notebook()),false);assert.match(full.info().status,/ไม่สำเร็จ/);
});

test('cloud sync detects concurrent edits, keeps local work, and isolates account caches',async()=>{
 globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){}};
 const local=new Map(),storage={getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)};
 const owner={id:'user-a',email:'a@example.test'};let remote=null,calls=0;
 const client={auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:owner}}};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:remote?structuredClone(remote):null,error:null})})})}),async rpc(_name,{expected_revision,new_payload}){calls++;if(expected_revision!==(remote?.revision||0))return {error:{code:'40001'}};remote={payload:structuredClone(new_payload),revision:expected_revision+1,updated_at:new Date().toISOString()};return {data:remote};}};
 const space=createStudySpace({storage,progress:freshState(),clientFactory:async()=>client,settingsFetcher:async()=>({ok:true,json:async()=>({external:{google:false}})})});
 await space.init();assert.equal(space.info().scope,'user-a');assert.equal(space.notebook().notes.length,0);
 const book=space.notebook();book.notes.push(newNote({id:'mine',text:'ฉบับเครื่องนี้'}));space.saveNotebook(book);await space.sync();assert.equal(calls,1);assert.equal(remote.revision,1);assert.equal(space.info().dirty,false);
 remote.revision=2;remote.payload.notebook.notes[0].title='แก้จากอีกเครื่อง';
 const changed=space.notebook();changed.notes[0].title='งานที่ยังไม่ซิงก์';space.saveNotebook(changed);await space.sync();assert.equal(space.info().conflict,true);assert.equal(calls,1);assert.equal(space.notebook().notes[0].title,'งานที่ยังไม่ซิงก์');
 await space.resolve(true);assert.equal(remote.payload.notebook.notes[0].title,'งานที่ยังไม่ซิงก์');assert.equal(remote.revision,3);assert.ok([...local.keys()].some(k=>k.includes(':recovery:')));assert.ok(local.has(workspaceKey('user-a')));assert.equal(local.has(workspaceKey('user-b')),false);space.dispose();
});
