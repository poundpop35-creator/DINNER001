export function memoryStorage(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
export function cloudFixture(){
 const owner={id:'user-a',email:'student@example.test'},rows=new Map(),images=new Map(),calls=[];
 let authUser=owner,failure=null;
 const client={
  auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:authUser?{user:authUser}:null}};},async signOut(){authUser=null;return {};},async signInWithPassword(){authUser=owner;return {data:{user:owner}};}},
  from:()=>({select:()=>({eq:(_key,id)=>({maybeSingle:async()=>({data:rows.has(id)?structuredClone(rows.get(id)):null,error:failure})})})}),
  async rpc(_name,{expected_revision,new_payload}){if(failure)return {error:failure};calls.push('workspace');if(expected_revision!==(rows.get(authUser.id)?.revision||0))return {error:{code:'40001'}};const row={payload:structuredClone(new_payload),revision:expected_revision+1,updated_at:new Date().toISOString()};rows.set(authUser.id,row);return {data:row};},
  storage:{from:bucket=>({async upload(path,file){if(failure)return {error:failure};calls.push('image');images.set(bucket+'/'+path,file);return {};},async download(path){if(failure)return {error:failure};calls.push('download');const data=images.get(bucket+'/'+path);return data?{data}:{error:Error('Missing image')};}})}
 };
 return {client,owner,rows,images,calls,setUser:u=>authUser=u,fail:err=>failure=err};
}
export function imageCache(){const images=new Map();return {get:async(scope,id)=>images.get(scope+'/'+id),put:async(scope,id,blob)=>images.set(scope+'/'+id,blob)};}
export const settingsFetcher=async()=>({ok:true,json:async()=>({external:{google:false,email:true}})});
