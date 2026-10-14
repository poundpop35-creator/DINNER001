import test from 'node:test';
import assert from 'node:assert/strict';
import {INK_WIDTH,INK_HEIGHT,inkPoint,acceptsInk,createInkHistory,paintInk} from '../dist/ink-core.js';
import {openInkPad} from '../dist/ink-pad.js';

const point={x:20,y:40,pressure:0.5},pen={tool:'pen',color:'#1d4ed8',width:5};
test('pen coordinates scale with the page and palm touches are ignored unless enabled',()=>{
 assert.deepEqual(inkPoint({clientX:160,clientY:125,pointerType:'pen',pressure:0.8},{left:10,top:25,width:300,height:200}),{x:INK_WIDTH/2,y:INK_HEIGHT/2,pressure:0.8});
 assert.equal(acceptsInk({pointerId:1,pointerType:'pen',button:0}),true);
 assert.equal(acceptsInk({pointerId:2,pointerType:'touch',button:0}),false);
 assert.equal(acceptsInk({pointerId:2,pointerType:'touch',button:0},{finger:true,active:1}),false);
 assert.equal(acceptsInk({pointerId:2,pointerType:'touch',button:0},{finger:true}),true);
 assert.equal(acceptsInk({pointerId:1,pointerType:'mouse',button:2}),false);
});
test('erasing, undo, redo and clearing replay the same strokes and allow recovery of a cleared page',()=>{
 const history=createInkHistory();history.begin(point,pen);history.move({...point,x:100});history.finish();
 history.begin({...point,x:80},{...pen,tool:'eraser'});history.finish();
 const operations=[];const ctx={save(){},restore(){},clearRect(){operations.push('clear');},beginPath(){},moveTo(){},lineTo(){},stroke(){operations.push(this.globalCompositeOperation);},arc(){},fill(){}};
 paintInk(ctx,history);assert.ok(operations.includes('destination-out'));
 history.undo();assert.equal(history.operations.length,1);history.redo();assert.equal(history.operations.length,2);
 history.clear();assert.equal(history.hasInk,false);history.undo();assert.equal(history.hasInk,true);
 history.begin(point,pen);history.finish();assert.equal(history.canRedo,false);
});

// Event integration with a minimal canvas host; actual Pencil/device rendering
// still needs hardware testing. This checks failed uploads and retry behavior.
function host(){
 const created=[];
 class Element{
  constructor(tag='div'){this.tag=tag;this.events={};this.children=new Map();this.style={};this.dataset={};this.attrs={};this.removed=false;this.open=false;this.width=INK_WIDTH;this.height=INK_HEIGHT;this.buttons=[];this.paint=[];}
  addEventListener(name,fn){(this.events[name]||=[]).push(fn);}removeEventListener(name,fn){this.events[name]=(this.events[name]||[]).filter(f=>f!==fn);}
  async emit(name,event={}){for(const fn of this.events[name]||[])await fn(event);}
  setAttribute(k,v){this.attrs[k]=v;}focus(){}append(x){created.push(x);}remove(){this.removed=true;}showModal(){this.open=true;}close(){this.open=false;}
  getBoundingClientRect(){return {left:0,top:0,width:600,height:450};}
  setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(){this.pointer=null;}
  querySelector(selector){
   if(!this.children.has(selector)){
    const child=new Element(selector==='canvas'?'canvas':'div');
    const match=selector.match(/data-ink="([a-z]+)"/);if(match){child.dataset.ink=match[1];this.buttons.push(child);}
    this.children.set(selector,child);
   }return this.children.get(selector);
  }
  querySelectorAll(selector){return selector==='button'?this.buttons:[];}
  getContext(){const paint=this.paint;return {save(){},restore(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){paint.push('stroke');},arc(){},fill(){},fillRect(){paint.push('white-paper');},drawImage(){paint.push('ink-image');}};}
  toBlob(callback,type){callback(new Blob(['png-test-encoder'],{type}));}
 }
 const win=new Element('window');globalThis.window=win;
 globalThis.document={activeElement:new Element(),body:new Element('body'),createElement:tag=>{const el=new Element(tag);created.push(el);return el;}};
 return {created,window:win};
}
test('a failed handwriting upload keeps the drawing available; retry inserts it before closing',async()=>{
 const h=host();let attempts=0,closed=0;
 const pad=openInkPad({noteId:'test-retry',onClose:()=>closed++,onInsert:async blob=>{attempts++;assert.equal(blob.type,'image/png');if(attempts===1)throw Error('offline');}});
 const dialog=h.created.find(x=>x.tag==='dialog'),canvas=dialog.querySelector('canvas');
 const event={pointerId:1,pointerType:'pen',clientX:50,clientY:60,pressure:0.7,button:0,preventDefault(){}};
 await canvas.emit('pointerdown',event);await canvas.emit('pointermove',{...event,clientX:90});await canvas.emit('pointerup',event);
 const save=dialog.querySelector('[data-ink="save"]'),click={target:{closest:()=>save}};
 await dialog.emit('click',click);assert.equal(dialog.open,true);assert.equal(save.disabled,false);assert.match(dialog.querySelector('#ink-status').textContent,/offline/);
 await dialog.emit('click',click);assert.equal(attempts,2);assert.equal(closed,1);assert.equal(dialog.removed,true);
 assert.ok(h.created.filter(x=>x.tag==='canvas').every(x=>x.paint.join(',')==='white-paper,ink-image'));
 pad.destroy();assert.equal(closed,1);
});
