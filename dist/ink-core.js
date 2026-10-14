export const INK_WIDTH=1200,INK_HEIGHT=900;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function inkPoint(event,rect){
 return {x:clamp((event.clientX-rect.left)/rect.width*INK_WIDTH,0,INK_WIDTH),y:clamp((event.clientY-rect.top)/rect.height*INK_HEIGHT,0,INK_HEIGHT),pressure:event.pointerType==='pen'&&event.pressure>0?clamp(event.pressure,0.1,1):0.5};
}
export function acceptsInk(event,{finger=false,active=null}={}){
 return (active===null||active===event.pointerId)&&(event.pointerType!=='touch'||finger)&&!(event.pointerType==='mouse'&&event.button>0);
}
export function createInkHistory(){
 let operations=[],cursor=0,stroke=null;
 const append=operation=>{operations=operations.slice(0,cursor);operations.push(operation);cursor=operations.length;};
 return {
  begin(point,style){stroke={...style,points:[point]};},
  move(point){if(!stroke)return null;const previous=stroke.points.at(-1);stroke.points.push(point);return {previous,point,stroke};},
  finish(){if(stroke){append(stroke);stroke=null;}},
  clear(){append({clear:true});},
  undo(){if(cursor)cursor--;},redo(){if(cursor<operations.length)cursor++;},
  get canUndo(){return cursor>0;},get canRedo(){return cursor<operations.length;},
  get operations(){return operations.slice(0,cursor);},get stroke(){return stroke;},
  get hasInk(){const visible=operations.slice(0,cursor);const lastClear=visible.findLastIndex(x=>x.clear);return visible.slice(lastClear+1).some(x=>x.tool==='pen');}
 };
}
export function paintInkSegment(ctx,a,b,stroke){
 ctx.save();ctx.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over';
 const width=stroke.tool==='eraser'?stroke.width*6:stroke.width*(0.5+(a.pressure+b.pressure)/2);
 ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 if(a.x===b.x&&a.y===b.y){ctx.beginPath();ctx.arc(a.x,a.y,width/2,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
export function paintInk(ctx,history){
 ctx.clearRect(0,0,INK_WIDTH,INK_HEIGHT);
 for(const stroke of [...history.operations,...(history.stroke?[history.stroke]:[])]){
  if(stroke.clear){ctx.clearRect(0,0,INK_WIDTH,INK_HEIGHT);continue;}
  paintInkSegment(ctx,stroke.points[0],stroke.points[0],stroke);
  for(let i=1;i<stroke.points.length;i++)paintInkSegment(ctx,stroke.points[i-1],stroke.points[i],stroke);
 }
}
