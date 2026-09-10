import {paletteFor,brandTokens} from './schemes.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const FONT='"Inter","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

function linesFor(c,value,width){const lines=[];for(const paragraph of String(value||'').split('\n')){let line='';for(const char of [...paragraph]){if(line&&c.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line);}return lines;}
// Fit all supplied text into a bounded box. Never silently drop the last lines.
function block(c,value,x,y,width,height,size,fill,weight=600,align='left'){
 let lines;do{c.font=`${weight} ${size}px ${FONT}`;lines=linesFor(c,value,width);if(lines.length*size*1.32<=height||size<=10)break;size-=1;}while(size>0);
 c.fillStyle=fill;c.textAlign=align;c.textBaseline='top';for(const [i,line]of lines.entries())c.fillText(line,x,y+i*size*1.32);return lines.length*size*1.32;
}
function rounded(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
function rule(c,x1,y1,x2,y2,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function gradient(c,p,button=false){const g=c.createLinearGradient(-280,-400,280,400);if(p.brand){g.addColorStop(0,button?brandTokens.sky:brandTokens.mint);if(!button)g.addColorStop(.5,brandTokens.sky);g.addColorStop(1,brandTokens.navy);}else{g.addColorStop(0,p.accent);g.addColorStop(1,p.secondary);}return g;}
function image(c,img,x,y,size){if(!img)return false;c.save();c.beginPath();c.roundRect(x-size/2,y-size/2,size,size,12);c.clip();const k=Math.max(size/img.width,size/img.height);c.drawImage(img,x-img.width*k/2,y-img.height*k/2,img.width*k,img.height*k);c.restore();return true;}

export function renderCard(canvas,e,s,progress){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=paletteFor(s);
 c.clearRect(0,0,w,h);const t=Math.pow(clamp(progress),1.35-s.intensity/140),intro=ease(t/.2),outro=1-ease((t-.86)/.14);
 if(t===0||t===1)return;c.save();c.globalAlpha=intro*outro;
 const wide=['wordmark','ribbon'].includes(e.kind),factor=Math.min(w/(wide?940:720),h/(wide?500:1220))*s.scale/100;
 const half=(wide?125:460)*factor,margin=Math.min(w,h)*.04;
 const target=s.position==='top'?.30:s.position==='bottom'?.68:.46;
 const cy=clamp(h*target,half+margin,Math.max(half+margin,h-half-margin));
 c.translate(w/2,cy);c.scale(factor,factor);
 if(wide){
  if(e.kind==='wordmark'){
   c.save();c.beginPath();c.rect(-420,-150,840*intro,300);c.clip();block(c,s.title,0,-60,790,100,82,gradient(c,p),700,'center');block(c,s.subtitle,0,62,780,80,26,p.brand?(p.id.endsWith('light')?brandTokens.navy:'#FAFAFA'):p.foreground,400,'center');c.restore();
   rule(c,-200,125,-200+400*intro,125,p.accent,3);if(s.image)image(c,s.image,0,-135,60);
  }else{
   c.translate((1-intro)*-180,0);rounded(c,-400,-104,800,208,14,p.surface,p.border);rounded(c,-400,-104,9,208,0,gradient(c,p));
   if(!image(c,s.image,-306,0,104))block(c,'L',-306,-44,90,100,74,p.accent,700,'center');block(c,s.title,-214,-55,560,65,46,p.foreground,700);block(c,s.subtitle,-214,23,560,80,25,p.muted,400);
  }c.restore();return;
 }
 const kind=e.kind,items=(s.body||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3);
 // Intentionally flat cards: subtle borders, no persistent drop shadows.
 if(kind==='flip'){const z=.08+.92*intro;c.scale(z,1);c.rotate((1-intro)*-.05);}
 else if(kind==='ticket'){c.translate(0,-(1-intro)*170);c.rotate((1-intro)*.10);}
 else if(kind==='split'){c.beginPath();c.rect(-310,-465,620,930*intro);c.clip();}
 else{c.translate(0,(1-intro)*110);}
 if(kind==='stack'){for(let i=2;i>0;i--){c.save();c.rotate((i===1?-.04:.055)*intro);rounded(c,-280-i*5,-430+i*12,560,860,14,p.tint,p.border);c.restore();}}
 rounded(c,-280,-430,560,860,14,p.surface,p.border);
 if(p.brand){rounded(c,-280,-430,560,6,0,gradient(c,p));}
 const txt=(value,x,y,width,height,size,color=p.foreground,weight=600,align='left')=>block(c,value,x,y,width,height,size,color,weight,align);
 const badge=()=>{rounded(c,-232,-380,230,40,8,p.tint);txt(s.badge,-218,-372,204,26,19,p.primary,500);};
 const footer=()=>{rule(c,-232,350,232,350,p.border,1);txt(s.subtitle,-232,370,464,40,16,p.muted,500);};
 const title=(y=-284,height=190,size=55)=>txt(s.title,-232,y,464,height,size,p.foreground,700);
 const body=(y=25,height=210,size=28)=>txt(s.body,-232,y,464,height,size,p.muted,400);
 const reveal=(delay,fn,dy=35)=>{const q=ease((t-delay)/.18);c.save();c.globalAlpha*=q;c.translate(0,(1-q)*dy);fn(q);c.restore();};
 badge();
 if(kind==='cover'){
  reveal(.06,()=>title(-267,240,67));reveal(.15,q=>rule(c,-232,32,-232+140*q,32,p.accent,7));reveal(.22,()=>body(88,185,30));
  txt('01',226,-382,65,36,25,p.muted,500,'right');
 }
 if(kind==='stack'){
  reveal(.05,()=>title(-281,145,48));for(const [i,item]of items.entries())reveal(.16+i*.10,()=>{const y=-53+i*116;rounded(c,-232,y,464,96,10,i===0?p.tint:p.surface,p.border);txt(String(i+1).padStart(2,'0'),-210,y+25,42,36,27,p.accent,700);txt(item,-145,y+20,350,59,28);});
 }
 if(kind==='flip'){
  txt('02',-232,-265,440,225,186,p.accent,700);reveal(.10,()=>title(-30,156,49));reveal(.22,()=>body(167,132,28));
 }
 if(kind==='checklist'){
  reveal(.05,()=>title(-284,154,49));for(const [i,item]of items.entries())reveal(.15+i*.10,q=>{const y=-59+i*125;rounded(c,-232,y,49,49,8,p.tint);rule(c,-220,y+24,-210,y+34,p.primary,4);rule(c,-210,y+34,-194,y+14,p.primary,4);txt(item,-162,y-3,390,87,31);rule(c,-162,y+87,225,y+87,p.border,1);});
 }
 if(kind==='quote'){
  txt('“',-236,-306,200,142,172,p.accent,700);reveal(.09,()=>title(-139,239,52));reveal(.23,()=>body(141,147,27));
 }
 if(kind==='compare'){
  reveal(.04,()=>title(-282,148,47));for(const [i,item]of items.slice(0,2).entries())reveal(.15+i*.14,()=>{const y=-75+i*195;rounded(c,-232,y,464,171,12,i?p.tint:p.surface,p.border);txt(i?'换个角度':'常见表达',-209,y+19,410,40,20,i?p.primary:p.muted,500);txt(item,-209,y+66,410,87,36);});
 }
 if(kind==='stat'){
  reveal(.06,()=>title(-254,250,90));for(let i=0;i<7;i++){const q=ease((t-.15-i*.025)/.2);rounded(c,-230+i*67,131-q*(45+i*13),45,q*(45+i*13),3,i<4?p.accent:p.tint);}
  reveal(.26,()=>body(182,144,26));
 }
 if(kind==='profile'){
  reveal(.04,()=>{rounded(c,-100,-294,200,200,12,p.tint);if(!image(c,s.image,0,-194,200))txt([...s.title][0]||'我',0,-249,172,145,100,p.primary,700,'center');});
  reveal(.15,()=>title(-41,167,49));reveal(.24,()=>body(157,164,28));
 }
 if(kind==='timeline'){
  reveal(.04,()=>title(-284,148,49));rule(c,-208,-41,-208,255,p.border,2);
  for(const [i,item]of items.entries())reveal(.14+i*.11,()=>{const y=-44+i*133;rounded(c,-224,y,32,32,16,p.accent);txt(String(i+1),-208,y+6,30,28,17,p.buttonText,700,'center');txt(item,-162,y-3,385,100,29);});
 }
 if(kind==='ticket'){
  reveal(.05,()=>title(-264,232,63));c.save();c.setLineDash([6,8]);rule(c,-262,31,262,31,p.border,2);c.restore();reveal(.2,()=>body(98,157,30));
  for(let i=0;i<36;i++)rounded(c,-222+i*12,267,2+i%3,41,0,p.accent);
 }
 if(kind==='question'){
  reveal(.05,()=>title(-280,232,59));for(const [i,item]of items.slice(0,2).entries())reveal(.19+i*.12,()=>{const y=2+i*146;rounded(c,-232,y,464,116,12,i?p.tint:p.surface,p.border);txt(i?'B':'A',-205,y+32,42,48,38,p.accent,700);txt(item,-135,y+28,335,75,30);});
 }
 if(kind==='split'){
  rounded(c,-280,-303,560,330,0,p.tint);reveal(.06,()=>title(-248,238,65));reveal(.20,()=>body(99,155,30));reveal(.27,q=>rule(c,-232,300,-232+464*q,300,p.accent,4));
 }
 if(kind==='outro'){
  if(s.image)image(c,s.image,0,-248,105);else txt('LexSeek',0,-271,448,92,61,gradient(c,p),700,'center');
  reveal(.1,()=>title(-102,214,53));reveal(.23,()=>body(146,95,26));
  reveal(.30,()=>{rounded(c,-232,257,464,65,8,gradient(c,p,true));txt(s.badge,0,271,410,40,26,p.buttonText,600,'center');});
 }
 if(s.image&&!['profile','outro'].includes(kind))image(c,s.image,205,-359,52);
 footer();c.restore();
}
