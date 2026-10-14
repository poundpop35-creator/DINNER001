import {imageId} from './notebook-core.js?v=20261014c';
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('ru-study-images',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('เปิดที่เก็บรูปในเครื่องไม่ได้'));});}
async function tx(mode,key,value){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('images',mode),s=t.objectStore('images');const r=mode==='readonly'?s.get(key):s.put(value,key);t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(Error('บันทึกรูปไม่ได้ พื้นที่เครื่องอาจเต็ม'));t.onabort=t.onerror;});}
export const getImage=(scope,id)=>tx('readonly',scope+'/'+id);
export async function putImage(scope,id,blob){if(!imageId(id)||!TYPES[blob.type]||blob.size>5242880)throw Error('รองรับ JPG, PNG, WebP, GIF ขนาดไม่เกิน 5 MB');await tx('readwrite',scope+'/'+id,blob);}
export function newImageId(file){if(!TYPES[file.type]||file.size>5242880)throw Error('รองรับ JPG, PNG, WebP, GIF ขนาดไม่เกิน 5 MB');return crypto.randomUUID()+'.'+TYPES[file.type];}
export async function addImage(scope,file){const id=newImageId(file);await putImage(scope,id,file);return id;}
