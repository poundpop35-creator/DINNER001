import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const name of await readdir(new URL('../dist/',import.meta.url))){
 if(!name.endsWith('.js'))continue;
 const result=spawnSync(process.execPath,['--check',new URL('../dist/'+name,import.meta.url).pathname],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
