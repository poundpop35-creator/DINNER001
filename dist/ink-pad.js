import {PALETTE} from './notebook-core.js?v=20261014-study2';
import {INK_WIDTH,INK_HEIGHT,inkPoint,acceptsInk,createInkHistory,paintInk,paintInkSegment} from './ink-core.js?v=20261014-study2';

// A route change retains the unfinished page in memory. Only the explicit
// Insert action uploads a private PNG using the notebook's existing image path.
const drafts=new Map();
export function openInkPad({noteId,onInsert,onClose=()=>{}}){
 const history=drafts.get(noteId)||createInkHistory();drafts.set(noteId,history);
 const dialog=document.createElement('dialog');dialog.className='ink-dialog';
 dialog.setAttribute('aria-labelledby','ink-title');
 dialog.innerHTML=`<header class="ink-header"><div><h2 id="ink-title">เขียนด้วยปากกา</h2><p>ใช้ Apple Pencil บน iPad ที่รองรับ หรือเมาส์ · เปิด “เขียนด้วยนิ้ว” เมื่อต้องการ</p></div><button type="button" class="button secondary" data-ink="close">ปิด</button></header><div class="ink-toolbar"><div class="ink-tools" role="group" aria-label="เครื่องมือเขียน"><button type="button" class="button secondary" data-ink="pen" aria-pressed="true">ปากกา</button><button type="button" class="button secondary" data-ink="eraser" aria-pressed="false">ยางลบ</button><button type="button" class="button secondary" data-ink="undo">↶ ย้อนกลับ</button><button type="button" class="button secondary" data-ink="redo">↷ ทำซ้ำ</button><button type="button" class="button secondary" data-ink="clear">ล้างหน้า</button></div><div class="ink-options"><div class="ink-colors" role="group" aria-label="สีหมึก">${PALETTE.map((color,i)=>`<button type="button" class="color-swatch" data-ink-color="${color}" style="--swatch:${color}" title="${['ดำ','น้ำเงิน','เขียว','แดง','ม่วง','ส้ม'][i]}" aria-label="สี${['ดำ','น้ำเงิน','เขียว','แดง','ม่วง','ส้ม'][i]}" aria-pressed="${i===0}"></button>`).join('')}</div><label>ความหนา <select id="ink-width"><option value="3">บาง</option><option value="5" selected>กลาง</option><option value="9">หนา</option></select></label><label><input type="checkbox" id="ink-finger"> เขียนด้วยนิ้ว</label></div></div><div class="ink-paper"><canvas width="${INK_WIDTH}" height="${INK_HEIGHT}" aria-label="กระดาษเขียนด้วยปากกา">เบราว์เซอร์นี้ไม่รองรับพื้นที่วาด</canvas></div><footer class="ink-footer"><p id="ink-status" role="status">ลายมือจะบันทึกเป็นรูปในโน้ตและเก็บบน Supabase เมื่อกดบันทึก รูปที่แทรกแล้วแก้เส้นปากกาแยกไม่ได้</p><button type="button" class="button primary" data-ink="save">บันทึกลายมือลงโน้ต</button></footer>`;
 document.body.append(dialog);
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),status=dialog.querySelector('#ink-status');
 if(!ctx){dialog.remove();throw Error('เปิดพื้นที่เขียนไม่ได้ ลองอัปเดตเบราว์เซอร์');}
 let tool='pen',color=PALETTE[0],width=5,finger=false,active=null,busy=false,closed=false;
 const events=[],bind=(el,name,fn)=>{el.addEventListener(name,fn);events.push(()=>el.removeEventListener(name,fn));};
 const originalFocus=document.activeElement;
 const controls=()=>{
  for(const button of dialog.querySelectorAll('button'))button.disabled=busy;
  for(const input of dialog.querySelectorAll('input,select'))input.disabled=busy;
  dialog.querySelector('[data-ink="save"]').disabled=busy||!history.hasInk;
  dialog.querySelector('[data-ink="undo"]').disabled=busy||!history.canUndo;
  dialog.querySelector('[data-ink="redo"]').disabled=busy||!history.canRedo;
  for(const name of ['pen','eraser'])dialog.querySelector(`[data-ink="${name}"]`).setAttribute('aria-pressed',String(tool===name));
  for(const button of dialog.querySelectorAll('[data-ink-color]'))button.setAttribute('aria-pressed',String(button.dataset.inkColor===color));
 };
 const finish=event=>{if(active===null||(event&&event.pointerId!==active))return;const pointer=active;active=null;history.finish();if(canvas.hasPointerCapture?.(pointer))canvas.releasePointerCapture(pointer);controls();};
 function destroy(){if(closed)return;finish();closed=true;events.forEach(fn=>fn());dialog.close();dialog.remove();originalFocus?.focus?.();onClose();}
 const discard=()=>{if(busy)return;if(history.canUndo&&!confirm('ลายมือนี้ยังไม่บันทึก ต้องการทิ้งและปิดพื้นที่เขียนไหม?'))return;drafts.delete(noteId);destroy();};
 bind(dialog,'cancel',event=>{event.preventDefault();discard();});
 bind(window,'beforeunload',event=>{if(history.canUndo){event.preventDefault();event.returnValue='';}});
 bind(canvas,'pointerdown',event=>{
  if(busy||!acceptsInk(event,{finger,active})||active!==null)return;
  event.preventDefault();active=event.pointerId;canvas.setPointerCapture(active);
  history.begin(inkPoint(event,canvas.getBoundingClientRect()),{tool,color,width});paintInk(ctx,history);
 });
 bind(canvas,'pointermove',event=>{
  if(event.pointerId!==active)return;event.preventDefault();
  const batch=event.getCoalescedEvents?.();
  for(const sample of batch?.length?batch:[event]){const segment=history.move(inkPoint(sample,canvas.getBoundingClientRect()));if(segment)paintInkSegment(ctx,segment.previous,segment.point,segment.stroke);}
 });
 for(const name of ['pointerup','pointercancel','lostpointercapture'])bind(canvas,name,finish);
 bind(dialog.querySelector('#ink-width'),'change',event=>{width=Number(event.target.value);});
 bind(dialog.querySelector('#ink-finger'),'change',event=>{finger=event.target.checked;});
 bind(dialog,'click',async event=>{
  if(busy)return;const button=event.target.closest('button');if(!button)return;
  const action=button.dataset.ink;
  if(button.dataset.inkColor){color=button.dataset.inkColor;tool='pen';controls();return;}
  if(action==='close'){discard();return;}
  if(action==='pen'||action==='eraser')tool=action;
  if(action==='undo')history.undo();
  if(action==='redo')history.redo();
  if(action==='clear')history.clear();
  if(action==='save'){
   finish();if(!history.hasInk)return;busy=true;controls();status.textContent='กำลังบันทึกลายมือไปยังโน้ต…';
   try{
    const output=document.createElement('canvas');output.width=INK_WIDTH;output.height=INK_HEIGHT;
    const outputContext=output.getContext('2d');if(!outputContext)throw Error('สร้างภาพลายมือไม่สำเร็จ');
    outputContext.fillStyle='#ffffff';outputContext.fillRect(0,0,INK_WIDTH,INK_HEIGHT);outputContext.drawImage(canvas,0,0);
    const blob=await new Promise((resolve,reject)=>output.toBlob(result=>result?resolve(result):reject(Error('สร้างภาพลายมือไม่สำเร็จ')),'image/png'));
    await onInsert(blob);drafts.delete(noteId);destroy();
   }catch(error){if(!closed){status.textContent='ยังบันทึกไม่สำเร็จ: '+error.message+' ลายมือยังอยู่ ลองกดบันทึกอีกครั้ง';busy=false;controls();}}
   return;
  }
  paintInk(ctx,history);controls();
 });
 paintInk(ctx,history);controls();dialog.showModal();
 const paper=dialog.querySelector('.ink-paper');
 const fit=()=>{const rect=paper.getBoundingClientRect(),w=Math.max(1,Math.min(rect.width-24,(rect.height-24)*INK_WIDTH/INK_HEIGHT));canvas.style.width=w+'px';canvas.style.height=w*INK_HEIGHT/INK_WIDTH+'px';};
 fit();bind(window,'resize',fit);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(fit);observer.observe(paper);events.push(()=>observer.disconnect());}
 return {destroy};
}
