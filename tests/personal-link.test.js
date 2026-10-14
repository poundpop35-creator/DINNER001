import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalClient,personalKey} from '../dist/personal-client.js';
import {createStudySpace} from '../dist/study-space.js';
import {freshState} from '../dist/core.js';
import {newNote} from '../dist/notebook-core.js';
import {memoryStorage,imageCache,cloudFixture,personalFetcher} from './cloud-fixture.js';
import {createHandler} from '../supabase/functions/personal-study/handler.js';
const location=(hash='')=>({origin:'https://study.example.test',pathname:'/',search:'',hash});
test('a private link is generated once, remembered, and never added to request URLs',async()=>{
 const storage=memoryStorage(),requests=[];
 const fetcher=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({id:'space-a'}));};
 const first=createPersonalClient({storage,location:location(),fetcher});await first.auth.getSession();
 const key=storage.getItem(personalKey);assert.match(key,/^[0-9a-f]{64}$/);
 const second=createPersonalClient({storage,location:location(),fetcher});assert.equal(second.access().url,first.access().url);
 assert.equal(requests[0].options.headers['x-study-key'],key);assert.ok(!requests[0].url.includes(key));
});
test('a second device opens the original cloud workspace from its private link, including images',async()=>{
 const cloud=cloudFixture(),fetcher=personalFetcher(cloud),storeA=memoryStorage(),storeB=memoryStorage();
 const clientA=createPersonalClient({storage:storeA,location:location(),fetcher});
 const a=createStudySpace({storage:storeA,progress:freshState(),clientFactory:()=>clientA,imageStore:imageCache()});await a.init();
 const id=await a.uploadImage(new Blob(['image'],{type:'image/png'}));const n=newNote({id:'personal',text:'Private online note'});n.delta.ops.push({insert:{studyImage:id}});
 a.saveNotebook({version:1,notes:[n]});await a.sync();
 let replaced='';const clientB=createPersonalClient({storage:storeB,location:location(new URL(clientA.access().url).hash),history:{replaceState:(_a,_b,url)=>replaced=url},fetcher});
 const b=createStudySpace({storage:storeB,progress:freshState(),clientFactory:()=>clientB,imageStore:imageCache()});await b.init();
 assert.equal(storeA.getItem(personalKey),storeB.getItem(personalKey));assert.equal(replaced,'/#home');assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(await (await b.image(id)).text(),'image');
 a.dispose();b.dispose();
});
test('storage-blocked devices retain a recoverable private link for the current session',()=>{
 const client=createPersonalClient({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},location:location()});
 assert.equal(client.access().remembered,false);assert.match(client.access().url,/#space=[a-f0-9]{64}$/);
});
test('edge handler rejects absent or invalid capabilities before touching the database',async()=>{
 const handler=createHandler({from(){throw Error('must not query');}});
 for(const key of ['', 'guess', '../other-space']){
  const response=await handler(new Request('https://test.invalid/personal-study/workspace',{headers:{'x-study-key':key}}));assert.equal(response.status,401);
 }
 const response=await handler(new Request('https://test.invalid/personal-study/workspace',{method:'OPTIONS'}));assert.equal(response.status,204);
});
