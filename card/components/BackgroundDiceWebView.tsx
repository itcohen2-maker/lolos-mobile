import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface BackgroundDiceWebViewRef {
  summon: () => void;
  scatter: () => void;
}

const BG_DICE_VERSION = 1;

const BackgroundDiceWebViewComponent = forwardRef<BackgroundDiceWebViewRef, {}>((_, ref) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    summon: () => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'bgSummon' }), '*');
        return;
      }
      webViewRef.current?.injectJavaScript(`
        if (window.bgSummon) window.bgSummon();
        true;
      `);
    },
    scatter: () => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'bgScatter' }), '*');
        return;
      }
      webViewRef.current?.injectJavaScript(`
        if (window.bgScatter) window.bgScatter();
        true;
      `);
    },
  }));

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webview}>
        <iframe
          ref={(node) => {
            iframeRef.current = node;
          }}
          title="bg-dice-web"
          srcDoc={BG_DICE_HTML}
          sandbox="allow-scripts allow-same-origin"
          style={{ border: 'none', width: '100%', height: '100%', display: 'block', backgroundColor: 'transparent', pointerEvents: 'none' }}
        />
      </View>
    );
  }

  return (
    <WebView
      key={'bg-dice-v' + BG_DICE_VERSION}
      ref={webViewRef}
      source={{ html: BG_DICE_HTML }}
      style={styles.webview}
      scrollEnabled={false}
      bounces={false}
      javaScriptEnabled={true}
      originWhitelist={['*']}
      {...{ transparent: true } as any}
      androidLayerType="hardware"
      pointerEvents="none"
    />
  );
});

BackgroundDiceWebViewComponent.displayName = 'BackgroundDiceWebView';
export const BackgroundDiceWebView = BackgroundDiceWebViewComponent;

const styles = StyleSheet.create({
  webview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});

// ═══════════════════════════════════════════════════════════════
//  EMBEDDED THREE.JS HTML — Background roaming dice characters
// ═══════════════════════════════════════════════════════════════
const BG_DICE_HTML = `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;pointer-events:none}
#cv{width:100%;height:100%}
</style>
</head><body>
<div id="cv"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
// === PIP LAYOUT ===
var PL={1:[[0,0]],2:[[-0.25,-0.25],[0.25,0.25]],3:[[-0.25,-0.25],[0,0],[0.25,0.25]],4:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]],5:[[-0.25,-0.25],[0.25,-0.25],[0,0],[-0.25,0.25],[0.25,0.25]],6:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0],[0.25,0],[-0.25,0.25],[0.25,0.25]]};

// === DICE FACE TEXTURE (256x256 for performance) ===
function mkTex(n){
var C=document.createElement("canvas");C.width=256;C.height=256;var c=C.getContext("2d");
var g=c.createRadialGradient(90,75,10,140,145,200);
g.addColorStop(0,"#F5D26B");g.addColorStop(0.2,"#E8B830");g.addColorStop(0.45,"#D9A020");g.addColorStop(0.7,"#C48A18");g.addColorStop(1,"#9A6A0A");
c.fillStyle=g;c.fillRect(0,0,256,256);
var w=c.createLinearGradient(0,0,256,256);w.addColorStop(0,"rgba(255,180,50,0.12)");w.addColorStop(0.5,"rgba(200,120,20,0.06)");w.addColorStop(1,"rgba(160,80,10,0.15)");
c.fillStyle=w;c.fillRect(0,0,256,256);
for(var i=0;i<2000;i++){var r=Math.random();c.fillStyle=r>0.7?"rgba(255,220,120,"+Math.random()*0.07+")":r>0.35?"rgba(180,130,40,"+Math.random()*0.09+")":"rgba(100,65,15,"+Math.random()*0.08+")";c.fillRect(Math.random()*256,Math.random()*256,1,1)}
var ed=c.createRadialGradient(120,115,60,128,128,145);ed.addColorStop(0,"rgba(0,0,0,0)");ed.addColorStop(0.6,"rgba(0,0,0,0)");ed.addColorStop(0.85,"rgba(80,45,5,0.12)");ed.addColorStop(1,"rgba(50,25,0,0.28)");
c.fillStyle=ed;c.fillRect(0,0,256,256);
(PL[n]||[]).forEach(function(pp){var x=128+pp[0]*256,y=128+pp[1]*256;
var sh=c.createRadialGradient(x+1,y+1,8,x,y,22);sh.addColorStop(0,"rgba(0,0,0,0.75)");sh.addColorStop(0.5,"rgba(40,20,0,0.4)");sh.addColorStop(1,"rgba(0,0,0,0)");
c.fillStyle=sh;c.beginPath();c.arc(x,y,22,0,Math.PI*2);c.fill();
c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.fillStyle="#080808";c.fill();
var inn=c.createRadialGradient(x-1,y-1,1,x,y,12);inn.addColorStop(0,"#1a1408");inn.addColorStop(0.5,"#0a0a06");inn.addColorStop(1,"#040404");
c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fillStyle=inn;c.fill()});
return new THREE.CanvasTexture(C)}

// === LIMB MATERIAL ===
var SM=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.8,metalness:0.15});

// === ARM BUILDER (simplified — fewer segments) ===
function mkArm(){
var arm=new THREE.Group();
arm.add(new THREE.Mesh(new THREE.SphereGeometry(0.055,6,6),SM));
var up=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.035,0.8,5),SM);
up.position.y=-0.43;arm.add(up);
var elb=new THREE.Mesh(new THREE.SphereGeometry(0.042,6,6),SM);
elb.position.y=-0.85;arm.add(elb);
var fg=new THREE.Group();fg.position.y=-0.85;
var fore=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.028,0.8,5),SM);
fore.position.y=-0.43;fg.add(fore);
var wr=new THREE.Mesh(new THREE.SphereGeometry(0.032,6,6),SM);
wr.position.y=-0.85;fg.add(wr);
var hg=new THREE.Group();hg.position.y=-0.85;
var palm=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.04,0.06),SM);
palm.position.y=-0.025;hg.add(palm);
[-0.025,0,0.025].forEach(function(xo){
var fG=new THREE.Group();fG.position.set(xo,-0.05,0);
var s1=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.01,0.12,4),SM);
s1.position.y=-0.06;fG.add(s1);
var jt=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),SM);
jt.position.y=-0.12;fG.add(jt);
var tg=new THREE.Group();tg.position.y=-0.12;
var s2=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.008,0.1,4),SM);
s2.position.y=-0.05;tg.add(s2);
var tn=new THREE.Mesh(new THREE.SphereGeometry(0.009,4,4),SM);
tn.position.y=-0.1;tg.add(tn);
fG.add(tg);fG.userData.tipGroup=tg;
hg.add(fG)});
fg.add(hg);fg.userData.handGroup=hg;
arm.add(fg);
arm.userData.forearm=fg;arm.userData.handGroup=hg;
return arm}

// === LEG BUILDER (simplified) ===
function mkLeg(){
var leg=new THREE.Group();
leg.add(new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5),SM));
var th=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.018,0.3,4),SM);
th.position.y=-0.17;leg.add(th);
var kn=new THREE.Mesh(new THREE.SphereGeometry(0.024,5,5),SM);
kn.position.y=-0.33;leg.add(kn);
var sg=new THREE.Group();sg.position.y=-0.33;
var sh=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.014,0.28,4),SM);
sh.position.y=-0.15;sg.add(sh);
var ft=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,4),SM);
ft.position.set(0,-0.3,0.01);sg.add(ft);
leg.add(sg);leg.userData.shin=sg;return leg}

// === SCENE SETUP (Orthographic, no shadows) ===
var cv=document.getElementById("cv"),W=cv.clientWidth,H=cv.clientHeight;
var ren=new THREE.WebGLRenderer({antialias:false,alpha:true});
ren.setClearColor(0,0);ren.setSize(W,H);ren.setPixelRatio(1);
ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.0;
cv.appendChild(ren.domElement);

var scene=new THREE.Scene();

// Orthographic camera: 1 unit ≈ 1 pixel, origin at top-left
var cam=new THREE.OrthographicCamera(0,W,0,-H,-500,500);
cam.position.set(0,0,100);cam.lookAt(0,0,0);

// Lighting: simple ambient + directional (no shadows)
scene.add(new THREE.AmbientLight(0xffa040,0.6));
var sun=new THREE.DirectionalLight(0xfff0dd,1.2);
sun.position.set(2,5,8);scene.add(sun);

// === DICE SIZE & SCALING ===
var DICE_SCALE=42; // px on screen
var PAD=60; // edge padding

// === DICE CHARACTER BUILDER ===
function mkBgDice(idx){
var root=new THREE.Group(),bp=new THREE.Group();root.add(bp);
var fv=[2,5,1,6,3,4];
var mats=fv.map(function(v){return new THREE.MeshStandardMaterial({map:mkTex(v),roughness:0.78,metalness:0.04,emissive:new THREE.Color(0xC48A18),emissiveIntensity:0.04})});
var body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
bp.add(body);
var glow=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1),new THREE.MeshBasicMaterial({color:0xE8B830,transparent:true,opacity:0.05,side:THREE.BackSide}));
bp.add(glow);
var la=mkArm();la.position.set(-0.55,-0.05,0);la.rotation.z=-0.25;bp.add(la);
var ra=mkArm();ra.position.set(0.55,-0.05,0);ra.rotation.z=0.25;bp.add(ra);
var ll=mkLeg();ll.position.set(-0.32,-0.52,0.08);ll.rotation.z=0.3;bp.add(ll);
var rl=mkLeg();rl.position.set(0.32,-0.52,0.08);rl.rotation.z=-0.3;bp.add(rl);

root.scale.setScalar(DICE_SCALE);

var personalities=[
{spd:38,bob:2.5,sway:0.09,wanderR:0.6,turnSpd:3.0},
{spd:25,bob:1.8,sway:0.05,wanderR:0.45,turnSpd:2.0},
{spd:50,bob:3.2,sway:0.12,wanderR:0.75,turnSpd:4.5}
];
var p=personalities[idx]||personalities[0];

// Starting positions spread across screen
var startX=PAD+Math.random()*(W-PAD*2);
var startY=PAD+Math.random()*(H-PAD*2);

return{root:root,bp:bp,body:body,glow:glow,la:la,ra:ra,ll:ll,rl:rl,
x:startX,y:startY,
targetX:startX,targetY:startY,
heading:Math.random()*Math.PI*2,
moveSpeed:p.spd,bob:p.bob,sway:p.sway,wanderR:p.wanderR,turnSpd:p.turnSpd,
wOff:Math.random()*Math.PI*2,
// State machine
state:"walk",stateTimer:0,stateDur:3+Math.random()*3,
// Sleep rotation
sleepAngle:0,
// Trip progress
tripProg:0,
// Wave arm angle
waveAngle:0,
// Summon/scatter
summoning:false,scattering:false,summonProg:0,scatterProg:0,
summonStartX:0,summonStartY:0,
visible:true,
opacity:1
}}

function lerpAngle(a,b,f){var d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*f}

// Weighted random state pick
function pickState(){
var r=Math.random();
if(r<0.35)return"walk";
if(r<0.55)return"idle";
if(r<0.70)return"bounce";
if(r<0.80)return"wave";
if(r<0.90)return"trip";
return"sleep";
}

function pickTarget(d){
var ang=Math.random()*Math.PI*2;
var r=d.wanderR*Math.min(W,H);
var cx=W/2,cy=H/2;
d.targetX=cx+Math.cos(ang)*r*Math.random();
d.targetY=cy+Math.sin(ang)*r*Math.random();
d.targetX=Math.max(PAD,Math.min(W-PAD,d.targetX));
d.targetY=Math.max(PAD,Math.min(H-PAD,d.targetY));
}

function transitionState(d){
var ns=pickState();
d.state=ns;
d.stateTimer=0;
if(ns==="walk"){d.stateDur=3+Math.random()*3;pickTarget(d)}
else if(ns==="idle"){d.stateDur=2+Math.random()*2}
else if(ns==="bounce"){d.stateDur=1+Math.random()*2}
else if(ns==="wave"){d.stateDur=1.5+Math.random()*1}
else if(ns==="trip"){d.stateDur=1+Math.random()*1;d.tripProg=0}
else if(ns==="sleep"){d.stateDur=4+Math.random()*4;d.sleepAngle=0}
}

// === CREATE 3 DICE ===
var dice=[];
for(var i=0;i<3;i++){var d=mkBgDice(i);scene.add(d.root);dice.push(d);transitionState(d)}

// === FINGER ANIMATION HELPER ===
function aF(arm,pl,pu){
if(arm.userData.handGroup)arm.userData.handGroup.rotation.x=0.3+pl*0.55-pu*0.1;
}

// === SUMMON / SCATTER ===
var centerX=W/2,centerY=H/2;
window.bgSummon=function(){
dice.forEach(function(d){
d.summoning=true;d.scattering=false;
d.summonProg=0;d.summonStartX=d.x;d.summonStartY=d.y;
})};
window.bgScatter=function(){
dice.forEach(function(d){
d.summoning=false;d.scattering=true;d.scatterProg=0;
d.visible=true;d.opacity=0;
// Pick random edge position
var edge=Math.floor(Math.random()*4);
if(edge===0){d.x=PAD;d.y=PAD+Math.random()*(H-PAD*2)}
else if(edge===1){d.x=W-PAD;d.y=PAD+Math.random()*(H-PAD*2)}
else if(edge===2){d.x=PAD+Math.random()*(W-PAD*2);d.y=PAD}
else{d.x=PAD+Math.random()*(W-PAD*2);d.y=H-PAD}
d.summonStartX=d.x;d.summonStartY=d.y;
pickTarget(d);transitionState(d);
})};
window.addEventListener("message",function(ev){
try{
  var d=typeof ev.data==="string"?JSON.parse(ev.data):ev.data;
  if(!d||typeof d!=="object")return;
  if(d.type==="bgSummon"&&window.bgSummon)window.bgSummon();
  if(d.type==="bgScatter"&&window.bgScatter)window.bgScatter();
}catch(e){}
});

// === ANIMATION LOOP ===
var clk=new THREE.Clock();
var FPS_CAP=1/20; // 20fps max
var accum=0;

function anim(){
requestAnimationFrame(anim);
var rawDt=clk.getDelta();
accum+=rawDt;
if(accum<FPS_CAP)return;
var dt=Math.min(accum,0.1);
accum=0;
var t=clk.elapsedTime+rawDt; // approximate elapsed

dice.forEach(function(d,idx){

// === SUMMON ANIMATION ===
if(d.summoning){
d.summonProg+=dt*1.6; // ~0.6s
var p=Math.min(d.summonProg,1);
var e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2; // easeInOutQuad
d.x=d.summonStartX+(centerX-d.summonStartX)*e;
d.y=d.summonStartY+(centerY-d.summonStartY)*e;
d.opacity=1-p;
var sc=DICE_SCALE*(1-p*0.3);
d.root.scale.setScalar(sc);
d.root.position.set(d.x,-d.y,0);
d.root.visible=d.opacity>0.01;
d.bp.rotation.y+=dt*6;
// Hop effect
d.root.position.y=-d.y+Math.sin(p*Math.PI*3)*15*DICE_SCALE/42;
if(p>=1){d.summoning=false;d.visible=false;d.root.visible=false}
return}

// === SCATTER ANIMATION ===
if(d.scattering){
d.scatterProg+=dt*1.6;
var p=Math.min(d.scatterProg,1);
var e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
d.opacity=p;
d.root.scale.setScalar(DICE_SCALE*(0.7+p*0.3));
d.root.visible=true;
d.root.position.set(d.x,-d.y,0);
if(p>=1){d.scattering=false;d.opacity=1;d.root.scale.setScalar(DICE_SCALE)}
return}

if(!d.visible){d.root.visible=false;return}
d.root.visible=true;

d.stateTimer+=dt;
var wb=t*2+d.wOff;

// === STATE MACHINE ===
if(d.state==="walk"){
var dx=d.targetX-d.x,dy=d.targetY-d.y;
var dist=Math.sqrt(dx*dx+dy*dy);
if(dist>5){
var spd=d.moveSpeed*dt;
d.x+=dx/dist*spd;d.y+=dy/dist*spd;
var targetAng=Math.atan2(-dx,dy);
d.heading=lerpAngle(d.heading,targetAng,dt*d.turnSpd);
}
if(dist<10||d.stateTimer>=d.stateDur){transitionState(d)}
// Walk animation
var sc2=t*d.moveSpeed*0.15+d.wOff;
d.bp.rotation.set(0.03,0,Math.sin(sc2)*d.sway);
d.ll.rotation.x=Math.sin(sc2)*0.5;d.rl.rotation.x=Math.sin(sc2+Math.PI)*0.5;
if(d.ll.userData.shin)d.ll.userData.shin.rotation.x=Math.max(0,Math.sin(sc2))*0.65;
if(d.rl.userData.shin)d.rl.userData.shin.rotation.x=Math.max(0,Math.sin(sc2+Math.PI))*0.65;
var lp=sc2+Math.PI,rp=sc2;
d.la.rotation.x=Math.sin(lp)*0.35;d.ra.rotation.x=Math.sin(rp)*0.35;
d.la.rotation.z=-0.25;d.ra.rotation.z=0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1+Math.sin(lp)*0.15;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.1+Math.sin(rp)*0.15;
aF(d.la,Math.max(0,Math.sin(lp)),0);aF(d.ra,Math.max(0,Math.sin(rp)),0);
d.glow.material.opacity=0.05+Math.sin(t*1.5+d.wOff)*0.02;
// Bob
var bobY=Math.abs(Math.sin(sc2))*d.bob;
d.root.position.set(d.x,-d.y-bobY,0);
d.root.rotation.y=d.heading;
}
else if(d.state==="idle"){
if(d.stateTimer>=d.stateDur){transitionState(d);return}
// Subtle breathing bob
d.bp.rotation.set(Math.sin(wb*0.7)*0.03,0,Math.sin(wb)*0.04);
d.la.rotation.x=Math.sin(wb*0.5)*0.08;d.ra.rotation.x=Math.sin(wb*0.5+1)*0.08;
d.la.rotation.z=-0.25;d.ra.rotation.z=0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.1;
aF(d.la,0.1,0);aF(d.ra,0.1,0);
d.ll.rotation.x=0;d.rl.rotation.x=0;
// Occasional look-around
d.heading+=Math.sin(t*1.5+d.wOff)*dt*0.5;
d.root.position.set(d.x,-d.y,0);
d.root.rotation.y=d.heading;
d.glow.material.opacity=0.05+Math.sin(t*1.5+d.wOff)*0.02;
}
else if(d.state==="bounce"){
if(d.stateTimer>=d.stateDur){transitionState(d);return}
// Hop in place with squash-and-stretch
var bPhase=d.stateTimer*4; // fast bouncing
var hopH=Math.max(0,Math.sin(bPhase*Math.PI))*18;
var squash=1+Math.max(0,-Math.sin(bPhase*Math.PI))*0.15;
var stretch=1+Math.max(0,Math.sin(bPhase*Math.PI))*0.1;
d.bp.scale.set(squash,stretch,squash);
d.bp.rotation.set(0,0,0);
d.la.rotation.x=-0.4;d.ra.rotation.x=-0.4;
d.la.rotation.z=-0.5;d.ra.rotation.z=0.5;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=-0.1;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.1;
d.ll.rotation.x=hopH>5?-0.3:0.2;d.rl.rotation.x=hopH>5?-0.3:0.2;
aF(d.la,0,hopH>5?0.3:0);aF(d.ra,0,hopH>5?0.3:0);
d.root.position.set(d.x,-d.y-hopH,0);
d.root.rotation.y=d.heading;
d.glow.material.opacity=0.08;
}
else if(d.state==="wave"){
if(d.stateTimer>=d.stateDur){transitionState(d);return}
// Wave one arm
d.waveAngle=Math.sin(d.stateTimer*5)*0.6;
d.bp.rotation.set(0,0,Math.sin(d.stateTimer*2)*0.05);
d.la.rotation.x=0;d.la.rotation.z=-0.25;
// Right arm waves
d.ra.rotation.x=-1.2+d.waveAngle;
d.ra.rotation.z=0.8;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.6+Math.sin(d.stateTimer*5)*0.3;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1;
aF(d.la,0,0);aF(d.ra,0,0.5);
d.ll.rotation.x=0;d.rl.rotation.x=0;
d.root.position.set(d.x,-d.y,0);
d.root.rotation.y=d.heading;
d.glow.material.opacity=0.07+Math.sin(t*2)*0.03;
}
else if(d.state==="trip"){
if(d.stateTimer>=d.stateDur){d.bp.scale.set(1,1,1);transitionState(d);return}
d.tripProg=d.stateTimer/d.stateDur;
var tp=d.tripProg;
var tiltX,moveF;
if(tp<0.3){
// Stumble forward
tiltX=tp/0.3*0.8;moveF=tp/0.3;
d.x+=Math.sin(d.heading)*d.moveSpeed*dt*0.5;
d.y-=Math.cos(d.heading)*d.moveSpeed*dt*0.5;
}else if(tp<0.5){
// Face-plant
tiltX=0.8+(tp-0.3)/0.2*0.8;
moveF=1;
}else{
// Recover
tiltX=1.6*(1-(tp-0.5)/0.5);
moveF=1-(tp-0.5)/0.5;
}
d.bp.rotation.set(tiltX,0,Math.sin(tp*12)*0.1*(1-tp));
d.la.rotation.x=-0.3*moveF;d.ra.rotation.x=-0.3*moveF;
d.la.rotation.z=-0.6;d.ra.rotation.z=0.6;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=-0.2*moveF;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.2*moveF;
d.ll.rotation.x=Math.sin(tp*8)*0.3;d.rl.rotation.x=Math.sin(tp*8+1)*0.3;
aF(d.la,0,0.3);aF(d.ra,0,0.3);
d.root.position.set(d.x,-d.y,0);
d.root.rotation.y=d.heading;
d.glow.material.opacity=0.08;
// Clamp to bounds
d.x=Math.max(PAD,Math.min(W-PAD,d.x));
d.y=Math.max(PAD,Math.min(H-PAD,d.y));
}
else if(d.state==="sleep"){
if(d.stateTimer>=d.stateDur){d.bp.scale.set(1,1,1);d.bp.rotation.set(0,0,0);transitionState(d);return}
// Lie on side, Zzz bob
d.sleepAngle+=(Math.PI/2-d.sleepAngle)*dt*3; // ease to 90 degrees
d.bp.rotation.set(0,0,d.sleepAngle);
// Slow breathing scale
var breathe=1+Math.sin(d.stateTimer*1.5)*0.03;
d.bp.scale.set(breathe,breathe,breathe);
d.la.rotation.x=0;d.ra.rotation.x=0;
d.la.rotation.z=-0.1;d.ra.rotation.z=0.1;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.2;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.2;
d.ll.rotation.x=0.15;d.rl.rotation.x=0.15;
aF(d.la,0.3,0);aF(d.ra,0.3,0);
d.root.position.set(d.x,-d.y,0);
d.root.rotation.y=d.heading;
d.glow.material.opacity=0.03+Math.sin(t*0.8)*0.02;
}

// Reset scale if not bounce/sleep/trip
if(d.state!=="bounce"&&d.state!=="sleep"&&d.state!=="trip"){
d.bp.scale.set(1,1,1);
}
});

// === REPULSION: avoid clustering ===
for(var ci=0;ci<dice.length;ci++){
for(var cj=ci+1;cj<dice.length;cj++){
var a=dice[ci],b=dice[cj];
if(!a.visible||!b.visible)continue;
var dx=b.x-a.x,dy=b.y-a.y;
var dist=Math.sqrt(dx*dx+dy*dy);
var minD=DICE_SCALE*2.2;
if(dist<minD&&dist>0.1){
var push=(minD-dist)/2*0.3;
var nx=dx/dist,ny=dy/dist;
a.x-=nx*push;a.y-=ny*push;
b.x+=nx*push;b.y+=ny*push;
a.x=Math.max(PAD,Math.min(W-PAD,a.x));
a.y=Math.max(PAD,Math.min(H-PAD,a.y));
b.x=Math.max(PAD,Math.min(W-PAD,b.x));
b.y=Math.max(PAD,Math.min(H-PAD,b.y));
}}}

ren.render(scene,cam);
}
anim();

// === RESIZE HANDLER ===
window.addEventListener("resize",function(){
W=cv.clientWidth;H=cv.clientHeight;
ren.setSize(W,H);
cam.right=W;cam.bottom=-H;
cam.updateProjectionMatrix();
centerX=W/2;centerY=H/2;
});
<\/script>
</body></html>
`;
