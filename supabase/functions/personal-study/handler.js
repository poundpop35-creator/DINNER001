const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'content-type,apikey,x-study-key',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'
};
const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
const imagePattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/i;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
async function limitedBody(req,max){
 if(Number(req.headers.get('content-length'))>max)throw {status:413};
 const chunks=[];let size=0;const reader=req.body?.getReader();
 if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw {status:413};}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
// Custom authentication: a 256-bit secret is required for EVERY data operation.
// The database stores only SHA-256(secret); URLs and logs never receive the key.
export function createHandler(admin){return async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 try{
  const key=req.headers.get('x-study-key')||'';
  if(!/^[0-9a-f]{64}$/.test(key))return json({error:'ไม่มีลิงก์ส่วนตัวที่ถูกต้อง'},401);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const route=new URL(req.url).pathname.split('/personal-study').pop();
  const table=()=>admin.from('ru_study_personal_spaces');
  let {data:space,error}=await table().select('id,revision,updated_at').eq('key_hash',hash).maybeSingle();
  if(error)throw error;
  if(route==='/open'&&req.method==='POST'){
   if(!space){
    const inserted=await table().insert({key_hash:hash}).select('id,revision,updated_at').single();
    if(inserted.error?.code==='23505'){
     const found=await table().select('id,revision,updated_at').eq('key_hash',hash).single();
     if(found.error)throw found.error;space=found.data;
    }else {if(inserted.error)throw inserted.error;space=inserted.data;}
   }
   return json({id:space.id});
  }
  if(!space)return json({error:'ไม่พบข้อมูลสำหรับลิงก์นี้'},404);
  if(route==='/workspace'&&req.method==='GET'){
   const {data,error}=await table().select('payload,revision,updated_at').eq('id',space.id).single();
   if(error)throw error;return json(data.payload?data:null);
  }
  if(route==='/workspace'&&req.method==='POST'){
   let body;try{body=JSON.parse(new TextDecoder().decode(await limitedBody(req,4194304)));}catch(err){if(err.status)throw err;return json({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}
   const {expected_revision,new_payload}=body;
   if(!Number.isSafeInteger(expected_revision)||expected_revision<0||!new_payload||new_payload.version!==1||typeof new_payload.progress!=='object'||!new_payload.progress||!Array.isArray(new_payload.notebook?.notes))return json({error:'รูปแบบพื้นที่เรียนไม่ถูกต้อง'},400);
   if(expected_revision!==space.revision)return json({error:'มีข้อมูลใหม่จากอีกเครื่อง',code:'40001'},409);
   const {data,error}=await table().update({payload:new_payload,revision:expected_revision+1,updated_at:new Date().toISOString()}).eq('id',space.id).eq('revision',expected_revision).select('revision,updated_at').maybeSingle();
   if(error)throw error;if(!data)return json({error:'มีข้อมูลใหม่จากอีกเครื่อง',code:'40001'},409);return json(data);
  }
  if(route.startsWith('/image/')){
   const id=route.slice(7);if(!imagePattern.test(id))return json({error:'ชื่อรูปไม่ถูกต้อง'},400);
   const bucket=admin.storage.from('ru-study-personal-notes'),path=space.id+'/'+id;
   if(req.method==='POST'){
    const type=req.headers.get('content-type')||'';
    if(!types[type]||!id.endsWith('.'+types[type]))return json({error:'ชนิดรูปไม่ถูกต้อง'},415);
    const bytes=await limitedBody(req,5242880);if(!bytes.length)return json({error:'รูปว่าง'},400);
    const {error}=await bucket.upload(path,bytes,{contentType:type,upsert:false});
    if(error&&!['409','Duplicate'].includes(String(error.statusCode||error.error))&&!/already exists|duplicate/i.test(error.message||''))throw error;
    return json({ok:true});
   }
   if(req.method==='GET'){
    const {data,error}=await bucket.download(path);if(error)return json({error:'ไม่พบรูปในห้องเรียนนี้'},404);
    return new Response(data,{headers:{...cors,'Content-Type':data.type}});
   }
  }
  return json({error:'ไม่พบรายการที่ต้องการ'},404);
 }catch(err){return json({error:err.status===413?'ไฟล์ใหญ่เกินขนาดที่รองรับ':'เชื่อมต่อพื้นที่เรียนไม่สำเร็จ กรุณาลองอีกครั้ง'},err.status||503);}
};}
