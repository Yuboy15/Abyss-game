/* ABYSS Rebuilt Alpha 1. Independent particle-string simulation.
   No scripted keel hinge, no rigid-body poses, no positional registration.
   Artwork originates from the user's ABYSS game, not Floating Sandbox. */
(()=>{'use strict';
const $=id=>document.getElementById(id),c=$('scene'),ctx=c.getContext('2d',{alpha:false});
const names={titanic:'RMS Titanic',britannic:'HMHS Britannic',lusitania:'RMS Lusitania',cargo:'MV Northstar',queenmary:'RMS Queen Mary',normandie:'SS Normandie',majestic:'RMS Majestic',lusitania_black:'RMS Lusitania — Black funnels',cruise:'Ocean Cruise Ship',container:'Container Ship',amatola:'SAS Amatola',edmund:'SS Edmund Fitzgerald'};
for(const [id,name] of Object.entries(names)){let o=document.createElement('option');o.value=id;o.textContent=name;$('ship').append(o)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),len=(x,y)=>Math.hypot(x,y),sea=(x,t)=>sim.waterY+sim.wave*Math.sin(x*.008+t*1.6)+sim.swell*Math.sin(x*.021+t*2.3);
let W=1,H=1,dpr=1,view={scale:1,x:0,y:0},sim={time:0,paused:false,tool:'cut',ship:'titanic',nodes:[],links:[],grid:new Map(),image:null,mask:null,waterY:0,wave:0,swell:0,storm:0,tsunami:0,showStrings:false,showWater:true,lights:true,throttle:0,gravity:58,stiffness:.82,strength:1.4,depth:1400,speed:1,broken:0,wetMass:0,loaded:false,compartments:[],drops:[],inspect:null,particles:0},STEP=12,cols=76,rows=26;
let pointer=null,last=0,acc=0,frame=0;
function resize(){const r=c.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(2,devicePixelRatio||1);c.width=Math.floor(W*dpr);c.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!view.scale)view.scale=Math.min(W/1020,H/490);}
new ResizeObserver(resize).observe(c);
function world(x,y){return{x:(x-W/2)/view.scale+view.x,y:(y-H*.56)/view.scale+view.y}}
function screen(x,y){return{x:W/2+(x-view.x)*view.scale,y:H*.56+(y-view.y)*view.scale}}
function imageAt(id){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='assets/'+id+'.png'})}
function gridKey(x,y){return x+','+y}
function getNode(gx,gy){const id=sim.grid.get(gridKey(gx,gy));return id===undefined?null:sim.nodes[id]}
function loadShip(id){sim.loaded=false;$('loading').hidden=false;sim.ship=id;imageAt(id).then(im=>{
 sim.image=im;const off=document.createElement('canvas');off.width=900;off.height=300;const oc=off.getContext('2d',{willReadFrequently:true});oc.drawImage(im,0,0,900,300);const rgba=oc.getImageData(0,0,900,300).data;
 const alpha=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=900||y<0||y>=300)return 0;return rgba[(y*900+x)*4+3]};
 sim.mask=rgba;sim.nodes=[];sim.links=[];sim.grid=new Map();sim.broken=0;sim.time=0;sim.wave=0;sim.swell=0;sim.storm=0;sim.tsunami=0;sim.inspect=null;sim.waterY=0;
 // The structural image is sampled independently of the visible texture.
 // Keep all alpha-connected material, including funnels and mast fragments.
 const originX=-450,originY=-210;
 cols=Math.ceil(900/STEP);rows=Math.ceil(300/STEP);
 for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
  const sx=gx*STEP+STEP/2,sy=gy*STEP+STEP/2;
  let hits=0;for(const [dx,dy] of [[0,0],[-4,0],[4,0],[0,-4],[0,4]])if(alpha(sx+dx,sy+dy)>85)hits++;
  if(hits<2)continue;
  const n={id:sim.nodes.length,gx,gy,sx,sy,x:originX+sx,y:originY+sy,px:originX+sx,py:originY+sy,mass:1,water:0,broken:false,anchored:false,region:Math.floor(gx/9),baseY:originY+sy};
  sim.grid.set(gridKey(gx,gy),n.id);sim.nodes.push(n);
 }
 // Four neighbour directions create a triangular mass-spring-damper network.
 for(const n of sim.nodes)for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
  const other=getNode(n.gx+dx,n.gy+dy);if(!other)continue;
  const midx=(n.sx+other.sx)/2,midy=(n.sy+other.sy)/2;
  if(alpha(midx,midy)<70)continue;
  sim.links.push({a:n.id,b:other.id,rest:len(n.x-other.x,n.y-other.y),strength:(sim.ship==='edmund'?.91:1),damage:0,dead:false});
 }
 sim.compartments=Array.from({length:12},(_,i)=>({id:i,water:0,breach:0,pump:0}));sim.loaded=true;sim.particles=sim.nodes.length;
 view={scale:Math.min((W-25)/1000,(H-25)/470),x:0,y:0};$('loading').hidden=true;updateStatus();
 }).catch(e=>{$('loading').textContent='Could not load ship artwork: '+e.message});}
function sever(x1,y1,x2,y2,radius=6,repair=false){let count=0;const dx=x2-x1,dy=y2-y1,den=dx*dx+dy*dy||1;
 for(const l of sim.links){const a=sim.nodes[l.a],b=sim.nodes[l.b],mx=(a.x+b.x)/2,my=(a.y+b.y)/2,t=clamp(((mx-x1)*dx+(my-y1)*dy)/den,0,1);if(len(mx-(x1+dx*t),my-(y1+dy*t))>radius)continue;
 if(repair){if(l.dead&&len(a.x-b.x,a.y-b.y)<l.rest*1.35){l.dead=false;l.damage=0;count++;}}
 else if(!l.dead){l.dead=true;sim.broken++;count++;}
 }
 if(!repair&&count){for(const n of sim.nodes){const t=clamp(((n.x-x1)*dx+(n.y-y1)*dy)/den,0,1);if(len(n.x-(x1+dx*t),n.y-(y1+dy*t))<radius+10){const comp=sim.compartments[clamp(Math.floor(n.sx/75),0,11)];comp.breach=Math.min(1,comp.breach+.03);}}}
 return count;
}
function physics(dt){if(!sim.loaded)return;sim.time+=dt;const t=sim.time;
 if(sim.tsunami>0){sim.tsunami-=dt;sim.wave=sim.storm+Math.sin(t*.32)*Math.max(0,sim.tsunami/9)*Number($('waveHeight').value);}
 else sim.wave+=(sim.storm-sim.wave)*Math.min(1,dt*2);
 // Water enters damaged compartments; each wet structural point gains local mass.
 for(const cp of sim.compartments){let submerged=0,total=0;for(const n of sim.nodes){if(Math.floor(n.sx/75)!==cp.id)continue;total++;if(n.y>sea(n.x,t))submerged++;}
  const pressure=total?submerged/total:0;
  cp.water=clamp(cp.water+(cp.breach*pressure*1.4-cp.pump*.65)*dt,0,1);cp.pump=Math.max(0,cp.pump-dt*.1);
 }
 const floor=sim.waterY+sim.depth;
 for(const n of sim.nodes){
  const cp=sim.compartments[clamp(Math.floor(n.sx/75),0,11)];n.water=cp.water;
  const vy=(n.y-n.py)*.992,vx=(n.x-n.px)*.992;
  n.px=n.x;n.py=n.y;
  const surface=sea(n.x,t),sub=clamp((n.y-surface)/18,0,1);
  // Weight of retained water increases particle mass. Hydrostatic buoyancy
  // acts only on submerged material and decreases as compartments flood.
  const mass=1+n.water*2.5;
  const buoy=sim.gravity*2.8*sub*(1-cp.water*.82);
  n.x+=vx+sim.throttle*dt*dt*12*(sub>.1?1:.2);
  n.y+=vy+clamp(sim.gravity-buoy/mass,-140,110)*dt*dt;
  if(n.y>floor){n.y=floor;n.py=Math.min(n.py,n.y+.06);}
 }
 // Iterative distance constraints are the only source of structural rigidity.
 // There is NO rigid-body translation/rotation or return-to-original-shape force.
 const iters=11;
 for(let k=0;k<iters;k++)for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
  const correction=(d-l.rest)/d*sim.stiffness*.5;
  a.x+=dx*correction;a.y+=dy*correction;b.x-=dx*correction;b.y-=dy*correction;
 }
 // Stress accumulates on real strings. No cut-qualification scripting.
 // High safety factor prevents ordinary ocean swell from shredding a ship.
 let breaks=0;for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],ratio=len(a.x-b.x,a.y-b.y)/l.rest;
  if(ratio>l.strength*sim.strength)l.damage+=(ratio-l.strength*sim.strength)*dt*4;
  else l.damage=Math.max(0,l.damage-dt*.07);
  if(l.damage>1&&breaks<8){l.dead=true;sim.broken++;breaks++;}
 }
 // Nonpenetration for ocean floor is solved after constraints too.
 for(const n of sim.nodes)if(n.y>floor){n.y=floor;n.py=Math.min(n.py,n.y+.05)}
}
function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#172c4d');sky.addColorStop(.62,'#6da2c6');sky.addColorStop(1,'#193b50');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 const floorY=screen(0,sim.waterY+sim.depth).y;
 if(floorY<H){ctx.fillStyle='#26333d';ctx.fillRect(0,floorY,W,H-floorY)}
 const topY=screen(0,sim.waterY).y;ctx.fillStyle='#06354d';ctx.beginPath();ctx.moveTo(0,H);for(let sx=0;sx<=W+12;sx+=12){const wx=world(sx,0).x;const yy=screen(wx,sea(wx,sim.time)).y;ctx.lineTo(sx,yy);}ctx.lineTo(W,H);ctx.fill();
 if(sim.loaded){
 // Rigid, unscaled image tiles follow the real points. Broken strings
 // release tiles naturally; texture is never stretched across a hinge.
 const im=sim.image,s=view.scale;
 for(const n of sim.nodes){const right=getNode(n.gx+1,n.gy),down=getNode(n.gx,n.gy+1);let ang=0;if(right){ang=Math.atan2(right.y-n.y,right.x-n.x)}else if(down)ang=Math.atan2(-(down.x-n.x),down.y-n.y);
  const p=screen(n.x,n.y);if(p.x< -STEP*s||p.x>W+STEP*s||p.y< -STEP*s||p.y>H+STEP*s)continue;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);ctx.drawImage(im,n.gx*STEP,n.gy*STEP,STEP,STEP,-STEP*s/2,-STEP*s/2,STEP*s+1,STEP*s+1);ctx.restore();
 }
 if(sim.showWater){for(const n of sim.nodes){if(n.water<.035)continue;const p=screen(n.x,n.y);ctx.fillStyle=`rgba(25,142,220,${Math.min(.48,n.water*.5)})`;ctx.fillRect(p.x-STEP*s/2,p.y-STEP*s/2,STEP*s,STEP*s);}}
 if(sim.showStrings){ctx.lineWidth=Math.max(.65,view.scale*.9);for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],pa=screen(a.x,a.y),pb=screen(b.x,b.y);ctx.strokeStyle=l.damage>.2?'#ff9458bb':'#76dce7a0';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();}}
 }
 // Transparent surface overlay is drawn after the ship, showing immersion.
 ctx.fillStyle='rgba(15,93,136,.23)';ctx.beginPath();ctx.moveTo(0,H);for(let sx=0;sx<=W+12;sx+=12){const wx=world(sx,0).x;ctx.lineTo(sx,screen(wx,sea(wx,sim.time)).y)}ctx.lineTo(W,H);ctx.fill();
 ctx.strokeStyle='#b1e6f4b0';ctx.lineWidth=1.2;ctx.beginPath();for(let sx=0;sx<=W+12;sx+=12){const wx=world(sx,0).x,yy=screen(wx,sea(wx,sim.time)).y;if(!sx)ctx.moveTo(sx,yy);else ctx.lineTo(sx,yy)}ctx.stroke();
 if(pointer?.down&&sim.tool==='cut'){ctx.strokeStyle='#ff705e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(pointer.startX,pointer.startY);ctx.lineTo(pointer.x,pointer.y);ctx.stroke()}
 if(sim.inspect){const p=screen(sim.inspect.x,sim.inspect.y);ctx.fillStyle='#061b2ee0';ctx.fillRect(clamp(p.x+12,0,W-170),clamp(p.y-60,0,H-80),170,58);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText('Compartment '+(sim.inspect.id+1),clamp(p.x+20,8,W-160),clamp(p.y-40,18,H-60));ctx.fillText('Flooded '+Math.round(sim.compartments[sim.inspect.id].water*100)+'%',clamp(p.x+20,8,W-160),clamp(p.y-20,34,H-40));}
}
function updateStatus(){const flooded=sim.compartments.reduce((a,b)=>a+b.water,0)/12;const alive=sim.links.reduce((a,l)=>a+(!l.dead),0);$('status').innerHTML=`<strong>${names[sim.ship]}</strong> · Particle-string engine<br>${sim.nodes.length} points · ${alive} load-bearing strings · ${sim.broken} broken<br>Flooding ${Math.round(flooded*100)}% · ${sim.paused?'Paused':'Running'} · ${sim.speed}×`;}
function loop(now){const dt=Math.min(.045,(now-last)/1000||.016);last=now;if(!sim.paused){acc+=dt*sim.speed;let steps=0;while(acc>=1/60&&steps<5){physics(1/60);acc-=1/60;steps++;}}draw();if(frame++%12===0)updateStatus();requestAnimationFrame(loop)}
function setTool(t){sim.tool=t;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===t)}
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool(b.dataset.tool);
function nearNode(x,y){let best=null,d=Infinity;for(const n of sim.nodes){const nd=len(n.x-x,n.y-y);if(nd<d){d=nd;best=n}}return d<35?best:null}
function toolAt(x,y,prev=null){if(!sim.loaded)return;const p=world(x,y),q=prev?world(prev.x,prev.y):p;
 if(sim.tool==='cut'){sever(q.x,q.y,p.x,p.y,6)}
 else if(sim.tool==='hole'){sever(p.x-10,p.y-10,p.x+10,p.y+10,14);}
 else if(sim.tool==='repair'){sever(p.x-18,p.y-18,p.x+18,p.y+18,20,true)}
 else if(sim.tool==='flood'){const n=nearNode(p.x,p.y);if(n){const cp=sim.compartments[clamp(Math.floor(n.sx/75),0,11)];cp.water=clamp(cp.water+.18,0,1);cp.breach=clamp(cp.breach+.12,0,1)}}
 else if(sim.tool==='inspect'){const n=nearNode(p.x,p.y);if(n)sim.inspect={x:p.x,y:p.y,id:clamp(Math.floor(n.sx/75),0,11)}}
}
let touchPositions=new Map(),pinch=null;
c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);touchPositions.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(touchPositions.size>1){pointer=null;pinch=null;return}pointer={down:true,startX:e.offsetX,startY:e.offsetY,x:e.offsetX,y:e.offsetY,prevX:e.offsetX,prevY:e.offsetY};if(sim.tool!=='cut')toolAt(e.offsetX,e.offsetY);});
c.addEventListener('pointermove',e=>{if(!touchPositions.has(e.pointerId))return;touchPositions.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(touchPositions.size>=2){const ps=[...touchPositions.values()],d=len(ps[0].x-ps[1].x,ps[0].y-ps[1].y),mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};if(pinch){view.scale=clamp(view.scale*d/pinch.d,.15,2.2);view.x-=(mid.x-pinch.mid.x)/view.scale;view.y-=(mid.y-pinch.mid.y)/view.scale;}pinch={d,mid};return}if(!pointer)return;
 if(sim.tool==='grab'){const before=world(pointer.x,pointer.y),after=world(e.offsetX,e.offsetY),n=nearNode(before.x,before.y);if(n){const dx=clamp(after.x-before.x,-30,30),dy=clamp(after.y-before.y,-30,30);n.x+=dx;n.y+=dy;n.px+=dx*.5;n.py+=dy*.5;}}
 if(sim.tool==='cut')toolAt(e.offsetX,e.offsetY,{x:pointer.x,y:pointer.y});pointer.prevX=pointer.x;pointer.prevY=pointer.y;pointer.x=e.offsetX;pointer.y=e.offsetY;});
function release(e){touchPositions.delete(e.pointerId);if(!touchPositions.size){pointer=null;pinch=null}}
c.addEventListener('pointerup',release);c.addEventListener('pointercancel',release);
$('ship').onchange=e=>loadShip(e.target.value);$('reset').onclick=()=>loadShip(sim.ship);$('pause').onclick=()=>{sim.paused=!sim.paused;$('pause').textContent=sim.paused?'Resume':'Pause'};
$('wave').onclick=()=>{sim.tsunami=10;sim.wave=Number($('waveHeight').value);};$('weather').onclick=()=>{sim.storm=[0,4,10,18,32][([0,4,10,18,32].indexOf(sim.storm)+1)%5];$('weather').textContent='🌬 Sea: '+['Calm','Light','Moderate','Rough','Extreme'][[0,4,10,18,32].indexOf(sim.storm)]};
$('strings').onclick=()=>{sim.showStrings=!sim.showStrings;$('strings').classList.toggle('active',sim.showStrings);$('showStrings').checked=sim.showStrings};$('showStrings').onchange=e=>{sim.showStrings=e.target.checked;$('strings').classList.toggle('active',sim.showStrings)};
$('showWater').onchange=e=>sim.showWater=e.target.checked;$('lights').onclick=()=>{sim.lights=!sim.lights;$('lights').classList.toggle('active',sim.lights)};
$('telegraph').onclick=()=>{sim.throttle=[0,.3,.65,1,-.5][([0,.3,.65,1,-.5].indexOf(sim.throttle)+1)%5];$('telegraph').textContent='⚙ '+({0:'Stop',.3:'Slow ahead',.65:'Half ahead',1:'Full ahead','-0.5':'Astern'}[sim.throttle])};
$('fit').onclick=()=>view={scale:Math.min((W-25)/1000,(H-25)/470),x:0,y:0};$('speed').oninput=e=>{sim.speed=+e.target.value;$('speedLabel').textContent=sim.speed+'×'};
for(const [id,key] of [['gravity','gravity'],['stiffness','stiffness'],['strength','strength'],['depth','depth']])$(id).oninput=e=>sim[key]=+e.target.value;
$('menuBtn').onclick=()=>$('menu').classList.toggle('open');$('closeMenu').onclick=()=>$('menu').classList.remove('open');
window.ABYSS_DEBUG={get sim(){return sim},step(seconds=1){for(let i=0;i<seconds*60;i++)physics(1/60)},cut(x1,y1,x2,y2,r=7){return sever(x1,y1,x2,y2,r)},reset:()=>loadShip(sim.ship)};
resize();loadShip('titanic');requestAnimationFrame(loop);
})();
