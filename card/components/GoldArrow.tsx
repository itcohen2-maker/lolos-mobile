import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface GoldArrowProps {
  direction?: 'left' | 'right';
  size?: number;
}

export default function GoldArrow({ direction = 'right', size = 60 }: GoldArrowProps) {
  const html = buildHTML(direction, size);
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        transparent={true}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

function buildHTML(dir: string, size: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;width:${size}px;height:${size}px}
canvas{display:block}
</style>
</head><body>
<canvas id="a"></canvas>
<script>
(function(){
var SIZE=${size},DIR="${dir}";
var dpr=Math.min(window.devicePixelRatio||1,2);
var BW=110,BH=110;
var sc=SIZE/BW;
var cv=document.getElementById("a");
cv.width=SIZE*dpr;cv.height=SIZE*dpr;
cv.style.width=SIZE+"px";cv.style.height=SIZE+"px";
var ctx=cv.getContext("2d");

var CX=BW/2,CY=BH/2;
var SW=58,SH=16,HH=40,HW=30;
var LX=CX-SW/2,NX=LX+SW-HW;

function getArrowPts(d){
  var p=[[LX,CY-SH/2],[NX,CY-SH/2],[NX,CY-HH/2],[LX+SW,CY],[NX,CY+HH/2],[NX,CY+SH/2],[LX,CY+SH/2]];
  if(d==="left") return p.map(function(pt){return[BW-pt[0],pt[1]]}).reverse();
  return p;
}

var cornerR=[3,3,2,0,2,3,3];

function arrowPath(c,pts,radii){
  var n=pts.length;c.beginPath();
  for(var i=0;i<n;i++){
    var r=radii[i]||0;
    var prev=pts[(i-1+n)%n],curr=pts[i],next=pts[(i+1)%n];
    var dx1=curr[0]-prev[0],dy1=curr[1]-prev[1],l1=Math.sqrt(dx1*dx1+dy1*dy1);
    var dx2=next[0]-curr[0],dy2=next[1]-curr[1],l2=Math.sqrt(dx2*dx2+dy2*dy2);
    if(r===0||l1<0.01||l2<0.01){
      if(i===0)c.moveTo(curr[0],curr[1]);else c.lineTo(curr[0],curr[1]);
    }else{
      var t1=Math.min(r/l1,0.5),t2=Math.min(r/l2,0.5);
      var px1=curr[0]-dx1*t1,py1=curr[1]-dy1*t1;
      var px2=curr[0]+dx2*t2,py2=curr[1]+dy2*t2;
      if(i===0)c.moveTo(px1,py1);else c.lineTo(px1,py1);
      c.quadraticCurveTo(curr[0],curr[1],px2,py2);
    }
  }
  c.closePath();
}

var pts=getArrowPts(DIR);
var tipPt=pts[3];
var sparks=[];

function addSpark(x,y,vx,vy,big){
  sparks.push({x:x,y:y,vx:vx+(Math.random()-0.5)*(big?22:14),vy:vy+(Math.random()-0.5)*(big?16:10),
    life:0.2+Math.random()*(big?0.6:0.35),maxLife:0.2+Math.random()*(big?0.6:0.35),
    size:(big?1.0:0.4)+Math.random()*(big?2.0:1.0)});
}

var t=0,gp=0;

function loop(){
  requestAnimationFrame(loop);
  var dt=1/60;t+=dt;gp+=dt*2.2;
  var pulse=Math.sin(gp)*0.5+0.5;
  var pulse2=Math.sin(gp*1.7+1.1)*0.5+0.5;

  if(Math.random()<0.25) addSpark(tipPt[0],tipPt[1],DIR==="right"?6:-6,0,false);
  if(Math.random()<0.035){
    for(var k=0;k<3;k++) addSpark(tipPt[0],tipPt[1],(DIR==="right"?6:-6)+Math.random()*8,(Math.random()-0.5)*8,false);
  }
  for(var si=sparks.length-1;si>=0;si--){
    var s=sparks[si];s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=18*dt;s.life-=dt;
    if(s.life<=0)sparks.splice(si,1);
  }

  var floatY=Math.sin(t*1.7)*1.5;
  var glowA=0.22+pulse*0.28;

  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save();ctx.scale(dpr*sc,dpr*sc);
  ctx.translate(0,floatY);

  // Shadow
  ctx.save();
  arrowPath(ctx,pts,cornerR);
  ctx.shadowColor="rgba(60,35,5,0.5)";ctx.shadowBlur=6;ctx.shadowOffsetY=3;
  ctx.fillStyle="rgba(0,0,0,0)";ctx.fill();
  ctx.restore();

  // Arrow body — gold relief
  ctx.save();
  arrowPath(ctx,pts,cornerR);ctx.clip();
  var ag=ctx.createLinearGradient(LX,CY-HH/2,LX+SW,CY+HH/2);
  ag.addColorStop(0,"#FFF0A0");ag.addColorStop(0.15,"#F8DE74");
  ag.addColorStop(0.4,"#F0C840");ag.addColorStop(0.7,"#E2AC20");ag.addColorStop(1,"#C88E12");
  ctx.fillStyle=ag;ctx.fillRect(LX-5,CY-HH/2-5,SW+HW+10,HH+10);

  // Shimmer sweep
  var sx=LX-20+(SW+HW+40)*pulse;
  var sg=ctx.createLinearGradient(sx-35,0,sx+35,BH);
  sg.addColorStop(0,"rgba(255,255,210,0)");
  sg.addColorStop(0.5,"rgba(255,255,220,0.45)");
  sg.addColorStop(1,"rgba(255,255,210,0)");
  ctx.fillStyle=sg;ctx.fillRect(0,0,BW,BH);

  // Tip glow
  var tg=ctx.createRadialGradient(tipPt[0],CY,0,tipPt[0]+(DIR==="right"?-15:15),CY,45);
  tg.addColorStop(0,"rgba(255,248,160,"+(0.3+pulse2*0.4)+")");
  tg.addColorStop(1,"rgba(255,220,60,0)");
  ctx.fillStyle=tg;ctx.fillRect(0,0,BW,BH);

  // Flash
  ctx.fillStyle="rgba(255,252,210,"+(pulse2*0.1)+")";ctx.fillRect(0,0,BW,BH);
  ctx.restore();

  // Top highlight
  ctx.save();
  var p0=pts[0],p1=pts[1],p2=pts[2],p3=pts[3];
  ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p3[0],p3[1]);
  ctx.strokeStyle="rgba(255,248,190,0.7)";ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();

  // Bottom shadow edge
  ctx.save();
  var p4=pts[4],p5=pts[5],p6=pts[6];
  ctx.beginPath();ctx.moveTo(p3[0],p3[1]);ctx.lineTo(p4[0],p4[1]);ctx.lineTo(p5[0],p5[1]);ctx.lineTo(p6[0],p6[1]);
  ctx.strokeStyle="rgba(100,65,10,0.4)";ctx.lineWidth=1.2;ctx.stroke();
  ctx.restore();

  // Outer glow
  ctx.save();
  arrowPath(ctx,pts,cornerR);
  ctx.shadowColor="rgba(255,220,80,"+(glowA*0.8)+")";
  ctx.shadowBlur=10+pulse*10;
  ctx.strokeStyle="rgba(255,230,100,"+(glowA*0.5)+")";
  ctx.lineWidth=1;ctx.stroke();
  ctx.restore();

  // Sparks
  sparks.forEach(function(s){
    var a=s.life/s.maxLife;
    var b=Math.floor(200+55*a);
    ctx.beginPath();ctx.arc(s.x,s.y,s.size*a,0,Math.PI*2);
    ctx.fillStyle="rgba("+b+","+Math.floor(b*0.82)+","+Math.floor(b*0.3)+","+a+")";
    ctx.fill();
    ctx.beginPath();ctx.arc(s.x,s.y,s.size*a*3,0,Math.PI*2);
    ctx.fillStyle="rgba(245,210,80,"+(0.07*a)+")";ctx.fill();
  });

  ctx.restore();
}
loop();
})();
</script>
</body></html>`;
}
