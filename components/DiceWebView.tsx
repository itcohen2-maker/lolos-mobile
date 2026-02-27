import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface DiceWebViewProps {
  onResult?: (results: number[], total: number) => void;
  height?: number;
}

export interface DiceWebViewRef {
  throwDice: () => void;
}

const DICE_VERSION = 6; // bump to force WebView re-mount

const DiceWebViewComponent = forwardRef<DiceWebViewRef, DiceWebViewProps>(
  ({ onResult, height = 220 }, ref) => {
    const webViewRef = useRef<WebView>(null);

    console.log('[DiceWebView] Rendering v' + DICE_VERSION + ', HTML length=' + DICE_HTML.length);

    const throwDice = useCallback(() => {
      webViewRef.current?.injectJavaScript(`
        if (window.doThrow) window.doThrow();
        true;
      `);
    }, []);

    useImperativeHandle(ref, () => ({ throwDice }));

    const onMessage = useCallback((event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'debug') {
          console.log('[DiceWV]', data.msg);
          return;
        }
        if (data.type === 'diceResult' && onResult) {
          onResult(data.results, data.total);
        }
      } catch (e) {}
    }, [onResult]);

    return (
      <View style={[styles.container, { height: height as any }]}>
        <WebView
          key={'dice-wv-v' + DICE_VERSION}
          ref={webViewRef}
          source={{ html: DICE_HTML }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          onMessage={onMessage}
          javaScriptEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          transparent={true}
          androidLayerType="hardware"
        />
      </View>
    );
  }
);

DiceWebViewComponent.displayName = 'DiceWebView';
export const DiceWebView = DiceWebViewComponent;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 0,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

const DICE_HTML = `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none}
#cw{width:100%;height:100%}
:root{--slot-size:40px}
#eq{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:4px 8px;z-index:20;opacity:0;transition:opacity 0.3s;pointer-events:none;font-family:system-ui,sans-serif;background:transparent;direction:ltr}
#eq.show{opacity:1}
.slot{width:var(--slot-size);height:var(--slot-size);border-radius:8px;border:2px dashed rgba(232,184,48,0.3);background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:calc(var(--slot-size)*0.5);font-weight:800;color:#F0C040;transition:all .3s}
.slot.captured{border:2px solid #E8B830;background:rgba(232,184,48,0.15);text-shadow:0 0 12px rgba(232,184,48,0.6);box-shadow:0 0 14px rgba(212,160,23,0.5);animation:cap .45s cubic-bezier(.34,1.56,.64,1)}
.op{color:rgba(255,255,255,0.35);font-size:0.8rem;font-weight:700}
#stotal{min-width:var(--slot-size);height:var(--slot-size);padding:0 6px;font-size:calc(var(--slot-size)*0.5);font-weight:900;border:2px solid rgba(255,255,255,0.35);border-radius:8px;background:transparent;display:flex;align-items:center;justify-content:center;color:#F0C040}
#stotal.captured{border-color:#F0C040;background:rgba(212,160,23,0.12);box-shadow:0 0 18px rgba(212,160,23,0.6);text-shadow:0 0 14px rgba(212,160,23,0.7);animation:cap .5s cubic-bezier(.34,1.56,.64,1) .15s both}
@keyframes cap{0%{transform:scale(1);box-shadow:0 0 0 transparent}30%{transform:scale(1.2);box-shadow:0 0 20px rgba(255,255,255,0.25)}100%{transform:scale(1);box-shadow:0 0 14px rgba(212,160,23,0.5)}}
</style>
</head><body>
<div id="cw"></div>
<div id="eq">
<div class="slot" id="s0"></div><span class="op">+</span>
<div class="slot" id="s1"></div><span class="op">+</span>
<div class="slot" id="s2"></div><span class="op">=</span>
<div class="slot" id="stotal"></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
function dbg(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"debug",msg:m}))}

// === SOUND ENGINE ===
var ac=null;
function gc(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume();return ac}
function sBounce(v){var c=gc(),t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(110*v+40,t);o.frequency.exponentialRampToValueAtTime(55,t+0.15);g.gain.setValueAtTime(0.18*v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+0.25)}
function sSettle(){var c=gc(),t=c.currentTime;for(var i=0;i<5;i++){var ti=t+i*0.06,o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(85-i*8,ti);g.gain.setValueAtTime(0.06*(1-i/5),ti);g.gain.exponentialRampToValueAtTime(0.001,ti+0.08);o.connect(g);g.connect(c.destination);o.start(ti);o.stop(ti+0.1)}}
function sRoll(){var c=gc(),t0=c.currentTime;for(var i=0;i<10;i++){var t=t0+i*0.07,o=c.createOscillator(),g=c.createGain();o.type="triangle";o.frequency.setValueAtTime(180+Math.random()*200,t);g.gain.setValueAtTime(0.06*(1-i/12),t);g.gain.exponentialRampToValueAtTime(0.001,t+0.04);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+0.05)}}
function sWhoosh(){var c=gc(),t=c.currentTime,b=c.createBuffer(1,c.sampleRate*0.5,c.sampleRate),dd=b.getChannelData(0);for(var ii=0;ii<dd.length;ii++)dd[ii]=(Math.random()*2-1)*0.12*Math.sin(ii/dd.length*Math.PI);var n=c.createBufferSource();n.buffer=b;var f=c.createBiquadFilter();f.type="bandpass";f.frequency.setValueAtTime(500,t);f.frequency.linearRampToValueAtTime(1400,t+0.25);f.Q.setValueAtTime(2,t);var g=c.createGain();g.gain.setValueAtTime(0.15,t);g.gain.linearRampToValueAtTime(0,t+0.5);n.connect(f);f.connect(g);g.connect(c.destination);n.start(t);n.stop(t+0.55)}
function sLand(){var c=gc(),t=c.currentTime;[523,659,784].forEach(function(fr,i){var o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(fr,t+i*0.07);g.gain.setValueAtTime(0.07,t+i*0.07);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.07+0.35);o.connect(g);g.connect(c.destination);o.start(t+i*0.07);o.stop(t+i*0.07+0.4)})}
function sDone(){var c=gc(),t=c.currentTime;[523,659,784,1047].forEach(function(fr,i){var o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(fr,t+i*0.1);g.gain.setValueAtTime(0.08,t+i*0.1);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.1+0.5);o.connect(g);g.connect(c.destination);o.start(t+i*0.1);o.stop(t+i*0.1+0.55)})}

// === PIP LAYOUTS ===
var PL={1:[[0,0]],2:[[-0.25,-0.25],[0.25,0.25]],3:[[-0.25,-0.25],[0,0],[0.25,0.25]],4:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]],5:[[-0.25,-0.25],[0.25,-0.25],[0,0],[-0.25,0.25],[0.25,0.25]],6:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0],[0.25,0],[-0.25,0.25],[0.25,0.25]]};

// === DICE FACE TEXTURE ===
function mkTex(n){
var C=document.createElement("canvas");C.width=512;C.height=512;var c=C.getContext("2d");
var g=c.createRadialGradient(180,150,20,280,290,400);
g.addColorStop(0,"#F5D26B");g.addColorStop(0.2,"#E8B830");g.addColorStop(0.45,"#D9A020");g.addColorStop(0.7,"#C48A18");g.addColorStop(1,"#9A6A0A");
c.fillStyle=g;c.fillRect(0,0,512,512);
var w=c.createLinearGradient(0,0,512,512);w.addColorStop(0,"rgba(255,180,50,0.12)");w.addColorStop(0.5,"rgba(200,120,20,0.06)");w.addColorStop(1,"rgba(160,80,10,0.15)");
c.fillStyle=w;c.fillRect(0,0,512,512);
for(var i=0;i<7000;i++){var r=Math.random();c.fillStyle=r>0.7?"rgba(255,220,120,"+Math.random()*0.07+")":r>0.35?"rgba(180,130,40,"+Math.random()*0.09+")":"rgba(100,65,15,"+Math.random()*0.08+")";c.fillRect(Math.random()*512,Math.random()*512,Math.random()>0.7?2:1,1)}
var ed=c.createRadialGradient(240,230,120,256,256,290);ed.addColorStop(0,"rgba(0,0,0,0)");ed.addColorStop(0.6,"rgba(0,0,0,0)");ed.addColorStop(0.85,"rgba(80,45,5,0.12)");ed.addColorStop(1,"rgba(50,25,0,0.28)");
c.fillStyle=ed;c.fillRect(0,0,512,512);
(PL[n]||[]).forEach(function(pp){var x=256+pp[0]*512,y=256+pp[1]*512;
var sh=c.createRadialGradient(x+1,y+2,16,x,y,44);sh.addColorStop(0,"rgba(0,0,0,0.75)");sh.addColorStop(0.5,"rgba(40,20,0,0.4)");sh.addColorStop(1,"rgba(0,0,0,0)");
c.fillStyle=sh;c.beginPath();c.arc(x,y,44,0,Math.PI*2);c.fill();
c.beginPath();c.arc(x,y,28,0,Math.PI*2);c.fillStyle="#080808";c.fill();
var inn=c.createRadialGradient(x-3,y-3,2,x,y,24);inn.addColorStop(0,"#1a1408");inn.addColorStop(0.5,"#0a0a06");inn.addColorStop(1,"#040404");
c.beginPath();c.arc(x,y,24,0,Math.PI*2);c.fillStyle=inn;c.fill();
c.beginPath();c.arc(x,y-1,29,Math.PI*1.1,Math.PI*1.9);c.strokeStyle="rgba(245,210,100,0.2)";c.lineWidth=1.5;c.stroke()});
return new THREE.CanvasTexture(C)}

// === LIMB MATERIAL ===
var SM=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.8,metalness:0.15});

// === ARM BUILDER (with hands & fingers) ===
function mkArm(){
var arm=new THREE.Group();
arm.add(new THREE.Mesh(new THREE.SphereGeometry(0.055,8,8),SM));
var up=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.035,0.8,6),SM);up.position.y=-0.43;arm.add(up);
var elb=new THREE.Mesh(new THREE.SphereGeometry(0.042,8,8),SM);elb.position.y=-0.85;arm.add(elb);
var fg=new THREE.Group();fg.position.y=-0.85;
var fore=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.028,0.8,6),SM);fore.position.y=-0.43;fg.add(fore);
var wr=new THREE.Mesh(new THREE.SphereGeometry(0.032,8,8),SM);wr.position.y=-0.85;fg.add(wr);
var hg=new THREE.Group();hg.position.y=-0.85;
var palm=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.04,0.06),SM);palm.position.y=-0.025;hg.add(palm);
var fingers=[];
[-0.025,0,0.025].forEach(function(xo){
var fG=new THREE.Group();fG.position.set(xo,-0.05,0);
var s1=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.01,0.12,5),SM);s1.position.y=-0.06;fG.add(s1);
var jt=new THREE.Mesh(new THREE.SphereGeometry(0.012,5,5),SM);jt.position.y=-0.12;fG.add(jt);
var tg=new THREE.Group();tg.position.y=-0.12;
var s2=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.008,0.1,5),SM);s2.position.y=-0.05;tg.add(s2);
var tn=new THREE.Mesh(new THREE.SphereGeometry(0.009,5,5),SM);tn.position.y=-0.1;tg.add(tn);
fG.add(tg);fG.userData.tipGroup=tg;
hg.add(fG);fingers.push(fG)});
hg.userData.fingers=fingers;
fg.add(hg);fg.userData.handGroup=hg;
arm.add(fg);
arm.userData.forearm=fg;arm.userData.handGroup=hg;arm.userData.fingers=fingers;
return arm}

// === LEG BUILDER ===
function mkLeg(){
var leg=new THREE.Group();
leg.add(new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6),SM));
var th=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.018,0.3,5),SM);th.position.y=-0.17;leg.add(th);
var kn=new THREE.Mesh(new THREE.SphereGeometry(0.024,6,6),SM);kn.position.y=-0.33;leg.add(kn);
var sg=new THREE.Group();sg.position.y=-0.33;
var sh=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.014,0.28,5),SM);sh.position.y=-0.15;sg.add(sh);
var ft=new THREE.Mesh(new THREE.SphereGeometry(0.022,6,5),SM);ft.position.set(0,-0.3,0.01);sg.add(ft);
leg.add(sg);leg.userData.shin=sg;return leg}

// === FINGER ANIMATION ===
function aF(arm,pl,pu){
if(arm.userData.handGroup)arm.userData.handGroup.rotation.x=0.3+pl*0.55-pu*0.1;
if(arm.userData.fingers)arm.userData.fingers.forEach(function(f,fi){
f.rotation.x=0.2+pl*0.65-pu*0.15;
f.rotation.z=(fi-1)*0.08*(1+pl*0.5);
if(f.userData.tipGroup)f.userData.tipGroup.rotation.x=0.1+pl*0.6+fi*0.04})}

// === DICE CHARACTER BUILDER ===
function mkDice(idx){
var root=new THREE.Group(),bp=new THREE.Group();root.add(bp);
var fv=[2,5,1,6,3,4];
var mats=fv.map(function(v){return new THREE.MeshStandardMaterial({map:mkTex(v),roughness:0.78,metalness:0.04,emissive:new THREE.Color(0xC48A18),emissiveIntensity:0.04})});
var body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);body.castShadow=true;body.receiveShadow=true;bp.add(body);
var glow=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1),new THREE.MeshBasicMaterial({color:0xE8B830,transparent:true,opacity:0.05,side:THREE.BackSide}));bp.add(glow);
var la=mkArm();la.position.set(-0.55,-0.05,0);la.rotation.z=-0.25;bp.add(la);
var ra=mkArm();ra.position.set(0.55,-0.05,0);ra.rotation.z=0.25;bp.add(ra);
var ll=mkLeg();ll.position.set(-0.32,-0.52,0.08);ll.rotation.z=0.3;bp.add(ll);
var rl=mkLeg();rl.position.set(0.32,-0.52,0.08);rl.rotation.z=-0.3;bp.add(rl);
var personalities=[
{spd:1.05,bob:0.07,sway:0.09,pChance:0.005,wanderR:3.0,turnSpd:3.6},
{spd:0.66,bob:0.05,sway:0.05,pChance:0.010,wanderR:2.5,turnSpd:2.1},
{spd:1.35,bob:0.09,sway:0.12,pChance:0.002,wanderR:3.5,turnSpd:5.4}];
var pers=personalities[idx]||personalities[0];
return{root:root,bp:bp,body:body,glow:glow,la:la,ra:ra,ll:ll,rl:rl,
px:0,py:0,pz:0,vx:0,vy:0,vz:0,tumbleX:0,tumbleZ:0,
throwResult:0,throwPhase:null,bounceCount:0,settleStart:0,radius:0.75,
wx:(idx-1)*2.0,wz:Math.random()*2-1,
targetX:(idx-1)*2,targetZ:Math.random()*3-1.5,
heading:Math.random()*Math.PI*2,targetHeading:0,
wanderTimer:0,wanderDur:2+Math.random()*3,
moveSpeed:pers.spd,bob:pers.bob,sway:pers.sway,
pChance:pers.pChance,wanderR:pers.wanderR,turnSpd:pers.turnSpd,
isPaused:false,pauseT:0,wOff:Math.random()*Math.PI*2,
actionState:"walk",actionTimer:0,bumpDir:1,
flyTimer:0,flyStart:null,slotIdx:-1,rollStyle:"",rollTarget:null,rollDuration:2,arcDir:1}}

function fUR(n){return{1:{x:0,z:0},2:{x:0,z:Math.PI/2},3:{x:Math.PI/2,z:0},4:{x:-Math.PI/2,z:0},5:{x:0,z:-Math.PI/2},6:{x:Math.PI,z:0}}[n]}

// === HELPERS ===
function lerpAngle(a,b,f){var d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*f}
function pickNewTarget(d){
var ang=Math.random()*Math.PI*2;var r=Math.random()*d.wanderR;
d.targetX=Math.cos(ang)*r;d.targetZ=Math.sin(ang)*r;
d.wanderDur=0.8+Math.random()*2;d.wanderTimer=0;
var roll=Math.random();
if(roll<0.15){d.actionState="look";d.actionTimer=1+Math.random()*2}
else if(roll<0.25){d.actionState="spin";d.actionTimer=0.8+Math.random()*0.5}
else if(roll<0.35){d.actionState="hop";d.actionTimer=0.5+Math.random()*0.3}
else{d.actionState="walk";d.actionTimer=0}}

// === SCENE SETUP ===
var cw=document.getElementById("cw"),W=cw.clientWidth,H=cw.clientHeight;
var ren=new THREE.WebGLRenderer({antialias:true,alpha:true});
ren.setClearColor(0,0);ren.setSize(W,H);ren.setPixelRatio(Math.min(window.devicePixelRatio,2));
ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;
ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.0;
cw.appendChild(ren.domElement);

var scene=new THREE.Scene();
var cam=new THREE.PerspectiveCamera(50,W/H,0.1,100);
cam.position.set(0,3,6);cam.lookAt(0,0,0);

scene.add(new THREE.AmbientLight(0xffa040,0.5));
var sun=new THREE.DirectionalLight(0xfff0dd,1.5);
sun.position.set(2,7,3);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=0.5;sun.shadow.camera.far=25;
sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
sun.shadow.bias=-0.0005;scene.add(sun);
var wl=new THREE.PointLight(0xff6600,0.4,15);wl.position.set(-4,3,-1);scene.add(wl);
var bl=new THREE.PointLight(0xff9944,0.3,12);bl.position.set(0,2,-5);scene.add(bl);

var flr=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0,transparent:true,opacity:0.15,roughness:0.95}));
flr.rotation.x=-Math.PI/2;flr.position.y=-1.3;flr.receiveShadow=true;scene.add(flr);

var dG=new THREE.BufferGeometry(),dA=new Float32Array(150);
for(var i=0;i<50;i++){dA[i*3]=(Math.random()-0.5)*12;dA[i*3+1]=Math.random()*5;dA[i*3+2]=(Math.random()-0.5)*12}
dG.setAttribute("position",new THREE.BufferAttribute(dA,3));
var dust=new THREE.Points(dG,new THREE.PointsMaterial({color:0xE8B830,size:0.018,transparent:true,opacity:0.2}));
scene.add(dust);

// Create 3 dice
var dice=[];
for(var i=0;i<3;i++){var d=mkDice(i);scene.add(d.root);dice.push(d)}

var GRV=14,FLY=-1.3,FRC=0.97,GY=FLY+0.5+1.24;
dice.forEach(function(d){d.root.position.set(d.wx,GY,d.wz);d.root.rotation.y=d.heading;pickNewTarget(d)});

// State machine
var STT={I:0,T:1,F:2,D:3};
var state=STT.I,tT=0,resShown=false,sndP={};
var throwResults=[],throwTotal=0,flyDone=false;

// UI
var slotEls=[document.getElementById("s0"),document.getElementById("s1"),document.getElementById("s2")];
var dCol=["#E8B830","#D4A020","#F0C840"];
function fillSlot(i,v){slotEls[i].textContent=v;slotEls[i].classList.add("captured");slotEls[i].style.color=dCol[i]}
function clearSlots(){slotEls.forEach(function(s){s.textContent="";s.classList.remove("captured");s.style.color="#F0C040"});var tot=document.getElementById("stotal");tot.textContent="";tot.classList.remove("captured")}
function resetEqUI(){document.getElementById("eq").classList.remove("show");clearSlots()}

// Camera
var cPos=new THREE.Vector3(0,3,6),cLk=new THREE.Vector3(0,0,0);
var cTP=new THREE.Vector3(0,3,6),cTL=new THREE.Vector3(0,0,0);

// === THROW (called from RN) ===
window.doThrow=function(){
if(state!==STT.I)return;
dbg("doThrow");
resetEqUI();resShown=false;flyDone=false;sndP={};throwResults=[];
dice.forEach(function(d,i){
var r=Math.floor(Math.random()*6)+1;
d.throwResult=r;d.throwPhase="tumble";d.bounceCount=0;
d.tumbleX=0;d.tumbleZ=0;d.slotIdx=i;d.flyTimer=0;d.flyStart=null;
d.px=d.wx;d.py=GY;d.pz=d.wz;
d.vx=(i-1)*1.5+(Math.random()-0.5);
d.vy=3.5+Math.random()*1;
d.vz=-(5+Math.random()*1);
throwResults.push(r)});
throwTotal=throwResults.reduce(function(a,b){return a+b},0);
state=STT.T;sRoll()};

cw.addEventListener("click",function(){if(state===STT.I)window.doThrow()});

// === MAIN ANIMATION LOOP ===
var clk=new THREE.Clock();
function anim(){
requestAnimationFrame(anim);
var dt=Math.min(clk.getDelta(),0.05);
tT+=dt;var t=tT;

// Dust
var dp=dust.geometry.attributes.position;
for(var i=0;i<dp.count;i++){var y=dp.getY(i)+dt*0.06;if(y>5)y=0;dp.setY(i,y);dp.setX(i,dp.getX(i)+Math.sin(t*0.3+i)*dt*0.008)}
dp.needsUpdate=true;

// ========== IDLE ==========
if(state===STT.I){
dice.forEach(function(d){
var wb=t*2+d.wOff;

// Paused
if(d.isPaused){
d.pauseT-=dt;if(d.pauseT<=0)d.isPaused=false;
d.bp.rotation.set(Math.sin(wb*0.7)*0.03,0,Math.sin(wb)*0.04);
d.la.rotation.x=Math.sin(wb*0.5)*0.08;d.ra.rotation.x=Math.sin(wb*0.5+1)*0.08;
d.la.rotation.z=-0.25;d.ra.rotation.z=0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.1;
aF(d.la,0.1,0);aF(d.ra,0.1,0);d.ll.rotation.x=0;d.rl.rotation.x=0;return}

if(Math.random()<d.pChance*dt*60){d.isPaused=true;d.pauseT=0.8+Math.random()*3;return}
d.wanderTimer+=dt;if(d.wanderTimer>=d.wanderDur){pickNewTarget(d)}

// Look around
if(d.actionState==="look"){
d.actionTimer-=dt;if(d.actionTimer<=0){d.actionState="walk";d.actionTimer=0}
d.heading=lerpAngle(d.heading,d.heading+Math.sin(t*1.5+d.wOff)*0.05,dt*2);
d.bp.rotation.set(0,0,Math.sin(t*1.2+d.wOff)*0.06);
d.la.rotation.x=Math.sin(wb*0.3)*0.06;d.ra.rotation.x=Math.sin(wb*0.3+1.5)*0.06;
d.la.rotation.z=-0.3;d.ra.rotation.z=0.3;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.08;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.08;
aF(d.la,0,0);aF(d.ra,0,0);d.ll.rotation.x=0;d.rl.rotation.x=0;
d.root.position.set(d.wx,GY,d.wz);d.root.rotation.y=d.heading;
d.glow.material.opacity=0.05+Math.sin(t*1.5+d.wOff)*0.02;return}

// Spin
if(d.actionState==="spin"){
d.actionTimer-=dt;if(d.actionTimer<=0){d.actionState="walk";d.actionTimer=0}
d.heading+=dt*8;
d.la.rotation.z=-0.8;d.ra.rotation.z=0.8;d.la.rotation.x=-0.3;d.ra.rotation.x=-0.3;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=-0.2;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.2;
d.root.position.set(d.wx,GY+0.05,d.wz);d.root.rotation.y=d.heading;
d.bp.rotation.set(0,0,0);d.ll.rotation.x=0;d.rl.rotation.x=0;
aF(d.la,0,0.5);aF(d.ra,0,0.5);d.glow.material.opacity=0.1;return}

// Hop
if(d.actionState==="hop"){
d.actionTimer-=dt;if(d.actionTimer<=0){d.actionState="walk";d.actionTimer=0}
var hP=Math.sin((0.5-d.actionTimer)*Math.PI/0.5);
d.root.position.set(d.wx,GY+Math.max(0,hP)*0.4,d.wz);d.root.rotation.y=d.heading;
d.bp.rotation.set(0,0,0);
d.la.rotation.x=-0.4;d.ra.rotation.x=-0.4;d.la.rotation.z=-0.5;d.ra.rotation.z=0.5;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=-0.1;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.1;
d.ll.rotation.x=hP>0?-0.3:0.2;d.rl.rotation.x=hP>0?-0.3:0.2;
aF(d.la,0,hP>0?0.3:0);aF(d.ra,0,hP>0?0.3:0);d.glow.material.opacity=0.08;return}

// Bumped
if(d.actionState==="bumped"){
d.actionTimer-=dt;var bP=1-d.actionTimer/1.2;var bE=bP<0.3?bP/0.3:1-(bP-0.3)/0.7;
d.wx+=Math.sin(d.heading+Math.PI)*dt*d.moveSpeed*3*Math.max(0,1-bP*2);
d.wz+=Math.cos(d.heading+Math.PI)*dt*d.moveSpeed*3*Math.max(0,1-bP*2);
d.bp.rotation.set(-0.3*bE*d.bumpDir,0,0.25*Math.sin(bP*Math.PI*3)*d.bumpDir);
d.root.position.set(d.wx,GY+Math.max(0,Math.sin(bP*Math.PI*2))*0.08,d.wz);
d.root.rotation.y=d.heading;
d.la.rotation.x=-0.4*bE;d.ra.rotation.x=-0.4*bE;
d.la.rotation.z=-0.6-0.3*bE;d.ra.rotation.z=0.6+0.3*bE;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=-0.2*bE;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=-0.2*bE;
d.ll.rotation.x=-0.2*bE+Math.sin(bP*Math.PI*4)*0.15;
d.rl.rotation.x=0.1*bE+Math.sin(bP*Math.PI*4+1)*0.15;
aF(d.la,0,0.4*bE);aF(d.ra,0,0.4*bE);
if(d.actionTimer<=0){d.actionState="walk";pickNewTarget(d)}
d.glow.material.opacity=0.08;return}

// Pushing
if(d.actionState==="pushing"){
d.actionTimer-=dt;var pP=1-d.actionTimer/0.5;var pE=pP<0.4?pP/0.4:1-(pP-0.4)/0.6;
d.bp.rotation.set(0.1*pE,0,0);d.root.position.set(d.wx,GY,d.wz);d.root.rotation.y=d.heading;
d.ra.rotation.x=0.7*pE;d.ra.rotation.z=0.15;d.la.rotation.x=-0.1;d.la.rotation.z=-0.25;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.3*pE;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1;
d.ll.rotation.x=0.15*pE;d.rl.rotation.x=-0.1*pE;
aF(d.ra,0.3*pE,0);aF(d.la,0,0);
if(d.actionTimer<=0){d.actionState="walk";pickNewTarget(d)}
d.glow.material.opacity=0.06;return}

// Walking
var dx=d.targetX-d.wx,dz=d.targetZ-d.wz,dist=Math.sqrt(dx*dx+dz*dz);
if(dist>0.15){var spd=d.moveSpeed*dt;d.wx+=dx/dist*spd;d.wz+=dz/dist*spd;
var targetAng=Math.atan2(dx,dz);d.heading=lerpAngle(d.heading,targetAng,dt*d.turnSpd)}
else{pickNewTarget(d)}
var sc=t*d.moveSpeed*6+d.wOff;
d.root.position.set(d.wx,GY-Math.abs(Math.sin(sc))*d.bob+Math.max(0,Math.sin(sc*2-0.5))*0.02,d.wz);
d.root.rotation.y=d.heading;
d.bp.rotation.set(0.03,0,Math.sin(sc)*d.sway);
d.ll.rotation.x=Math.sin(sc)*0.5;d.rl.rotation.x=Math.sin(sc+Math.PI)*0.5;
if(d.ll.userData.shin)d.ll.userData.shin.rotation.x=Math.max(0,Math.sin(sc))*0.65;
if(d.rl.userData.shin)d.rl.userData.shin.rotation.x=Math.max(0,Math.sin(sc+Math.PI))*0.65;
var lp=sc+Math.PI,rp=sc;
d.la.rotation.x=Math.sin(lp)*0.35;d.ra.rotation.x=Math.sin(rp)*0.35;
d.la.rotation.z=-0.25;d.ra.rotation.z=0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1+Math.sin(lp)*0.15;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.1+Math.sin(rp)*0.15;
aF(d.la,Math.max(0,Math.sin(lp)),Math.max(0,-Math.sin(lp)));
aF(d.ra,Math.max(0,Math.sin(rp)),Math.max(0,-Math.sin(rp)));
d.glow.material.opacity=0.05+Math.sin(t*1.5+d.wOff)*0.02;
});

// Idle collision with bump/push reactions
for(var ci=0;ci<dice.length;ci++){for(var cj=ci+1;cj<dice.length;cj++){
var a=dice[ci],b=dice[cj];
var cdx=b.wx-a.wx,cdz=b.wz-a.wz;
var cdist=Math.sqrt(cdx*cdx+cdz*cdz);var minD=1.4;
if(cdist<minD&&cdist>0.01){
var overlap=(minD-cdist)/2;var cnx=cdx/cdist,cnz=cdz/cdist;
a.wx-=cnx*overlap*0.5;a.wz-=cnz*overlap*0.5;
b.wx+=cnx*overlap*0.5;b.wz+=cnz*overlap*0.5;
if(cdist<1.2&&a.actionState!=="bumped"&&b.actionState!=="bumped"){
var pusher=Math.random()>0.5?a:b;var stumbler=pusher===a?b:a;
stumbler.actionState="bumped";stumbler.actionTimer=0.8+Math.random()*0.6;
stumbler.bumpDir=pusher===a?1:-1;
pusher.actionState="pushing";pusher.actionTimer=0.5}}}}

cTP.set(Math.sin(t*0.08)*0.5,2.8,5.5);cTL.set(0,GY-0.3,0);
}

// ========== THROW ==========
if(state===STT.T){
var allS=true;
dice.forEach(function(d,i){
if(d.throwPhase==="tumble"){
allS=false;
d.vy-=GRV*dt;d.px+=d.vx*dt;d.py+=d.vy*dt;d.pz+=d.vz*dt;
d.vx*=FRC;d.vz*=FRC;
d.tumbleX+=d.vz*dt*-2.5;d.tumbleZ+=d.vx*dt*2;
d.bp.rotation.set(d.tumbleX,Math.sin(t*2+i)*0.2,d.tumbleZ);
d.root.position.set(d.px,d.py,d.pz);
// Flailing limbs
d.la.rotation.x=Math.sin(t*4+i)*0.6;d.ra.rotation.x=Math.sin(t*4+i+2)*0.6;
d.la.rotation.z=-0.5+Math.sin(t*3)*0.25;d.ra.rotation.z=0.5+Math.sin(t*3+1)*0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=Math.sin(t*5)*0.4;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=Math.sin(t*5+1)*0.4;
[d.la,d.ra].forEach(function(arm){
if(arm.userData.handGroup)arm.userData.handGroup.rotation.x=Math.sin(t*7)*0.5;
if(arm.userData.fingers)arm.userData.fingers.forEach(function(f,fi){
f.rotation.x=Math.sin(t*8+fi)*0.6;
if(f.userData.tipGroup)f.userData.tipGroup.rotation.x=Math.sin(t*9+fi*2)*0.4})});
d.ll.rotation.x=-0.2+Math.sin(t*6+i)*0.25;d.rl.rotation.x=-0.2+Math.sin(t*6+i+1)*0.25;
// Ground bounce
if(d.py<GY&&d.vy<0){
d.bounceCount++;d.py=GY;
var k="b"+i+"_"+d.bounceCount;
if(!sndP[k]){sndP[k]=1;sBounce(Math.max(0.2,1-d.bounceCount*0.2))}
if(d.bounceCount>=2){d.throwPhase="settle";d.settleStart=t;sSettle()}
else{d.vy=Math.abs(d.vy)*(0.35-d.bounceCount*0.05);d.vx*=0.7;d.vz*=0.6}}
d.glow.material.opacity=0.1+Math.sin(t*5)*0.04;
}
else if(d.throwPhase==="settle"){
allS=false;
var el=t-d.settleStart,p=Math.min(el/0.4,1),e=1-Math.pow(1-p,4);
var tgt=fUR(d.throwResult);
d.bp.rotation.x+=(tgt.x-d.bp.rotation.x)*e*0.12;
d.bp.rotation.z+=(tgt.z-d.bp.rotation.z)*e*0.12;
d.bp.rotation.y*=(1-e*0.1);
var fx=(i-1)*2.2,fz=-1;
d.px+=(fx-d.px)*e*0.08;d.pz+=(fz-d.pz)*e*0.08;
d.py=GY+Math.sin(el*5)*0.015*(1-e);
d.root.position.set(d.px,d.py,d.pz);d.root.rotation.y*=(1-e*0.05);
d.la.rotation.x+=(0-d.la.rotation.x)*e*0.08;d.ra.rotation.x+=(0-d.ra.rotation.x)*e*0.08;
d.la.rotation.z+=(-0.6-d.la.rotation.z)*e*0.08;d.ra.rotation.z+=(0.6-d.ra.rotation.z)*e*0.08;
d.ll.rotation.x*=(1-e*0.08);d.rl.rotation.x*=(1-e*0.08);
aF(d.la,0,0);aF(d.ra,0,0);
if(p>=1){d.throwPhase="settled";d.bp.rotation.set(tgt.x,0,tgt.z);
d.root.position.set(fx,GY,fz);d.root.rotation.y=0}}
});

// Dice-dice collision during tumble
var tu=dice.filter(function(d){return d.throwPhase==="tumble"});
if(tu.length>1){for(var i=0;i<tu.length;i++)for(var j=i+1;j<tu.length;j++){
var a=tu[i],b=tu[j],ddx=b.px-a.px,ddz=b.pz-a.pz;
var dist=Math.sqrt(ddx*ddx+ddz*ddz),mn=a.radius+b.radius;
if(dist<mn&&dist>0.001){var o=(mn-dist)/2,nx=ddx/dist,nz=ddz/dist;
a.px-=nx*o;a.pz-=nz*o;b.px+=nx*o;b.pz+=nz*o;
var rv=a.vx-b.vx,rz=a.vz-b.vz,rd=rv*nx+rz*nz;
if(rd>0){var im=rd*0.7;a.vx-=im*nx;a.vz-=im*nz;b.vx+=im*nx;b.vz+=im*nz}}}
tu.forEach(function(d){d.root.position.set(d.px,d.py,d.pz)})}

// All settled → start flying to equation
if(allS&&!resShown){
resShown=true;
document.getElementById("eq").classList.add("show");
var stys=["rollStraight","rollArc","hopRoll","spinThenRoll","zigzag","backflipRoll"];
dice.forEach(function(d,i){
d.throwPhase="rolling";d.flyTimer=0;
d.flyStart={x:d.root.position.x,y:d.root.position.y,z:d.root.position.z};
d.rollStyle=stys[Math.floor(Math.random()*stys.length)];
d.rollTarget={x:(i-1)*1.5,y:GY,z:-4.5};
d.rollDuration=0.8+i*0.15+Math.random()*0.2;
d.arcDir=Math.random()>0.5?1:-1;
sRoll()});
state=STT.F;
}
cTP.set(0,5.5,4);cTL.set(0,-0.3,-1);
}

// ========== FLY TO EQUATION ==========
if(state===STT.F){
var allL=true;
dice.forEach(function(d,i){
if(d.throwPhase==="rolling"){
allL=false;d.flyTimer+=dt;
var dur=d.rollDuration,p=Math.min(d.flyTimer/dur,1);
var e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
var sx=d.flyStart.x,sy=d.flyStart.y,sz=d.flyStart.z;
var ex=d.rollTarget.x,ey=d.rollTarget.y,ez=d.rollTarget.z;
var sty=d.rollStyle;
var px,py,pz,bRY=0,bRX=0,lA=0.5,aS=0.3,ws=8;

if(sty==="rollStraight"){
px=sx+(ex-sx)*e;pz=sz+(ez-sz)*e;py=ey+Math.abs(Math.sin(p*Math.PI*6))*0.06;
bRX=p*Math.PI*4;lA=0.6;ws=10}
else if(sty==="rollArc"){
var arc=d.arcDir*3*Math.sin(p*Math.PI);
px=sx+(ex-sx)*e+arc;pz=sz+(ez-sz)*e;py=ey+Math.abs(Math.sin(p*Math.PI*5))*0.05;
bRX=p*Math.PI*3;ws=9}
else if(sty==="hopRoll"){
px=sx+(ex-sx)*e;pz=sz+(ez-sz)*e;py=ey+Math.max(0,Math.sin(p*Math.PI*8))*0.25;
bRX=p*Math.PI*5;lA=0.8;ws=12;aS=0.5}
else if(sty==="spinThenRoll"){
if(p<0.3){var sp=p/0.3;px=sx;pz=sz;py=ey;bRY=sp*Math.PI*6;bRX=sp*Math.PI*2;lA=0.2;ws=15}
else{var rp2=(p-0.3)/0.7,re=rp2<0.5?2*rp2*rp2:1-Math.pow(-2*rp2+2,2)/2;
px=sx+(ex-sx)*re;pz=sz+(ez-sz)*re;py=ey+Math.abs(Math.sin(rp2*Math.PI*5))*0.05;
bRX=0.3*Math.PI+rp2*Math.PI*3;lA=0.7;ws=11}}
else if(sty==="zigzag"){
var zig=Math.sin(p*Math.PI*5)*1.5*(1-p);
px=sx+(ex-sx)*e+zig;pz=sz+(ez-sz)*e;py=ey+Math.abs(Math.sin(p*Math.PI*7))*0.04;
bRY=Math.sin(p*Math.PI*5)*0.4;bRX=p*Math.PI*4;lA=0.55;ws=10}
else{
if(p<0.25){var bp2=p/0.25;px=sx;pz=sz;py=ey+Math.sin(bp2*Math.PI)*1.5;
bRX=-bp2*Math.PI*2;lA=0.1;aS=0.8}
else{var rp3=(p-0.25)/0.75,re2=rp3<0.5?2*rp3*rp3:1-Math.pow(-2*rp3+2,2)/2;
px=sx+(ex-sx)*re2;pz=sz+(ez-sz)*re2;py=ey+Math.abs(Math.sin(rp3*Math.PI*5))*0.06;
bRX=rp3*Math.PI*3;lA=0.6;ws=10}}

d.root.position.set(px,py,pz);
d.root.rotation.y=Math.atan2(ex-sx,ez-sz)+bRY;
d.bp.rotation.x=bRX;d.bp.rotation.z=0;
// Walking animation during roll
var wt=t*ws;
d.ll.rotation.x=Math.sin(wt)*lA;d.rl.rotation.x=Math.sin(wt+Math.PI)*lA;
if(d.ll.userData.shin)d.ll.userData.shin.rotation.x=Math.max(0,Math.sin(wt))*lA*0.8;
if(d.rl.userData.shin)d.rl.userData.shin.rotation.x=Math.max(0,Math.sin(wt+Math.PI))*lA*0.8;
var lp2=wt+Math.PI,rp4=wt;
d.la.rotation.x=Math.sin(lp2)*aS;d.ra.rotation.x=Math.sin(rp4)*aS;
d.la.rotation.z=-0.25;d.ra.rotation.z=0.25;
if(d.la.userData.forearm)d.la.userData.forearm.rotation.x=0.1+Math.sin(lp2)*0.15;
if(d.ra.userData.forearm)d.ra.userData.forearm.rotation.x=0.1+Math.sin(rp4)*0.15;
aF(d.la,Math.max(0,Math.sin(lp2)),Math.max(0,-Math.sin(lp2)));
aF(d.ra,Math.max(0,Math.sin(rp4)),Math.max(0,-Math.sin(rp4)));
if(p>=1){d.throwPhase="shrinking";d.flyTimer=0;d.flyStart={x:px,y:py,z:pz};sWhoosh()}}

else if(d.throwPhase==="shrinking"){
allL=false;d.flyTimer+=dt;
var p2=Math.min(d.flyTimer/0.3,1),e2=1-Math.pow(1-p2,3);
var sx2=d.flyStart.x,sy2=d.flyStart.y,sz2=d.flyStart.z;
d.root.position.set(
sx2+((i-1)*0.5-sx2)*e2,
sy2+(5.5-sy2)*e2+Math.sin(p2*Math.PI)*0.8,
sz2+(-2-sz2)*e2);
d.root.scale.setScalar(1-e2*0.85);
d.bp.rotation.y+=dt*12;
d.la.rotation.z=-1.2*e2;d.ra.rotation.z=1.2*e2;
d.la.rotation.x=-0.3*e2;d.ra.rotation.x=-0.3*e2;
d.ll.rotation.x=-0.5*e2;d.rl.rotation.x=-0.5*e2;
[d.la,d.ra].forEach(function(arm){
if(arm.userData.handGroup)arm.userData.handGroup.rotation.x=-0.3*e2;
if(arm.userData.fingers)arm.userData.fingers.forEach(function(f,fi){
f.rotation.x=-0.2*e2;f.rotation.z=(fi-1)*0.2*e2;
if(f.userData.tipGroup)f.userData.tipGroup.rotation.x=-0.15*e2})});
if(p2>=1){d.throwPhase="landed";d.root.visible=false;sLand();fillSlot(i,d.throwResult)}}
});

if(allL&&!flyDone){
flyDone=true;
var tot=document.getElementById("stotal");tot.textContent=throwTotal;tot.classList.add("captured");
sDone();
// Wait then send results to RN
setTimeout(function(){
dbg("sending diceResult");
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"diceResult",results:throwResults,total:throwTotal}));
// Fallback: if WebView stays mounted, reset to idle
setTimeout(function(){
resetEqUI();
dice.forEach(function(d){
d.throwPhase=null;d.isPaused=false;
d.bp.rotation.set(0,0,0);d.root.rotation.y=0;
d.root.visible=true;d.root.scale.setScalar(1);
d.wx=(Math.random()-0.5)*4;d.wz=Math.random()*2-1;
d.heading=Math.random()*Math.PI*2;pickNewTarget(d)});
state=STT.I;resShown=false;flyDone=false;
},500);
},1500);
state=STT.D;
}
cTP.set(0,4,4.5);cTL.set(0,1.5,-1);
}

// ========== DONE (admire results) ==========
if(state===STT.D){cTP.set(0,4,4.5);cTL.set(0,1.5,-1)}

// Camera lerp + render
cPos.lerp(cTP,dt*2.5);cLk.lerp(cTL,dt*2.5);
cam.position.copy(cPos);cam.lookAt(cLk);
ren.render(scene,cam);
}
anim();

window.addEventListener("resize",function(){
var w=cw.clientWidth,h=cw.clientHeight;
ren.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()});
<\/script>
</body></html>
`;
