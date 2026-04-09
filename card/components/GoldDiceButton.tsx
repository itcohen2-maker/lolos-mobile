// GoldDiceButton.tsx — Animated gold button with 3D isometric dice (WebView canvas)
// No limbs version — dice bounce, slide, tumble, hop with sparkles and trails
import React, { useRef, useCallback, useState } from 'react';
import { View, Pressable, Animated, Platform, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface GoldDiceButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  width?: number;
  style?: any;
}

function buildDiceHTML(w: number, h: number): string {
  return `<!DOCTYPE html><html><head><meta name="viewport"
content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block}</style></head><body><canvas
id="btnCanvas"></canvas><script>
(function(){
var cv=document.getElementById("btnCanvas"),dpr=Math.min(window.devicePixelRatio||1,2);
var BW=${w},BH=${h};
cv.width=BW*dpr;cv.height=BH*dpr;cv.style.width=BW+"px";cv.style.height=BH+"px";

var bgCv=document.createElement("canvas");bgCv.width=BW*dpr;bgCv.height=BH*dpr;
var bg=bgCv.getContext("2d");bg.scale(dpr,dpr);
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}

var gg=bg.createRadialGradient(BW*0.3,BH*0.25,5,BW/2,BH*0.7,BW*0.7);
gg.addColorStop(0,"#F5D26B");gg.addColorStop(0.15,"#ECC040");gg.addColorStop(0.35,"#E8B830");gg.addColorStop(0.55,"#D9A020");gg.addColorStop(0.75,"#C48A18");gg.addColorStop(1,"#9A6A0A");
rr(bg,0,0,BW,BH,12);bg.fillStyle=gg;bg.fill();

var lg2=bg.createLinearGradient(0,0,BW,BH);
lg2.addColorStop(0,"rgba(255,220,100,0.15)");lg2.addColorStop(0.3,"rgba(220,160,30,0.05)");lg2.addColorStop(0.7,"rgba(180,120,20,0.08)");lg2.addColorStop(1,"rgba(140,80,10,0.18)");
bg.fillStyle=lg2;rr(bg,0,0,BW,BH,12);bg.fill();

bg.save();rr(bg,0,0,BW,BH,12);bg.clip();
for(var i=0;i<3000;i++){var rx=Math.random();var op=0.05+Math.random()*0.05;bg.fillStyle=rx>0.7?"rgba(255,220,120,"+op+")":rx>0.35?"rgba(180,130,40,"+(op+0.02)+")":"rgba(100,65,15,"+(op+0.01)+")";bg.fillRect(Math.random()*BW,Math.random()*BH,Math.random()>0.6?2:1,1)}bg.restore();

bg.save();rr(bg,0,0,BW,BH,12);bg.clip();
var ev=bg.createRadialGradient(BW*0.42,BH*0.35,BH*0.4,BW*0.5,BH*0.5,BW*0.65);
ev.addColorStop(0,"rgba(0,0,0,0)");ev.addColorStop(0.5,"rgba(0,0,0,0)");ev.addColorStop(0.8,"rgba(80,45,5,0.12)");ev.addColorStop(1,"rgba(40,20,0,0.3)");
bg.fillStyle=ev;bg.fillRect(0,0,BW,BH);bg.restore();

bg.save();rr(bg,1,1,BW-2,BH/2,11);
var bv=bg.createLinearGradient(0,0,0,BH*0.5);
bv.addColorStop(0,"rgba(255,240,180,0.2)");bv.addColorStop(0.5,"rgba(255,220,120,0.06)");bv.addColorStop(1,"rgba(255,200,80,0)");
bg.fillStyle=bv;bg.fill();bg.restore();

bg.save();rr(bg,0,BH*0.6,BW,BH*0.4,12);
var bd=bg.createLinearGradient(0,BH*0.6,0,BH);
bd.addColorStop(0,"rgba(0,0,0,0)");bd.addColorStop(0.5,"rgba(60,35,5,0.1)");bd.addColorStop(1,"rgba(30,15,0,0.18)");
bg.fillStyle=bd;bg.fill();bg.restore();

rr(bg,0.4,0.4,BW-0.8,BH-0.8,12);bg.strokeStyle="rgba(255,230,140,0.16)";bg.lineWidth=0.8;bg.stroke();

var S=11;
var IX=S*0.95,IY=S*0.55,JX=-S*0.95,JY=S*0.55,KY=-S*1.1;

var pipL={1:[[0,0]],2:[[-0.3,-0.3],[0.3,0.3]],3:[[-0.3,-0.3],[0,0],[0.3,0.3]],4:[[-0.3,-0.3],[0.3,-0.3],[-0.3,0.3],[0.3,0.3]],5:[[-0.3,-0.3],[0.3,-0.3],[0,0],[-0.3,0.3],[0.3,0.3]],6:[[-0.3,-0.3],[0.3,-0.3],[-0.3,0],[0.3,0],[-0.3,0.3],[0.3,0.3]]};

function facesFor(d){
  var c=[[1,2,3],[6,5,4],[2,6,3],[5,1,4],[3,1,2],[4,6,5],[1,3,5],[6,4,2],[2,1,4],[5,6,3],[3,6,1],[4,1,6]];
  return c[d.fI%c.length];
}

function drawPips(ctx,cx,cy,uX,uY,vX,vY,val,pr,alpha){
  (pipL[val]||[]).forEach(function(p){
    var px=cx+p[0]*uX*1.5+p[1]*vX*1.5;
    var py=cy+p[0]*uY*1.5+p[1]*vY*1.5;
    ctx.beginPath();ctx.arc(px+0.2,py+0.3,pr*1.15,0,Math.PI*2);
    ctx.fillStyle="rgba(80,50,10,"+(0.35*alpha)+")";ctx.fill();
    var pg=ctx.createRadialGradient(px-pr*0.2,py-pr*0.25,pr*0.1,px,py,pr);
    pg.addColorStop(0,"rgba(255,255,255,"+alpha+")");
    pg.addColorStop(0.4,"rgba(245,240,230,"+(alpha*0.95)+")");
    pg.addColorStop(0.8,"rgba(220,210,195,"+(alpha*0.85)+")");
    pg.addColorStop(1,"rgba(190,175,155,"+(alpha*0.7)+")");
    ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fillStyle=pg;ctx.fill();
    ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);
    ctx.strokeStyle="rgba(160,130,80,"+(0.25*alpha)+")";ctx.lineWidth=0.3;ctx.stroke();
    ctx.beginPath();ctx.arc(px-pr*0.15,py-pr*0.2,pr*0.4,0,Math.PI*2);
    ctx.fillStyle="rgba(255,255,255,"+(0.5*alpha)+")";ctx.fill();
  });
}

function draw3D(ctx,x,y,sc,rot,sqX,sqY,faces){
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(sqX*sc,sqY*sc);
  ctx.beginPath();ctx.moveTo(0,KY);ctx.lineTo(IX,IY+KY);ctx.lineTo(0,IY+JY+KY);ctx.lineTo(JX,JY+KY);ctx.closePath();
  var tg=ctx.createLinearGradient(0,KY,0,IY+JY+KY);
  tg.addColorStop(0,"#F8DA70");tg.addColorStop(0.4,"#EDBE38");tg.addColorStop(1,"#DBA828");
  ctx.fillStyle=tg;ctx.fill();ctx.strokeStyle="rgba(160,120,25,0.3)";ctx.lineWidth=0.4;ctx.stroke();
  drawPips(ctx,0,KY+(IY+JY)/2,IX*0.38,IY*0.38,JX*0.38,JY*0.38,faces[0],S*0.09,1);
  ctx.beginPath();ctx.moveTo(IX,IY+KY);ctx.lineTo(IX,IY);ctx.lineTo(0,IY+JY);ctx.lineTo(0,IY+JY+KY);ctx.closePath();
  var rg=ctx.createLinearGradient(IX,IY+KY,0,IY+JY);
  rg.addColorStop(0,"#D9A825");rg.addColorStop(0.5,"#C49218");rg.addColorStop(1,"#A87A10");
  ctx.fillStyle=rg;ctx.fill();ctx.strokeStyle="rgba(140,95,18,0.25)";ctx.lineWidth=0.4;ctx.stroke();
  drawPips(ctx,IX/2,(IY+KY+IY+IY+JY+IY+JY+KY)/4,IX*0.32,0,0,-KY*0.32,faces[1],S*0.075,0.85);
  ctx.beginPath();ctx.moveTo(JX,JY+KY);ctx.lineTo(0,IY+JY+KY);ctx.lineTo(0,IY+JY);ctx.lineTo(JX,JY);ctx.closePath();
  var lgr=ctx.createLinearGradient(JX,JY+KY,0,IY+JY);
  lgr.addColorStop(0,"#B8880E");lgr.addColorStop(0.5,"#9A6E08");lgr.addColorStop(1,"#7A5505");
  ctx.fillStyle=lgr;ctx.fill();ctx.strokeStyle="rgba(110,75,12,0.2)";ctx.lineWidth=0.4;ctx.stroke();
  drawPips(ctx,JX/2,(JY+KY+IY+JY+KY+IY+JY+JY)/4,JX*0.32,0,0,-KY*0.32,faces[2],S*0.07,0.7);
  ctx.beginPath();ctx.moveTo(JX,JY+KY);ctx.lineTo(0,KY);ctx.lineTo(IX,IY+KY);
  ctx.strokeStyle="rgba(255,240,180,0.25)";ctx.lineWidth=0.6;ctx.stroke();
  ctx.restore();
}

var sparks=[],trails=[];
function addSpark(x,y,vx,vy){sparks.push({x:x,y:y,vx:vx+Math.random()*30-15,vy:vy+Math.random()*20-15,life:0.3+Math.random()*0.5,maxLife:0.3+Math.random()*0.5,size:0.5+Math.random()*1.5})}
function addTrail(x,y,sz){trails.push({x:x,y:y,life:0.25,maxLife:0.25,size:sz||3})}

var md=[],DSIZE=S*2,PAD=10;
for(var di=0;di<3;di++)md.push({
  x:28+di*48+Math.random()*10,y:BH/2+Math.random()*8-4,
  vx:(Math.random()-0.5)*35,vy:(Math.random()-0.5)*12,
  fI:Math.floor(Math.random()*12),rot:0,rotV:0,
  bO:Math.random()*Math.PI*2,ps:0.8+Math.random()*0.5,
  state:"walk",stateT:0,stateD:1+Math.random()*2,
  tumbleDir:1,squashX:1,squashY:1,glow:0
});

function pick(d){
  var r=Math.random();
  if(r<0.18){d.state="run";d.stateD=0.6+Math.random()*1;d.vx=(Math.random()>0.5?1:-1)*(35+Math.random()*20)*d.ps;d.vy=(Math.random()-0.5)*12}
  else if(r<0.35){d.state="slide";d.stateD=0.5+Math.random()*0.7;d.vx=(d.vx>0?1:-1)*(40+Math.random()*25)*d.ps;d.vy*=0.3;d.rotV=0}
  else if(r<0.5){d.state="tumble";d.stateD=0.4+Math.random()*0.6;d.tumbleDir=Math.random()>0.5?1:-1;d.rotV=d.tumbleDir*(8+Math.random()*6);d.vx=(Math.random()-0.5)*40*d.ps;d.vy=(Math.random()-0.5)*12}
  else if(r<0.62){d.state="hop";d.stateD=0.3+Math.random()*0.3;d.vx=(Math.random()-0.5)*25*d.ps;d.vy=0}
  else if(r<0.72){d.state="spin";d.stateD=0.4+Math.random()*0.5;d.rotV=(Math.random()>0.5?1:-1)*(10+Math.random()*6);d.vx*=0.5;d.vy*=0.5}
  else if(r<0.82){d.state="rest";d.stateD=0.3+Math.random()*1;d.vx*=0.1;d.vy*=0.1;d.rotV=0}
  else{d.state="walk";d.stateD=0.8+Math.random()*1.5;d.vx=(Math.random()-0.5)*20*d.ps;d.vy=(Math.random()-0.5)*8*d.ps}
  d.stateT=0;d.fI=Math.floor(Math.random()*12);
}

var c=cv.getContext("2d"),btnT=0;

function drawDie(ctx,d,t){
  var x=d.x,y=d.y,wb=t*3.5*d.ps+d.bO;
  var st=d.state,prog=d.stateD>0?d.stateT/d.stateD:0;
  var bobY=0,tilt=0,sqX=1,sqY=1;
  d.glow*=0.92;
  if(st==="walk"){bobY=Math.abs(Math.sin(wb))*2.5;tilt=Math.sin(wb)*0.05;d.rotV*=0.9}
  else if(st==="run"){bobY=Math.abs(Math.sin(wb*1.8))*3.5;tilt=Math.sin(wb*1.8)*0.08+(d.vx>0?-0.05:0.05);d.rotV*=0.92;if(Math.random()<0.3)addSpark(d.x,d.y+DSIZE*0.2,d.vx*-0.2,5);addTrail(d.x,d.y,2)}
  else if(st==="slide"){bobY=Math.sin(wb*0.8)*0.4;sqX=1.2;sqY=0.82;d.vx*=0.985;d.vy*=0.985;d.rotV*=0.95;tilt=Math.sin(t*2)*0.03;addTrail(d.x,d.y+DSIZE*0.15,3.5);if(Math.random()<0.15)addSpark(d.x,d.y+DSIZE*0.2,d.vx*-0.1,3)}
  else if(st==="tumble"){bobY=Math.abs(Math.sin(wb*2))*5;var tp=Math.sin(wb*2);sqX=1+tp*0.15;sqY=1-tp*0.13;d.vx*=0.98;d.vy*=0.98;d.glow=0.5;if(Math.random()<0.4)addSpark(d.x+Math.random()*10-5,d.y,Math.random()*20-10,-15-Math.random()*10);addTrail(d.x,d.y,2.5)}
  else if(st==="hop"){var hp=Math.sin(prog*Math.PI);bobY=hp*14;if(prog<0.5){sqX=0.86;sqY=1.2}else{sqX=1.18;sqY=0.85}tilt=Math.sin(prog*Math.PI*2)*0.12;d.rotV+=(Math.random()-0.5)*0.3;if(prog>0.85)d.glow=0.6;if(prog>0.9&&Math.random()<0.5){for(var k=0;k<3;k++)addSpark(d.x,d.y+DSIZE*0.15,Math.random()*30-15,-10-Math.random()*15)}}
  else if(st==="spin"){bobY=Math.sin(wb)*1.5;tilt=0;d.glow=0.3;if(Math.random()<0.4){var ang=t*8+Math.random();addSpark(d.x+Math.cos(ang)*8,d.y+Math.sin(ang)*5,Math.cos(ang)*15,Math.sin(ang)*10)}}
  else{bobY=Math.sin(wb*0.4)*0.6;tilt=Math.sin(wb*0.5)*0.02;d.vx*=0.92;d.vy*=0.92;d.rotV*=0.9}
  d.squashX+=(sqX-d.squashX)*0.15;d.squashY+=(sqY-d.squashY)*0.15;d.rot+=d.rotV*(1/60);
  var by=y-bobY,DS=DSIZE,shSc=1-bobY/20;
  if(d.glow>0.05){var gr=ctx.createRadialGradient(x,by,DS*0.2,x,by,DS*0.8);gr.addColorStop(0,"rgba(245,210,80,"+(0.25*d.glow)+")");gr.addColorStop(1,"rgba(232,184,48,0)");ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,by,DS*0.8,0,Math.PI*2);ctx.fill()}
  ctx.beginPath();ctx.ellipse(x,y+DS*0.3,DS*0.45*Math.max(0.3,shSc),DS*0.09*Math.max(0.3,shSc),0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,"+(0.3*Math.max(0.15,shSc))+")";ctx.fill();
  draw3D(ctx,x,by,1,d.rot+tilt,d.squashX,d.squashY,facesFor(d));
}

function loop(){
  requestAnimationFrame(loop);
  var dt=1/60;btnT+=dt;
  for(var si=sparks.length-1;si>=0;si--){var sp=sparks[si];sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;sp.life-=dt;sp.vy+=30*dt;if(sp.life<=0)sparks.splice(si,1)}
  for(var ti=trails.length-1;ti>=0;ti--){trails[ti].life-=dt;if(trails[ti].life<=0)trails.splice(ti,1)}

  md.forEach(function(d){
    d.stateT+=dt;if(d.stateT>=d.stateD)pick(d);
    d.x+=d.vx*dt;d.y+=d.vy*dt;
    var mnX=PAD+DSIZE*0.5,mxX=BW-PAD-DSIZE*0.5,mnY=DSIZE*0.55+5,mxY=BH-DSIZE*0.2-5;
    if(d.x<mnX){d.x=mnX;d.vx=Math.abs(d.vx)*0.8;d.rotV+=2;d.glow=0.7;for(var k=0;k<4;k++)addSpark(d.x,d.y,8+Math.random()*15,Math.random()*20-10);if(d.state==="slide"||d.state==="run")pick(d)}
    if(d.x>mxX){d.x=mxX;d.vx=-Math.abs(d.vx)*0.8;d.rotV-=2;d.glow=0.7;for(var k=0;k<4;k++)addSpark(d.x,d.y,-8-Math.random()*15,Math.random()*20-10);if(d.state==="slide"||d.state==="run")pick(d)}
    if(d.y<mnY){d.y=mnY;d.vy=Math.abs(d.vy)*0.7;d.glow=0.4;for(var k=0;k<2;k++)addSpark(d.x,d.y,Math.random()*16-8,8+Math.random()*10)}
    if(d.y>mxY){d.y=mxY;d.vy=-Math.abs(d.vy)*0.7;d.glow=0.4;for(var k=0;k<2;k++)addSpark(d.x,d.y,Math.random()*16-8,-8-Math.random()*10)}
  });

  for(var i=0;i<md.length;i++)for(var j=i+1;j<md.length;j++){
    var a=md[i],b=md[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy),minD=DSIZE*1.1;
    if(dist<minD&&dist>0.1){
      var nx=dx/dist,ny=dy/dist,ov=(minD-dist)/2;
      a.x-=nx*ov*0.6;a.y-=ny*ov*0.6;b.x+=nx*ov*0.6;b.y+=ny*ov*0.6;
      var rv=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(rv>0){a.vx-=rv*nx*0.5;a.vy-=rv*ny*0.5;b.vx+=rv*nx*0.5;b.vy+=rv*ny*0.5}
      a.rotV+=(Math.random()-0.5)*3;b.rotV+=(Math.random()-0.5)*3;
      a.glow=0.8;b.glow=0.8;
      var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      for(var k=0;k<6;k++)addSpark(mx,my,Math.random()*40-20,Math.random()*30-20);
      if(Math.random()<0.3){var v=Math.random()>0.5?a:b;v.state="tumble";v.stateT=0;v.stateD=0.4+Math.random()*0.5;v.tumbleDir=v===a?-1:1;v.rotV=v.tumbleDir*(6+Math.random()*4)}
    }
  }

  c.clearRect(0,0,cv.width,cv.height);c.save();c.scale(dpr,dpr);
  c.drawImage(bgCv,0,0,BW*dpr,BH*dpr,0,0,BW,BH);
  c.save();rr(c,1,1,BW-2,BH-2,11);c.clip();
  trails.forEach(function(tr){var a=tr.life/tr.maxLife;c.beginPath();c.arc(tr.x,tr.y,tr.size*a,0,Math.PI*2);c.fillStyle="rgba(232,184,48,"+(0.15*a)+")";c.fill()});
  md.slice().sort(function(a,b){return a.y-b.y}).forEach(function(d){drawDie(c,d,btnT)});
  sparks.forEach(function(sp){var a=sp.life/sp.maxLife;c.beginPath();c.arc(sp.x,sp.y,sp.size*a,0,Math.PI*2);var br=Math.floor(200+55*a);c.fillStyle="rgba("+br+","+Math.floor(br*0.82)+","+Math.floor(br*0.3)+","+a+")";c.fill();c.beginPath();c.arc(sp.x,sp.y,sp.size*a*2.5,0,Math.PI*2);c.fillStyle="rgba(245,210,80,"+(0.08*a)+")";c.fill()});
  c.restore();c.restore();
}
setTimeout(loop,100);
})();
<\/script></body></html>`;
}

const BTN_W = 160;
const BTN_H = 58;

export function GoldDiceButton({ onPress, disabled = false, width, size, style }: GoldDiceButtonProps) {
  const w = width ?? BTN_W;
  const h = size ?? BTN_H;
  const [webViewReady, setWebViewReady] = useState(false);

  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 0.92, friction: 8, tension: 200, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }).start();
  }, []);

  const html = buildDiceHTML(w, h);

  return (
    <View style={[{ width: w, alignSelf: 'center', alignItems: 'center' }, style]}>
      <View style={{
        position: 'absolute', top: h * 0.4, width: w * 0.8, height: h * 0.6,
        borderRadius: h, backgroundColor: 'rgba(232,184,48,0.25)',
        ...Platform.select({
          ios: { shadowColor: '#E8B830', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12 },
          android: {},
        }),
      }} />
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
      >
        <Animated.View style={[
          {
            width: w,
            height: h,
            borderRadius: 12,
            opacity: disabled ? 0.3 : 1,
            transform: [{ scale: pressAnim }],
            ...Platform.select({
              ios: {
                shadowColor: '#6B4A08',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.8,
                shadowRadius: 4,
              },
              android: { elevation: 12 },
            }),
          },
        ]}>
          <View style={{
            position: 'absolute', top: 5, left: 0, right: 0, height: h,
            borderRadius: 12, backgroundColor: '#6B4A08',
          }} />
          <View style={{
            position: 'absolute', top: 7, left: 0, right: 0, height: h,
            borderRadius: 12, backgroundColor: '#503508',
          }} />
          <View style={{
            position: 'absolute', top: 9, left: 0, right: 0, height: h,
            borderRadius: 12, backgroundColor: '#3A2505',
          }} />
          {!webViewReady && (
            <View style={{
              position: 'absolute', zIndex: 1, width: w, height: h, borderRadius: 12,
              backgroundColor: '#DAA520', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                🎲 גלגל קוביות
              </Text>
            </View>
          )}
          <View style={{
            width: w, height: h, borderRadius: 12, overflow: 'hidden',
          }}>
            <WebView
              source={{ html }}
              style={gdStyles.webview}
              scrollEnabled={false}
              bounces={false}
              pointerEvents="none"
              javaScriptEnabled={true}
              originWhitelist={['*']}
              androidLayerType="hardware"
              onLoadEnd={() => setWebViewReady(true)}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const gdStyles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
