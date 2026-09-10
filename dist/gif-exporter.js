import {GIFEncoder,quantize,applyPalette} from './vendor/gifenc/gifenc.esm.js';

const backgrounds={transparent:null,white:255,black:0};
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
function checkAbort(signal){if(signal?.aborted)throw new DOMException('已取消导出','AbortError');}

// GIF has one transparent palette entry, not RGBA alpha. Reserve index zero
// in EVERY frame so disposal-to-background clears moving objects correctly.
function indexedFrame(data,background){
 const transparent=background==='transparent',matte=backgrounds[background];
 for(let i=0;i<data.length;i+=4){
  const alpha=data[i+3]/255;
  if(transparent){if(data[i+3]<128)data[i]=data[i+1]=data[i+2]=0;}
  else{for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*alpha+matte*(1-alpha));data[i+3]=255;}
 }
 const colors=quantize(data,transparent?255:256,{format:'rgb565'});
 const index=applyPalette(data,colors,'rgb565');
 if(transparent){for(let i=0;i<index.length;i++)index[i]=data[i*4+3]<128?0:index[i]+1;}
 return {index,palette:transparent?[[0,0,0],...colors]:colors};
}

export async function exportGIF({canvas,effect,settings,fps=15,background='transparent',render,signal,onProgress=()=>{}}){
 checkAbort(signal);
 const {width,height}=canvas,duration=Number(settings.duration),count=Math.round(duration*fps);
 if(!Object.hasOwn(backgrounds,background))throw new Error('请选择透明、白色或黑色 GIF 背景。');
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(fps)||fps<1||fps>30||count<1||count>300||width<1||height<1||width*height>2073600||width*height*count>180000000){
  throw new Error('GIF 尺寸或时长过大，请降低分辨率、帧率或时长后重试。');
 }
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw new Error('当前浏览器无法创建 GIF 画布，请换用 Chrome 重试。');
 const gif=GIFEncoder(),transparent=background==='transparent';
 onProgress(0,count);await yieldFrame();
 for(let i=0;i<count;i++){
  checkAbort(signal);
  // Same deterministic frame sampling as the existing PNG sequence exporter.
  render(canvas,effect,settings,i/Math.max(1,count-1));
  const {index,palette}=indexedFrame(context.getImageData(0,0,width,height).data,background);
  // Distribute 1/100-second GIF delays; 15 fps must not drift to 14.28 fps.
  const delay=(Math.round((i+1)*duration*100/count)-Math.round(i*duration*100/count))*10;
  gif.writeFrame(index,width,height,{palette,delay,repeat:0,transparent,transparentIndex:0,dispose:2});
  if(gif.bytesView().byteLength>80*1024*1024)throw new Error('GIF 超过 80 MB，请降低分辨率或帧率后重试。');
  onProgress(i+1,count);await yieldFrame();
 }
 checkAbort(signal);gif.finish();
 return {blob:new Blob([gif.bytesView()],{type:'image/gif'}),metadata:{format:'GIF',effect:effect.id,width,height,fps,frameCount:count,durationSeconds:Math.round(duration*100)/100,loop:'forever',background,alpha:transparent?'binary; alpha below 128 is transparent':'opaque matte',maxColors:256}};
}
