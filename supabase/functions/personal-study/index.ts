import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createHandler} from './handler.js';
const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const serverKey=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!serverKey)throw new Error('Server credentials unavailable');
const admin=createClient(Deno.env.get('SUPABASE_URL')!,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler(admin));
