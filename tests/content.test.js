import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/content.js';
import {validateCatalog,loadContent,contentCacheKey} from '../dist/content-client.js';
const config={url:'https://test-project.supabase.co',publishableKey:'sb_publishable_TEST_PUBLIC_KEY'};
const clone=()=>structuredClone(catalog), memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),m};};
test('Supabase success uses remote content, caches only content and makes one read-only RPC',async()=>{
 const storage=memory();storage.setItem('ru-study-planner.v1','private progress');const remote=clone();remote.lessons[0].title='เนื้อหาจากฐานข้อมูล';let calls=0;
 const result=await loadContent({config,storage,fallback:async()=>{throw Error('unused');},fetcher:async(url,options)=>{calls++;assert.equal(url,config.url+'/rest/v1/rpc/ru_study_catalog');assert.equal(options.headers.apikey,config.publishableKey);assert.equal(options.body,'{}');assert.ok(!options.headers.Authorization);return {ok:true,json:async()=>remote};}});
 assert.equal(result.source,'supabase');assert.equal(result.catalog.lessons[0].title,'เนื้อหาจากฐานข้อมูล');assert.equal(calls,1);assert.equal(storage.getItem('ru-study-planner.v1'),'private progress');assert.ok(storage.getItem(contentCacheKey(config)));assert.equal(result.warning,null);
});
test('incomplete remote response cannot replace content or existing progress; snapshot remains readable',async()=>{
 const storage=memory(),broken=clone();broken.lessons.pop();const result=await loadContent({config,storage,fallback:async()=>clone(),fetcher:async()=>({ok:true,json:async()=>broken})});assert.equal(result.source,'snapshot');assert.ok(result.warning);assert.equal(result.catalog.lessons.length,35);assert.equal(storage.getItem(contentCacheKey(config)),undefined);
});
test('valid cache keeps reading available even when API and local snapshot fetch both fail',async()=>{
 const storage=memory();storage.setItem(contentCacheKey(config),JSON.stringify(clone()));const result=await loadContent({config,storage,fetcher:async()=>{throw Error('offline');},fallback:async()=>{throw Error('offline');}});assert.equal(result.source,'cache');assert.ok(result.warning);assert.equal(result.catalog.lessons.length,35);
});
test('no project configured makes no remote calls, and cache full does not block successful reading',async()=>{
 const result=await loadContent({config:{url:'',publishableKey:''},fallback:async()=>clone(),fetcher:async()=>{throw Error('must not call');}});assert.equal(result.source,'snapshot');assert.equal(result.warning,null);
 const remote=await loadContent({config,storage:{setItem(){throw Error('quota');}},fallback:async()=>clone(),fetcher:async()=>({ok:true,json:async()=>clone()})});assert.equal(remote.source,'supabase');
});
test('unsafe links, class times, keys and payloads fail closed to validated content',async()=>{
 const unsafe=clone();unsafe.prep.POL1101.links[0][1]='javascript:alert(1)';assert.throws(()=>validateCatalog(unsafe));
 const wrong=clone();wrong.schedules[0].startTime='99:00';assert.throws(()=>validateCatalog(wrong));
 let calls=0;const result=await loadContent({config:{...config,publishableKey:'sb_secret_NEVER_PUBLISH'},fallback:async()=>clone(),fetcher:async()=>{calls++;}});assert.equal(calls,0);assert.equal(result.source,'snapshot');assert.ok(result.warning);
});
