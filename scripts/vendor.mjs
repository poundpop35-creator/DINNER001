// Pinned, local browser assets: the app does not depend on a runtime CDN.
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../dist/vendor/',import.meta.url),{recursive:true});
for(const [source,target] of [
 ['quill/dist/quill.js','quill-2.0.3.js'],['quill/dist/quill.snow.css','quill-2.0.3.css'],['quill/LICENSE','QUILL-LICENSE.txt'],['quill/dist/quill.js.LICENSE.txt','quill.js.LICENSE.txt'],
 ['@supabase/supabase-js/dist/umd/supabase.js','supabase-2.117.3.js'],['@supabase/supabase-js/LICENSE','SUPABASE-LICENSE.txt']
])await copyFile(new URL('../node_modules/'+source,import.meta.url),new URL('../dist/vendor/'+target,import.meta.url));
