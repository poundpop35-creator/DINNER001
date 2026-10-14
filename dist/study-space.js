import {supabaseConfig as config} from './supabase-config.js?v=20261014b';
import {freshState,validateState} from './core.js?v=20261014b';
import {freshNotebook,validateEnvelope,validateNotebook,referencedImages} from './notebook-core.js?v=20261014b';
import {getImage,putImage} from './image-store.js?v=20261014b';
export const workspaceKey=id=>'ru-study-workspace.v1:'+id;
const scriptLoads=new Map();
export function loadScript(src){if(!scriptLoads.has(src))scriptLoads.set(src,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{scriptLoads.delete(src);reject(Error('โหลดเครื่องมือไม่สำเร็จ กรุณาลองอีกครั้ง'));};document.head.append(s);}));return scriptLoads.get(src);}
const empty=()=>({version:1,progress:freshState(),notebook:freshNotebook()});
const message=err=>err?.code==='40001'?'ข้อมูลเปลี่ยนบนอีกเครื่อง เลือกฉบับที่จะใช้ในหน้าบัญชี':err?.message||'เชื่อมต่อไม่ได้ ข้อมูลยังอยู่ในเครื่อง';
export function createStudySpace({storage,progress,onProgress=()=>{},onChange=()=>{},onStatus=()=>{},clientFactory,settingsFetcher=fetch}){
 let scope='guest',user=null,client=null,revision=0,dirty=false,conflict=false,timer,busy=false,epoch=0,edit=0,locked=false,status='ใช้ข้อมูลในเครื่อง',lastSync='',providers={};
 let payload={...empty(),progress};
 function notify(){onStatus(api.info());}
 function restore(id,fallback){
  locked=false;
  try{const raw=storage.getItem(workspaceKey(id));if(!raw)return {payload:fallback,revision:0,dirty:false,lastSync:''};const v=JSON.parse(raw);return {payload:validateEnvelope(v.payload,validateState),revision:Number.isSafeInteger(v.revision)&&v.revision>=0?v.revision:0,dirty:v.dirty===true,lastSync:v.lastSync||''};}
  catch{locked=true;status='อ่านข้อมูลเดิมไม่ได้ หยุดบันทึกเพื่อป้องกันการเขียนทับ กรุณาส่งออกข้อมูล';return {payload:fallback,revision:0,dirty:false,lastSync:''};}
 }
 ({payload,revision,dirty,lastSync}=restore(scope,payload));
 payload.progress=progress;
 function persist(){if(locked){notify();return false;}try{storage.setItem(workspaceKey(scope),JSON.stringify({payload,revision,dirty,lastSync}));return true;}catch{status='บันทึกในเครื่องไม่สำเร็จ กรุณาส่งออกก่อนปิดหน้า';notify();return false;}}
 function changed(){edit++;dirty=true;const ok=persist();if(ok){status=user?'บันทึกในเครื่องแล้ว · รอซิงก์':'บันทึกในเครื่องแล้ว';notify();clearTimeout(timer);if(user)timer=setTimeout(()=>sync(),1200);}return ok;}
 async function fetchRemote(){const {data,error}=await client.from('ru_study_workspaces').select('payload,revision,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data;}
 async function sync(){
  if(!user||!client||busy||conflict||locked)return;
  const ticket=epoch,uid=user.id;busy=true;status='กำลังซิงก์…';notify();
  try{
   const remote=await fetchRemote();if(ticket!==epoch)return;
   if(remote&&remote.revision!==revision){
    if(dirty){conflict=true;throw {code:'40001'};}
    payload=validateEnvelope(remote.payload,validateState);revision=remote.revision;lastSync=remote.updated_at;persist();onProgress(payload.progress);onChange();
   }
   if(dirty){
    const snapshot=JSON.parse(JSON.stringify(payload)),savedEdit=edit;
    // Upload every referenced local image before committing a note that references it.
    for(const id of referencedImages(snapshot.notebook)){
     if(remote&&referencedImages(remote.payload.notebook).includes(id))continue;
     const blob=await getImage(scope,id);if(ticket!==epoch)return;
     if(!blob)throw Error('รูปบางรูปยังไม่อยู่ในเครื่อง จึงยังไม่ส่งโน้ตขึ้นคลาวด์');
     if(blob){const {error}=await client.storage.from('ru-study-notes').upload(uid+'/'+id,blob,{contentType:blob.type,upsert:false});if(error&&!['409','Duplicate'].includes(String(error.statusCode||error.error))&&!/already exists|duplicate/i.test(error.message||''))throw error;}
    }
    const {data,error}=await client.rpc('ru_study_save_workspace',{expected_revision:revision,new_payload:snapshot});if(error)throw error;if(ticket!==epoch)return;
    revision=data.revision;lastSync=data.updated_at;dirty=edit!==savedEdit;persist();
   }
   status=dirty?'บันทึกในเครื่องแล้ว · รอซิงก์':'ซิงก์แล้ว';notify();
  }catch(err){if(ticket!==epoch)return;if(err.code==='40001')conflict=true;status=message(err);notify();}
  finally{busy=false;if(ticket!==epoch&&user){setTimeout(()=>sync(),0);}if(ticket===epoch&&dirty&&!conflict&&status==='บันทึกในเครื่องแล้ว · รอซิงก์')timer=setTimeout(()=>sync(),1200);}
 }
 async function switchUser(next){
  if((next?.id||'guest')===scope){user=next;return;}
  clearTimeout(timer);epoch++;edit=0;user=next;scope=user?.id||'guest';conflict=false;
  ({payload,revision,dirty,lastSync}=restore(scope,scope==='guest'?{...empty(),progress:progress}:empty()));
  status=locked?status:user?'กำลังโหลดข้อมูลบัญชี…':'ใช้ข้อมูลในเครื่อง';onProgress(payload.progress);onChange();notify();
  if(user)await sync();
 }
 const api={
  dispose(){clearTimeout(timer);epoch++;},
  info:()=>({scope,user,status,lastSync,dirty,conflict,locked,providers,ready:!!client}),
  notebook:()=>payload.notebook,
  snapshot:()=>JSON.parse(JSON.stringify(payload)),
  saveProgress(value){const next=validateState(value);if(JSON.stringify(next)===JSON.stringify(payload.progress))return !locked;payload.progress=next;return changed();},
  saveNotebook(value){payload.notebook=validateNotebook(value);return changed();},
  sync,
  async init(){
   try{
    if(clientFactory)client=await clientFactory();else{await loadScript('./vendor/supabase-2.117.3.js');client=globalThis.supabase.createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'ru-study-auth:'+config.url}});}
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>switchUser(session?.user||null),0);});
    const {data,error}=await client.auth.getSession();if(error)throw error;await switchUser(data.session?.user||null);
    const r=await settingsFetcher(config.url+'/auth/v1/settings',{headers:{apikey:config.publishableKey}});if(r.ok)providers=(await r.json()).external||{};notify();
    window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();});
   }catch(err){status=message(err);notify();}
  },
  async signIn(email,password){if(!client)throw Error('ระบบบัญชียังไม่พร้อม กรุณาโหลดหน้าใหม่');const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;},
  async signUp(email,password){if(!client)throw Error('ระบบบัญชียังไม่พร้อม');const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;return !!data.session;},
  async google(){if(!providers.google)throw Error('ยังไม่เปิด Google ใน Supabase Authentication');const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;},
  async signOut(){if(dirty||busy)await sync();if(dirty||busy||conflict)throw Error('ยังมีข้อมูลไม่ซิงก์ กรุณาซิงก์หรือส่งออกสำรองก่อนออกจากระบบ');const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await switchUser(null);},
  async resolve(useLocal){
   if(!user||!conflict)return;const ticket=epoch,remote=await fetchRemote();if(ticket!==epoch)return;
   if(remote){storage.setItem(workspaceKey(scope)+':recovery:'+Date.now(),JSON.stringify({local:payload,remote:remote.payload}));if(!useLocal){payload=validateEnvelope(remote.payload,validateState);dirty=false;onProgress(payload.progress);onChange();}revision=remote.revision;}
   conflict=false;persist();await sync();
  },
  async importGuest(){
   if(!user)throw Error('เข้าสู่ระบบก่อน');const raw=storage.getItem(workspaceKey('guest'));let guest=raw?validateEnvelope(JSON.parse(raw).payload,validateState):{...empty(),progress};
   for(const id of referencedImages(guest.notebook)){const b=await getImage('guest',id);if(b)await putImage(scope,id,b);}
   // Keep guest data and keep a recovery copy before an explicit replacement.
   storage.setItem(workspaceKey(scope)+':before-import:'+Date.now(),JSON.stringify(payload));payload=guest;changed();onProgress(payload.progress);onChange();await sync();
  },
  async image(id){let b=await getImage(scope,id);if(!b&&user){const {data,error}=await client.storage.from('ru-study-notes').download(user.id+'/'+id);if(error)throw error;b=data;await putImage(scope,id,b);}if(!b)throw Error('ยังไม่มีรูปนี้ในเครื่อง กรุณาเข้าสู่บัญชีที่บันทึกไว้');return b;},
  async importSnapshot(value,images={}){const next=validateEnvelope(value,validateState);for(const id of referencedImages(next.notebook)){if(images[id]){const blob=await (await fetch(images[id])).blob();await putImage(scope,id,blob);}}storage.setItem(workspaceKey(scope)+':before-import:'+Date.now(),JSON.stringify(payload));payload=next;changed();onProgress(payload.progress);onChange();}
 };
 return api;
}
