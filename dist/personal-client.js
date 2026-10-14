import {supabaseConfig as config} from './supabase-config.js';
export const personalKey='ru-study-personal-link.v1';
const valid=key=>/^[0-9a-f]{64}$/.test(key||'');
export function createPersonalClient({storage,location=globalThis.location,history=globalThis.history,fetcher=fetch}={}){
 let key='',user=null,remembered=false;
 const incoming=/^#space=([0-9a-f]{64})$/.exec(location?.hash||'')?.[1];
 try{key=incoming||storage.getItem(personalKey)||'';}catch{key=incoming||'';}
 if(!valid(key))key=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 try{storage.setItem(personalKey,key);remembered=true;}catch{}
 if(incoming&&remembered)history?.replaceState?.(null,'',location.pathname+location.search+'#home');
 if(!remembered)history?.replaceState?.(null,'',(location?.pathname||'/')+(location?.search||'')+'#space='+key);
 const base=(location?.origin||'')+(location?.pathname||'/');
 const access=()=>({url:base+'#space='+key,remembered});
 async function request(path,{body,method='GET',type='application/json',binary=false}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetcher(config.url+'/functions/v1/personal-study'+path,{method,headers:{apikey:config.publishableKey,'x-study-key':key,...(body!==undefined?{'Content-Type':type}:{})},body:body===undefined?undefined:type==='application/json'?JSON.stringify(body):body,signal:controller.signal});
   if(!response.ok){const detail=await response.json().catch(()=>({}));return {error:{message:detail.error||'เชื่อมต่อ Supabase ไม่สำเร็จ',code:detail.code,statusCode:String(response.status)}};}
   return {data:binary?await response.blob():await response.json()};
  }catch(err){return {error:{message:err.name==='AbortError'?'เชื่อมต่อ Supabase หมดเวลา กรุณาลองอีกครั้ง':err.message}};}
  finally{clearTimeout(timer);}
 }
 return {
  personal:true,access,
  auth:{
   onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},
   async getSession(){const r=await request('/open',{method:'POST'});if(r.error)return r;user={id:r.data.id};return {data:{session:{user}}};}
  },
  from(){return {select:()=>({eq:()=>({maybeSingle:()=>request('/workspace')})})};},
  rpc(_name,body){return request('/workspace',{method:'POST',body});},
  storage:{from:()=>({
   upload(path,body){return request('/image/'+path.split('/').pop(),{method:'POST',body,type:body.type});},
   download(path){return request('/image/'+path.split('/').pop(),{binary:true});}
  })}
 };
}
