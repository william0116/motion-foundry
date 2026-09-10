import {exportGIF} from './gif-exporter.js';
import {effects,defaults,dimensions} from './data.js';
import {renderFrame} from './renderer.js';

// Parse the container independently of the encoder; pixel decoding is also
// exercised by ImageDecoder in browser integration and Pillow on saved files.
export function inspectGIF(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=new TextDecoder();
 if(text.decode(bytes.slice(0,6))!=='GIF89a')throw new Error('Invalid GIF signature');
 const width=view.getUint16(6,true),height=view.getUint16(8,true),frames=[];
 let offset=13+(bytes[10]&128?3*(1<<((bytes[10]&7)+1)):0),gce=null,loop=null;
 const blocks=()=>{const result=[];while(bytes[offset]){const size=bytes[offset++];if(offset+size>bytes.length)throw new Error('Truncated GIF block');result.push(...bytes.slice(offset,offset+size));offset+=size;}offset++;return new Uint8Array(result);};
 while(offset<bytes.length){
  const marker=bytes[offset++];
  if(marker===0x3b)return {width,height,frames,loop,durationMs:frames.reduce((sum,f)=>sum+f.delay,0),complete:offset===bytes.length};
  if(marker===0x21){
   const label=bytes[offset++];
   if(label===0xf9){if(bytes[offset++]!==4)throw new Error('Invalid GCE');const flags=bytes[offset++];gce={delay:view.getUint16(offset,true)*10,dispose:(flags>>2)&7,transparent:!!(flags&1),transparentIndex:bytes[offset+2]};offset+=4;}
   else{const data=blocks();if(label===0xff&&text.decode(data.slice(0,11))==='NETSCAPE2.0')loop=data[12]|(data[13]<<8);}
  }else if(marker===0x2c){
   const w=view.getUint16(offset+4,true),h=view.getUint16(offset+6,true),flags=bytes[offset+8];offset+=9;
   if(flags&128)offset+=3*(1<<((flags&7)+1));
   offset++;blocks();frames.push({...gce,width:w,height:h});gce=null;
  }else throw new Error('Unexpected GIF marker '+marker);
 }
 throw new Error('Missing GIF trailer');
}

export async function testGIF(check){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=96;
 const effect={id:'gif-test'},settings={duration:1};
 const render=(target,e,s,p)=>{const c=target.getContext('2d');c.clearRect(0,0,target.width,target.height);c.fillStyle='#000';c.fillRect(2,2,10,10);c.fillStyle='rgba(255,0,0,.5)';c.fillRect(20+Math.round(p*16),40,8,8);};
 const args={canvas,effect,settings,render,fps:15};
 for(const background of ['transparent','white','black']){
  const {blob,metadata}=await exportGIF({...args,background}),parsed=inspectGIF(new Uint8Array(await blob.arrayBuffer()));
  check('GIF 容器 / 循环 / 时长 / 背景：'+background,blob.type==='image/gif'&&parsed.complete&&parsed.width===64&&parsed.height===96&&parsed.frames.length===15&&parsed.durationMs===1000&&parsed.loop===0&&parsed.frames.every(f=>f.dispose===2&&f.transparent===(background==='transparent')&&f.delay>=60)&&metadata.background===background,parsed);
  if(typeof ImageDecoder!=='undefined'){
   const decoder=new ImageDecoder({data:await blob.arrayBuffer(),type:'image/gif'});await decoder.tracks.ready;
   const decoded=await decoder.decode({frameIndex:14}),target=document.createElement('canvas');target.width=64;target.height=96;
   const c=target.getContext('2d');c.drawImage(decoded.image,0,0);const pixel=(x,y)=>[...c.getImageData(x,y,1,1).data];
   const black=pixel(3,3),cleared=pixel(21,41),moving=pixel(37,41);
   const expectedClear=background==='transparent'?[0,0,0,0]:background==='white'?[255,255,255,255]:[0,0,0,255];
   const expectedMoving=background==='transparent'?[255,0,0,255]:background==='white'?[255,127,127,255]:[128,0,0,255];
   const near=(a,b)=>a.every((value,i)=>Math.abs(value-b[i])<=8);
   check('GIF 独立像素解码 / 无残影 / 不误删黑色：'+background,near(black,[0,0,0,255])&&near(cleared,expectedClear)&&near(moving,expectedMoving),{black,cleared,moving});
   decoded.image.close();decoder.close();
  }
 }
 for(const fps of [10,20]){const {blob}=await exportGIF({...args,fps});const parsed=inspectGIF(new Uint8Array(await blob.arrayBuffer()));check(`GIF ${fps} fps 精确时长`,parsed.frames.length===fps&&parsed.durationMs===1000);}
 let before=false,during=false,rendered=0;
 const cancelled=new AbortController();cancelled.abort();
 try{await exportGIF({...args,signal:cancelled.signal,render:()=>rendered++});}catch(e){before=e.name==='AbortError';}
 check('GIF 开始前取消不渲染',before&&rendered===0);
 const active=new AbortController();
 try{await exportGIF({...args,signal:active.signal,onProgress:n=>{if(n===2)active.abort();}});}catch(e){during=e.name==='AbortError';}
 check('GIF 生成中取消，不返回半成品',during);
 const recovered=await exportGIF(args);check('GIF 取消后可重新生成',recovered.metadata.frameCount===15);
 let errors=0;for(const override of [{fps:NaN},{fps:0},{settings:{duration:0}},{settings:{duration:999}},{background:'invalid'}]){try{await exportGIF({...args,...override});}catch(e){if(e.name!=='AbortError')errors++;}}
 check('GIF 无效参数与过大任务阻止生成',errors===5);
 let total=0;
 for(const e of effects){[canvas.width,canvas.height]=dimensions(e.ratio||'16:9',64);const {blob}=await exportGIF({canvas,effect:e,settings:{...defaults(e),duration:.3},render:renderFrame,fps:10});const parsed=inspectGIF(new Uint8Array(await blob.arrayBuffer()));if(!parsed.complete||parsed.frames.length!==3||parsed.durationMs!==300)throw new Error('GIF 模板失败：'+e.id);total++;}
 check('全部模板真实 GIF 编码',total===effects.length,{templates:total,frames:total*3});
}
