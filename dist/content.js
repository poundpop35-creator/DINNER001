import {supabaseConfig} from './supabase-config.js?v=20261014';
import {loadContent,validateCatalog} from './content-client.js?v=20261014';
const snapshotURL=new URL('./content.snapshot.json?v=20261014',import.meta.url);
async function localSnapshot(){
 if(typeof process!=='undefined'&&process.versions?.node){
  const {readFile}=await import('node:fs/promises');return JSON.parse(await readFile(snapshotURL,'utf8'));
 }
 const response=await fetch(snapshotURL);if(!response.ok)throw new Error('โหลดเนื้อหาไม่สำเร็จ');return response.json();
}
let storage;try{storage=globalThis.localStorage;}catch{/* Private browsing can deny storage. */}
export const contentStatus=typeof process!=='undefined'&&process.versions?.node
 ? {catalog:validateCatalog(await localSnapshot()),source:'snapshot',warning:null}
 : await loadContent({config:supabaseConfig,storage,fallback:localSnapshot});
export const catalog=contentStatus.catalog;
