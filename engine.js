/* ABYSS Rebuilt Alpha 3. Independent particle-string simulation.
   No scripted keel hinge, no rigid-body poses, no positional registration.
   Artwork originates from the user's ABYSS game, not Floating Sandbox. */
(()=>{'use strict';
const $=id=>document.getElementById(id),c=$('scene'),ctx=c.getContext('2d',{alpha:false});
const VERSION='REBUILT α3';
const names={titanic:'RMS Titanic',britannic:'HMHS Britannic',lusitania:'RMS Lusitania',cargo:'MV Northstar',queenmary:'RMS Queen Mary',normandie:'SS Normandie',majestic:'RMS Majestic',lusitania_black:'RMS Lusitania — Black funnels',cruise:'Ocean Cruise Ship',container:'Container Ship',amatola:'SAS Amatola',edmund:'SS Edmund Fitzgerald'};
for(const [id,name] of Object.entries(names)){let o=document.createElement('option');o.value=id;o.textContent=name;$('ship').append(o)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),len=(x,y)=>Math.hypot(x,y),sea=(x,t)=>{const crestX=sim.tsunamiX+(10-sim.tsunami)*sim.tsunamiDir*85;const pulse=sim.tsunami>0?-sim.tsunamiHeight*Math.exp(-Math.pow((x-crestX)/Math.max(40,sim.tsunamiWidth),2))*Math.min(1,sim.tsunami):0;return sim.waterY+sim.wave*Math.sin(x*.008+t*1.6)+sim.swell*Math.sin(x*.021+t*2.3)+pulse;};
let W=1,H=1,dpr=1,view={scale:1,x:0,y:0},sim={time:0,paused:false,tool:'cut',ship:'titanic',nodes:[],links:[],grid:new Map(),image:null,mask:null,waterY:0,wave:0,swell:0,storm:0,tsunami:0,showStrings:false,showWater:true,lights:true,throttle:0,gravity:54,stiffness:.97,strength:1.7,depth:1400,speed:1,broken:0,wetMass:0,loaded:false,compartments:[],drops:[],inspect:null,particles:0,triangles:[],linkMap:new Map(),rigging:[],showRigging:true,showRooms:false,showMap:false,sound:false,day:0.55,tsunamiX:-500,tsunamiDir:1,tsunamiWidth:140,tsunamiHeight:40,prop:[],doors:Array(11).fill(false),pumpOn:false,lighting:true,cutWidth:5,unlimited:false,placeWave:false,pan:false,showCompartments:true,showSeabed:false,doorActive:-1},STEP=12,cols=76,rows=26;
let pointer=null,last=0,acc=0,frame=0,audioContext=null,engineOsc=null,engineGain=null;
function toggleEngineAudio(){
 try{
  if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();engineOsc=audioContext.createOscillator();engineGain=audioContext.createGain();
   engineOsc.type='sawtooth';engineOsc.frequency.value=52;engineGain.gain.value=0;engineOsc.connect(engineGain);engineGain.connect(audioContext.destination);engineOsc.start();}
  audioContext.resume();engineGain.gain.setTargetAtTime(sim.sound?.018:0,audioContext.currentTime,.12);
 }catch(e){sim.sound=false;}
}

function resize(){const r=c.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(2,devicePixelRatio||1);c.width=Math.floor(W*dpr);c.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!view.scale)view.scale=Math.min(W/1020,H/490);}
new ResizeObserver(resize).observe(c);
function world(x,y){return{x:(x-W/2)/view.scale+view.x,y:(y-H*.56)/view.scale+view.y}}
function screen(x,y){return{x:W/2+(x-view.x)*view.scale,y:H*.56+(y-view.y)*view.scale}}
function imageAt(id){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='assets/'+id+'.png'})}
function gridKey(x,y){return x+','+y}
function getNode(gx,gy){const id=sim.grid.get(gridKey(gx,gy));return id===undefined?null:sim.nodes[id]}
function pairKey(a,b){return Math.min(a,b)+':'+Math.max(a,b)}
function structuralLink(a,b){return sim.linkMap.get(pairKey(a.id,b.id))}
function connected(a,b){const l=structuralLink(a,b);return !!l&&!l.dead}
function makeTriangles(){
 sim.triangles=[];sim.linkMap=new Map();for(const l of sim.links)sim.linkMap.set(pairKey(l.a,l.b),l);
 for(const n of sim.nodes){const r=getNode(n.gx+1,n.gy),d=getNode(n.gx,n.gy+1),rd=getNode(n.gx+1,n.gy+1);
  for(const triple of [[n,r,rd],[n,rd,d]]){
   if(triple.some(x=>!x))continue;
   const [a,b,c]=triple,edges=[structuralLink(a,b),structuralLink(b,c),structuralLink(c,a)];
   if(edges.some(x=>!x))continue;
   sim.triangles.push({a:a.id,b:b.id,c:c.id,edges});
  }
 }
}
function nearestSource(x,y,requireBelow=false){let best=null,dist=1e9;for(const n of sim.nodes){if(requireBelow&&n.sy<y)continue;const dd=(n.sx-x)**2+(n.sy-y)**2;if(dd<dist){dist=dd;best=n}}return best}
function makeRigging(){
 sim.rigging=[];
 // Lines are only tensile: they do not hold pieces apart or act like stiff beams.
 const positions=[[.16,.34,.06,.71],[.16,.34,.25,.69],[.37,.30,.27,.71],[.37,.30,.48,.71],[.65,.29,.55,.72],[.65,.29,.78,.71],[.86,.34,.75,.74],[.86,.34,.96,.75]];
 for(const [ax,ay,bx,by] of positions){const a=nearestSource(ax*900,ay*300),b=nearestSource(bx*900,by*300);if(!a||!b||a===b)continue;
  const d=len(a.x-b.x,a.y-b.y);if(d<42||d>400)continue;
  sim.rigging.push({a:a.id,b:b.id,rest:d*1.015,dead:false,tension:0});
 }
}
function closestSegmentDistance(px,py,qx,qy,ax,ay,bx,by){
 const ux=qx-px,uy=qy-py,vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;
 const aa=ux*ux+uy*uy,bb=ux*vx+uy*vy,cc=vx*vx+vy*vy,dd=ux*wx+uy*wy,ee=vx*wx+vy*wy,D=aa*cc-bb*bb;
 let sc,tc,sN,tN,sD=D,tD=D;
 if(D<1e-9){sN=0;sD=1;tN=ee;tD=cc;}else{sN=bb*ee-cc*dd;tN=aa*ee-bb*dd;if(sN<0){sN=0;tN=ee;tD=cc;}else if(sN>sD){sN=sD;tN=ee+bb;tD=cc;}}
 if(tN<0){tN=0;if(-dd<0)sN=0;else if(-dd>aa)sN=sD;else{sN=-dd;sD=aa;}}
 else if(tN>tD){tN=tD;if(-dd+bb<0)sN=0;else if(-dd+bb>aa)sN=sD;else{sN=-dd+bb;sD=aa;}}
 sc=Math.abs(sN)<1e-9?0:sN/(sD||1);tc=Math.abs(tN)<1e-9?0:tN/(tD||1);
 return Math.hypot(wx+sc*ux-tc*vx,wy+sc*uy-tc*vy);
}
function loadShip(id){sim.loaded=false;$('loading').hidden=false;sim.ship=id;imageAt(id).then(im=>{
 sim.image=im;const off=document.createElement('canvas');off.width=900;off.height=300;const oc=off.getContext('2d',{willReadFrequently:true});oc.drawImage(im,0,0,900,300);const rgba=oc.getImageData(0,0,900,300).data;
 const alpha=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=900||y<0||y>=300)return 0;return rgba[(y*900+x)*4+3]};
 sim.mask=rgba;sim.nodes=[];sim.links=[];sim.grid=new Map();sim.rigging=[];sim.triangles=[];sim.broken=0;sim.time=0;sim.wave=0;sim.swell=0;sim.storm=0;sim.tsunami=0;sim.inspect=null;sim.waterY=0;
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
 for(const n of sim.nodes)for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1],[2,0],[0,2]]){
  const other=getNode(n.gx+dx,n.gy+dy);if(!other)continue;
  const midx=(n.sx+other.sx)/2,midy=(n.sy+other.sy)/2;
  if(alpha(midx,midy)<70)continue;
  // Longer beams are only valid through uninterrupted ship material, never across gaps.
  if(Math.abs(dx)+Math.abs(dy)>2 && alpha(n.sx+(other.sx-n.sx)*.25,n.sy+(other.sy-n.sy)*.25)<85)continue;
  if(Math.max(Math.abs(dx),Math.abs(dy))===2 && (!getNode(n.gx+dx/2,n.gy+dy/2)||alpha(n.sx+(other.sx-n.sx)*.75,n.sy+(other.sy-n.sy)*.75)<85))continue;
  const deep=n.sy>230&&other.sy>230,brace=Math.max(Math.abs(dx),Math.abs(dy))===2;
  sim.links.push({a:n.id,b:other.id,rest:len(n.x-other.x,n.y-other.y),strength:(sim.ship==='edmund'?.94:1)*(deep?1.24:1),damage:0,dead:false,brace});
 }
 makeTriangles();makeRigging();sim.doors=Array(11).fill(false);sim.compartments=Array.from({length:12},(_,i)=>({id:i,water:0,breach:0,pump:0}));sim.prop=[];sim.loaded=true;sim.particles=sim.nodes.length;
 view={scale:Math.min((W-25)/1000,(H-25)/470),x:0,y:0};$('loading').hidden=true;updateStatus();
 }).catch(e=>{$('loading').textContent='Could not load ship artwork: assets/'+id+'.png ('+(e?.message||'image request failed')+')';});}
function sever(x1,y1,x2,y2,radius=6,repair=false){
 let count=0;for(const l of sim.links){const a=sim.nodes[l.a],b=sim.nodes[l.b];
  if(closestSegmentDistance(x1,y1,x2,y2,a.x,a.y,b.x,b.y)>radius)continue;
  if(repair){if(l.dead&&len(a.x-b.x,a.y-b.y)<l.rest*1.36){l.dead=false;l.damage=0;sim.broken=Math.max(0,sim.broken-1);count++;}}
  else if(!l.dead){l.dead=true;sim.broken++;count++;}
 }
 if(!repair){for(const rope of sim.rigging){const a=sim.nodes[rope.a],b=sim.nodes[rope.b];if(closestSegmentDistance(x1,y1,x2,y2,a.x,a.y,b.x,b.y)<radius+1)rope.dead=true;}}
 if(!repair&&count){for(const n of sim.nodes){if(closestSegmentDistance(x1,y1,x2,y2,n.x,n.y,n.x,n.y)<radius+10){const cp=sim.compartments[clamp(Math.floor(n.sx/75),0,11)];cp.breach=Math.min(1,cp.breach+.012);}}}
 return count;
}
function updateSystems(dt){
 for(let i=0;i<sim.compartments.length;i++){
  const cp=sim.compartments[i];cp.pump=(sim.pumpOn&&cp.water>.005)?1.1:0;
  // Doors are initially OPEN. Closing one isolates its two compartments.
  if(i<11&&!sim.doors[i]){const next=sim.compartments[i+1],flow=clamp((cp.water-next.water)*dt*.7,-next.water,cp.water);cp.water-=flow;next.water+=flow;}
 }
}
function physics(dt){if(!sim.loaded)return;sim.time+=dt;const t=sim.time;updateSystems(dt);
 if(sim.tsunami>0)sim.tsunami=Math.max(0,sim.tsunami-dt);
 sim.wave+=(sim.storm-sim.wave)*Math.min(1,dt*2);
 // Water enters damaged compartments; each wet structural point gains local mass.
 for(const cp of sim.compartments){let submerged=0,total=0;for(const n of sim.nodes){if(Math.floor(n.sx/75)!==cp.id)continue;total++;if(n.y>sea(n.x,t))submerged++;}
  const pressure=total?submerged/total:0;
  cp.water=clamp(cp.water+(cp.breach*pressure*1.4-cp.pump*.65)*dt,0,1);if(!sim.pumpOn)cp.pump=Math.max(0,cp.pump-dt*.1);
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
 const iters=18;
 for(let k=0;k<iters;k++)for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
  if(k===0)l.peak=Math.max(0,(d-l.rest)/l.rest);const correction=(d-l.rest)/d*sim.stiffness*(l.brace?.36:.49);
  a.x+=dx*correction;a.y+=dy*correction;b.x-=dx*correction;b.y-=dy*correction;
 }
 // Rigging uses tension-only constraints; ropes may slacken but cannot push apart.
 for(const rope of sim.rigging){if(rope.dead)continue;const a=sim.nodes[rope.a],b=sim.nodes[rope.b];const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
  rope.tension=Math.max(0,d/rope.rest-1);if(d>rope.rest*1.72){rope.dead=true;continue;}
  if(d>rope.rest){const pull=(d-rope.rest)/d*.12;a.x+=dx*pull;a.y+=dy*pull;b.x-=dx*pull;b.y-=dy*pull;}
 }
 // Stress accumulates on real strings. No cut-qualification scripting.
 // High safety factor prevents ordinary ocean swell from shredding a ship.
 let breaks=0;for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],ratio=Math.max(len(a.x-b.x,a.y-b.y)/l.rest,1+(l.peak||0));
  if(ratio>l.strength*sim.strength)l.damage+=(ratio-l.strength*sim.strength)*dt*2.4;
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
 // Continuous textured string triangles: NO square tile rendering. Every
 // texture triangle is supported by three surviving structural connections.
 // Once a connection tears, its affected skin triangles open naturally.
 const im=sim.image,s=view.scale;
 for(const tri of sim.triangles){if(tri.edges.some(l=>l.dead))continue;
  const a=sim.nodes[tri.a],b=sim.nodes[tri.b],cc=sim.nodes[tri.c];
  const pa=screen(a.x,a.y),pb=screen(b.x,b.y),pc=screen(cc.x,cc.y);
  if(Math.max(pa.x,pb.x,pc.x)<-25||Math.min(pa.x,pb.x,pc.x)>W+25||Math.max(pa.y,pb.y,pc.y)<-25||Math.min(pa.y,pb.y,pc.y)>H+25)continue;
  const sx1=a.sx,sy1=a.sy,sx2=b.sx,sy2=b.sy,sx3=cc.sx,sy3=cc.sy;
  const det=(sx2-sx1)*(sy3-sy1)-(sx3-sx1)*(sy2-sy1);if(Math.abs(det)<1e-5)continue;
  const ux=(pa.x*(sy2-sy3)+pb.x*(sy3-sy1)+pc.x*(sy1-sy2))/det;
  const vx=(pa.y*(sy2-sy3)+pb.y*(sy3-sy1)+pc.y*(sy1-sy2))/det;
  const uy=(pa.x*(sx3-sx2)+pb.x*(sx1-sx3)+pc.x*(sx2-sx1))/det;
  const vy=(pa.y*(sx3-sx2)+pb.y*(sx1-sx3)+pc.y*(sx2-sx1))/det;
  const tx=pa.x-ux*sx1-uy*sy1,ty=pa.y-vx*sx1-vy*sy1;
  // Severely distorted triangles disappear rather than creating long smeared images.
  const scaleX=Math.hypot(ux,vx),scaleY=Math.hypot(uy,vy);
  if(scaleX>s*1.7||scaleY>s*1.7||scaleX<s*.25||scaleY<s*.25)continue;
  const minx=clamp(Math.floor(Math.min(sx1,sx2,sx3)-2),0,899),miny=clamp(Math.floor(Math.min(sy1,sy2,sy3)-2),0,299);
  const maxx=clamp(Math.ceil(Math.max(sx1,sx2,sx3)+2),1,900),maxy=clamp(Math.ceil(Math.max(sy1,sy2,sy3)+2),1,300);
  if(maxx<=minx||maxy<=miny)continue;
  ctx.save();ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.lineTo(pc.x,pc.y);ctx.closePath();ctx.clip();ctx.transform(ux,vx,uy,vy,tx,ty);
  ctx.drawImage(im,minx,miny,maxx-minx,maxy-miny,minx,miny,maxx-minx,maxy-miny);ctx.restore();
 }
 // The actual tension ropes are separate physical elements, drawn above skin.
 if(sim.showRigging){ctx.lineWidth=Math.max(.6,.9*s);for(const rope of sim.rigging){if(rope.dead)continue;
  const a=sim.nodes[rope.a],b=sim.nodes[rope.b],p=screen(a.x,a.y),q=screen(b.x,b.y);
  const sag=Math.min(15*s,Math.max(0,1-rope.tension*8)*6*s);
  ctx.strokeStyle=rope.tension>.3?'#f2aa78b9':'#bdcdd7bf';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo((p.x+q.x)/2,(p.y+q.y)/2+sag,q.x,q.y);ctx.stroke();
 }}
 if(sim.showRooms||sim.showCompartments){for(let i=1;i<12;i++){const anchor=nearestSource(i*75,210);if(!anchor)continue;const pp=screen(anchor.x,anchor.y);
  ctx.lineWidth=1;ctx.strokeStyle=sim.doors[i-1]?'#f2ba80c9':'#61e0bfa6';ctx.beginPath();ctx.moveTo(pp.x,pp.y-28*s);ctx.lineTo(pp.x,pp.y+25*s);ctx.stroke();}}
 if(sim.lights){for(const node of sim.nodes){if(node.sy>155||node.sy<70||node.gx%4!==0||node.gy%3!==0)continue;const pp=screen(node.x,node.y);ctx.fillStyle='#ffe7a9c0';ctx.beginPath();ctx.arc(pp.x,pp.y,Math.max(.8,s*1.5),0,Math.PI*2);ctx.fill();}}
 if(sim.showWater){for(const n of sim.nodes){if(n.water<.035)continue;const p=screen(n.x,n.y);ctx.fillStyle=`rgba(25,142,220,${Math.min(.48,n.water*.5)})`;ctx.fillRect(p.x-STEP*s/2,p.y-STEP*s/2,STEP*s,STEP*s);}}
 if(sim.showStrings){ctx.lineWidth=Math.max(.65,view.scale*.9);for(const l of sim.links){if(l.dead)continue;const a=sim.nodes[l.a],b=sim.nodes[l.b],pa=screen(a.x,a.y),pb=screen(b.x,b.y);ctx.strokeStyle=l.damage>.2?'#ff9458bb':'#76dce7a0';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();}}
 }
 // Transparent surface overlay is drawn after the ship, showing immersion.
 ctx.fillStyle='rgba(15,93,136,.23)';ctx.beginPath();ctx.moveTo(0,H);for(let sx=0;sx<=W+12;sx+=12){const wx=world(sx,0).x;ctx.lineTo(sx,screen(wx,sea(wx,sim.time)).y)}ctx.lineTo(W,H);ctx.fill();
 ctx.strokeStyle='#b1e6f4b0';ctx.lineWidth=1.2;ctx.beginPath();for(let sx=0;sx<=W+12;sx+=12){const wx=world(sx,0).x,yy=screen(wx,sea(wx,sim.time)).y;if(!sx)ctx.moveTo(sx,yy);else ctx.lineTo(sx,yy)}ctx.stroke();
 if(sim.prop.length){for(const obj of sim.prop){const v=screen(obj.x,obj.y);ctx.font=`${Math.max(14,22*view.scale)}px system-ui`;ctx.fillText(obj.glyph,v.x,v.y)}}
 if(sim.showMap){ctx.fillStyle='#061c2ee8';ctx.fillRect(W-252,12,240,90);ctx.fillStyle='#e3f8ff';ctx.font='11px system-ui';ctx.fillText('SHIP MAP / WATERTIGHT COMPARTMENTS',W-241,30);
  for(let i=0;i<12;i++){const cp=sim.compartments[i],xx=W-242+i*19.1;ctx.fillStyle='#0f3448';ctx.fillRect(xx,45,17,31);ctx.fillStyle='#36a4d1';ctx.fillRect(xx,76-31*cp.water,17,31*cp.water);ctx.strokeStyle=i<11&&sim.doors[i]?'#f4ac67':'#76d7ce';ctx.strokeRect(xx,45,17,31);}ctx.fillStyle='#bcd7e5';ctx.fillText('Orange = sealed bulkhead    Blue = flood level',W-240,90);}
 if(sim.day<.5){ctx.fillStyle=`rgba(1,10,27,${(.5-sim.day)*.55})`;ctx.fillRect(0,0,W,H)}
 if(pointer?.down&&sim.tool==='cut'){ctx.strokeStyle='#ff705e';ctx.lineWidth=Math.max(2,sim.cutWidth*view.scale*1.6);ctx.beginPath();ctx.moveTo(pointer.startX,pointer.startY);ctx.lineTo(pointer.x,pointer.y);ctx.stroke()}
 if(sim.inspect){const p=screen(sim.inspect.x,sim.inspect.y);ctx.fillStyle='#061b2ee0';ctx.fillRect(clamp(p.x+12,0,W-170),clamp(p.y-60,0,H-80),170,58);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText('Compartment '+(sim.inspect.id+1),clamp(p.x+20,8,W-160),clamp(p.y-40,18,H-60));ctx.fillText('Flooded '+Math.round(sim.compartments[sim.inspect.id].water*100)+'%',clamp(p.x+20,8,W-160),clamp(p.y-20,34,H-40));}
}
function updateStatus(){const flooded=sim.compartments.reduce((a,b)=>a+b.water,0)/12;const alive=sim.links.reduce((a,l)=>a+(!l.dead),0);$('status').innerHTML=`<strong>${names[sim.ship]}</strong> · Particle-string engine<br>${sim.nodes.length} points · ${alive} load-bearing strings · ${sim.broken} broken · ${sim.triangles.length} skin triangles<br>Flooding ${Math.round(flooded*100)}% · ${sim.paused?'Paused':'Running'} · ${sim.speed}×`;}
function loop(now){const dt=Math.min(.045,(now-last)/1000||.016);last=now;if(!sim.paused){acc+=dt*sim.speed;let steps=0;while(acc>=1/60&&steps<5){physics(1/60);acc-=1/60;steps++;}}draw();if(frame++%12===0){updateStatus();if(audioContext&&engineOsc&&sim.sound)engineOsc.frequency.setTargetAtTime(44+Math.abs(sim.throttle)*65,audioContext.currentTime,.18);}requestAnimationFrame(loop)}
function setTool(t){sim.tool=t;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===t)}
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool(b.dataset.tool);
function nearNode(x,y){let best=null,d=Infinity;for(const n of sim.nodes){const nd=len(n.x-x,n.y-y);if(nd<d){d=nd;best=n}}return d<35?best:null}
function toolAt(x,y,prev=null){if(!sim.loaded)return;const p=world(x,y),q=prev?world(prev.x,prev.y):p;
 if(sim.tool==='cut'){sever(q.x,q.y,p.x,p.y,sim.cutWidth)}
 else if(sim.tool==='hole'){sever(p.x-10,p.y-10,p.x+10,p.y+10,14);}
 else if(sim.tool==='blast'){sever(p.x-30,p.y-35,p.x+30,p.y+35,32);for(const n of sim.nodes){if(len(n.x-p.x,n.y-p.y)<70){n.x+=(n.x-p.x)*.12;n.y+=(n.y-p.y)*.12;}}}
 else if(sim.tool==='pump'){const n=nearNode(p.x,p.y);if(n)sim.compartments[clamp(Math.floor(n.sx/75),0,11)].water=Math.max(0,sim.compartments[clamp(Math.floor(n.sx/75),0,11)].water-.2)}
 else if(sim.tool==='repair'){sever(p.x-18,p.y-18,p.x+18,p.y+18,20,true)}
 else if(sim.tool==='flood'){const n=nearNode(p.x,p.y);if(n){const cp=sim.compartments[clamp(Math.floor(n.sx/75),0,11)];cp.water=clamp(cp.water+.18,0,1);cp.breach=clamp(cp.breach+.12,0,1)}}
 else if(sim.tool==='rigcut'){for(const rope of sim.rigging){if(rope.dead)continue;const a=sim.nodes[rope.a],b=sim.nodes[rope.b];if(closestSegmentDistance(p.x,p.y,p.x,p.y,a.x,a.y,b.x,b.y)<12)rope.dead=true;}}
 else if(sim.tool==='inspect'){const n=nearNode(p.x,p.y);if(n)sim.inspect={x:p.x,y:p.y,id:clamp(Math.floor(n.sx/75),0,11)}}
}
let touchPositions=new Map(),pinch=null;
c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);touchPositions.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(touchPositions.size>1){pointer=null;pinch=null;return}pointer={down:true,startX:e.offsetX,startY:e.offsetY,x:e.offsetX,y:e.offsetY,prevX:e.offsetX,prevY:e.offsetY};if(sim.placeWave){sim.tsunamiX=world(e.offsetX,e.offsetY).x;sim.placeWave=false;const el=$('wavePlace');if(el)el.classList.remove('active');pointer=null;return;}if(sim.tool==='cut'||sim.tool==='rigcut')toolAt(e.offsetX,e.offsetY);else toolAt(e.offsetX,e.offsetY);});
c.addEventListener('pointermove',e=>{if(!touchPositions.has(e.pointerId))return;touchPositions.set(e.pointerId,{x:e.offsetX,y:e.offsetY});if(touchPositions.size>=2){const ps=[...touchPositions.values()],d=len(ps[0].x-ps[1].x,ps[0].y-ps[1].y),mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};if(pinch){view.scale=clamp(view.scale*d/pinch.d,.15,2.2);view.x-=(mid.x-pinch.mid.x)/view.scale;view.y-=(mid.y-pinch.mid.y)/view.scale;}pinch={d,mid};return}if(!pointer)return;
 if(sim.pan){view.x-=(e.offsetX-pointer.x)/view.scale;view.y-=(e.offsetY-pointer.y)/view.scale;}else if(sim.tool==='grab'){const before=world(pointer.x,pointer.y),after=world(e.offsetX,e.offsetY),n=nearNode(before.x,before.y);if(n){const dx=clamp(after.x-before.x,-30,30),dy=clamp(after.y-before.y,-30,30);n.x+=dx;n.y+=dy;n.px+=dx*.5;n.py+=dy*.5;}}
 if(!sim.pan&&(sim.tool==='cut'||sim.tool==='rigcut'))toolAt(e.offsetX,e.offsetY,{x:pointer.x,y:pointer.y});pointer.prevX=pointer.x;pointer.prevY=pointer.y;pointer.x=e.offsetX;pointer.y=e.offsetY;});
function release(e){touchPositions.delete(e.pointerId);if(!touchPositions.size){pointer=null;pinch=null}}
c.addEventListener('pointerup',release);c.addEventListener('pointercancel',release);
$('ship').onchange=e=>loadShip(e.target.value);$('reset').onclick=()=>loadShip(sim.ship);$('pause').onclick=()=>{sim.paused=!sim.paused;$('pause').textContent=sim.paused?'Resume':'Pause'};
$('wave').onclick=()=>{sim.tsunamiHeight=Number($('waveHeight').value);sim.tsunami=10;};$('weather').onclick=()=>{sim.storm=[0,4,10,18,32][([0,4,10,18,32].indexOf(sim.storm)+1)%5];$('weather').textContent='🌬 Sea: '+['Calm','Light','Moderate','Rough','Extreme'][[0,4,10,18,32].indexOf(sim.storm)]};
$('strings').onclick=()=>{sim.showStrings=!sim.showStrings;$('strings').classList.toggle('active',sim.showStrings);$('showStrings').checked=sim.showStrings};$('showStrings').onchange=e=>{sim.showStrings=e.target.checked;$('strings').classList.toggle('active',sim.showStrings)};
$('showWater').onchange=e=>sim.showWater=e.target.checked;$('lights').onclick=()=>{sim.lights=!sim.lights;$('lights').classList.toggle('active',sim.lights)};
$('telegraph').onclick=()=>{sim.throttle=[0,.3,.65,1,-.5][([0,.3,.65,1,-.5].indexOf(sim.throttle)+1)%5];$('telegraph').textContent='⚙ '+({0:'Stop',.3:'Slow ahead',.65:'Half ahead',1:'Full ahead','-0.5':'Astern'}[sim.throttle])};
$('fit').onclick=()=>view={scale:Math.min((W-25)/1000,(H-25)/470),x:0,y:0};$('speed').oninput=e=>{sim.speed=+e.target.value;$('speedLabel').textContent=sim.speed+'×'};
for(const [id,key] of [['gravity','gravity'],['stiffness','stiffness'],['strength','strength'],['depth','depth']])$(id).oninput=e=>sim[key]=+e.target.value;
$('menuBtn').onclick=()=>$('menu').classList.toggle('open');$('closeMenu').onclick=()=>$('menu').classList.remove('open');
function bindButton(id,fn){const el=$(id);if(el)el.onclick=fn}
const setLabel=(id,v)=>{const el=$(id);if(el)el.textContent=v};
bindButton('rigging',()=>{sim.showRigging=!sim.showRigging;$('rigging').classList.toggle('active',sim.showRigging)});
bindButton('rooms',()=>{sim.showRooms=!sim.showRooms;$('rooms').classList.toggle('active',sim.showRooms)});
bindButton('doors',()=>{const closed=sim.doors.some(x=>x);sim.doors.fill(!closed);setLabel('doors',closed?'🚪 Seal doors':'🚪 Open doors');});
bindButton('pump',()=>{sim.pumpOn=!sim.pumpOn;$('pump').classList.toggle('active',sim.pumpOn);setLabel('pump',sim.pumpOn?'💦 Pumps ON':'💦 Pumps OFF')});
bindButton('map',()=>{sim.showMap=!sim.showMap;$('map').classList.toggle('active',sim.showMap)});
bindButton('audio',()=>{sim.sound=!sim.sound;toggleEngineAudio();$('audio').classList.toggle('active',sim.sound);setLabel('audio',sim.sound?'🔊 Sound ON':'🔇 Sound OFF');});
bindButton('night',()=>{sim.day=sim.day>.5?.25:1;$('night').classList.toggle('active',sim.day<.5);});
bindButton('spawn',()=>{sim.prop.push({x:-150+Math.random()*300,y:-165,glyph:['🛟','🪵','⚓'][sim.prop.length%3]});});
bindButton('zoomIn',()=>{view.scale=clamp(view.scale*1.25,.15,3)});
bindButton('zoomOut',()=>{view.scale=clamp(view.scale/1.25,.15,3)});
bindButton('allDoors',()=>{sim.doors.fill(false);setLabel('doors','🚪 Seal doors')});
bindButton('resetRig',()=>{makeRigging()});
const cw=$('cutWidth');if(cw)cw.oninput=e=>{sim.cutWidth=+e.target.value;setLabel('cutWidthValue',sim.cutWidth+'')};
const doorList=$('doorList');if(doorList){for(let i=0;i<11;i++){const b=document.createElement('button');b.textContent='Door '+(i+1)+' ⛔';b.onclick=()=>{sim.doors[i]=!sim.doors[i];b.textContent='Door '+(i+1)+(sim.doors[i]?' ✅':' ⛔');};doorList.appendChild(b);}}

// Original ABYSS-style operator controls, restored around the replacement physics.
const shipList=$('fleetList');
if(shipList){for(const [id,name] of Object.entries(names)){const btn=document.createElement('button');btn.dataset.ship=id;btn.textContent=name;btn.onclick=()=>{$('ship').value=id;loadShip(id);shipList.classList.remove('open');};shipList.append(btn);}}
function togglePanel(id){for(const k of ['fleetPanel','worldPanel','compartmentPanel','bridgePanel','tsunamiPanel','propsPanel']){const el=$(k);if(el)el.hidden=k!==id?!0:!el.hidden;}}
for(const [button,panel] of [['fleetBtn','fleetPanel'],['worldBtn','worldPanel'],['compartmentBtn','compartmentPanel'],['bridgeBtn','bridgePanel'],['tsunamiSettingsBtn','tsunamiPanel'],['propsBtn','propsPanel']])bindButton(button,()=>togglePanel(panel));
function renderCompartments(){const root=$('compartmentGrid');if(!root)return;root.replaceChildren();for(let i=0;i<12;i++){
 const cp=sim.compartments[i],wrap=document.createElement('div');wrap.className='bay';wrap.style.setProperty('--flood',`${Math.round(cp.water*100)}%`);
 const title=document.createElement('strong');title.textContent=`${i+1} · ${Math.round(cp.water*100)}%`;wrap.append(title);
 if(i<11){const b=document.createElement('button');b.textContent=sim.doors[i]?'🔒 Sealed':'🔓 Open';b.className=sim.doors[i]?'sealed':'';b.onclick=()=>{sim.doors[i]=!sim.doors[i];renderCompartments()};wrap.append(b)}
 const drain=document.createElement('button');drain.textContent='Pump';drain.onclick=()=>{cp.water=Math.max(0,cp.water-.22);renderCompartments()};wrap.append(drain);root.append(wrap);}}
setInterval(renderCompartments,900);
bindButton('sealAll',()=>{sim.doors.fill(true);renderCompartments();setLabel('doors','🚪 Open doors')});
bindButton('openAll',()=>{sim.doors.fill(false);renderCompartments();setLabel('doors','🚪 Seal doors')});
bindButton('placeWave',()=>{sim.placeWave=true;$('placeWave').classList.add('active');});
bindButton('fireWave',()=>{sim.tsunami=10;sim.wave=sim.tsunamiHeight;});
for(const [id,key] of [['waveStart','tsunamiX'],['tsuHeight','tsunamiHeight'],['tsuWidth','tsunamiWidth'],['worldDepth','depth']]){const el=$(id);if(el)el.oninput=()=>{sim[key]=+el.value;const out=$(id+'Value');if(out)out.textContent=el.value;};}
const direction=$('tsuDirection');if(direction)direction.onchange=()=>sim.tsunamiDir=+direction.value;
const worldTime=$('worldTime');if(worldTime)worldTime.oninput=()=>{sim.day=+worldTime.value/24;setLabel('worldClock',String(Math.floor(+worldTime.value)).padStart(2,'0')+':00')};
const seas=$('seaState');if(seas)seas.oninput=()=>{const states=[0,1.5,3,5,8,12,17,24,34];sim.storm=states[+seas.value];setLabel('seaLabel',['Calm','Ripple','Smooth','Slight','Moderate','Fresh','Rough','High','Extreme'][+seas.value])};
const doorBtns=document.querySelectorAll('#doorList button');for(let i=0;i<doorBtns.length;i++){doorBtns[i].onclick=()=>{sim.doors[i]=!sim.doors[i];doorBtns[i].textContent='Door '+(i+1)+(sim.doors[i]?' 🔒':' 🔓');renderCompartments()}}
bindButton('panBtn',()=>{sim.pan=!sim.pan;$('panBtn').classList.toggle('active',sim.pan)});
bindButton('resetView',()=>view={scale:Math.min((W-25)/1000,(H-25)/470),x:0,y:0});
bindButton('worldMapBtn',()=>{sim.showMap=!sim.showMap;$('worldMapBtn').classList.toggle('active',sim.showMap)});
bindButton('toggleRooms',()=>{sim.showCompartments=!sim.showCompartments;$('toggleRooms').classList.toggle('active',sim.showCompartments)});
bindButton('destroyBow',()=>{sever(-390,-100,-380,30,14)});
bindButton('destroyStern',()=>{sever(370,-100,380,30,14)});
bindButton('rigRestore',()=>makeRigging());
renderCompartments();

window.ABYSS_DEBUG={get sim(){return sim},step(seconds=1){for(let i=0;i<seconds*60;i++)physics(1/60)},cut(x1,y1,x2,y2,r=7){return sever(x1,y1,x2,y2,r)},reset:()=>loadShip(sim.ship)};
resize();loadShip('titanic');requestAnimationFrame(loop);
})();
