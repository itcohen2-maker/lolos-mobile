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

const DiceWebViewComponent = forwardRef<DiceWebViewRef, DiceWebViewProps>(
  ({ onResult, height = 220 }, ref) => {
    const webViewRef = useRef<WebView>(null);

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
        if (data.type === 'diceResult' && onResult) {
          onResult(data.results, data.total);
        }
      } catch (e) {}
    }, [onResult]);

    return (
      <View style={[styles.container, { height: height as any }]}>
        <WebView
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
#c{width:100%;height:100%;display:block}
</style>
</head><body>
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
// === SOUND ENGINE ===
let audioCtx=null;
function getAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();return audioCtx}
function playClack(vol=0.3,pitch=800){const ctx=getAudio(),t=ctx.currentTime,bs=ctx.sampleRate*0.04,buf=ctx.createBuffer(1,bs,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<bs;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/bs,3);const n=ctx.createBufferSource();n.buffer=buf;const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=pitch+Math.random()*400;bp.Q.value=2;const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);n.connect(bp).connect(g).connect(ctx.destination);n.start(t);n.stop(t+0.06)}
function playThud(vol=0.2){const ctx=getAudio(),t=ctx.currentTime,o=ctx.createOscillator();o.type="sine";o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+0.15);const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);const bs=ctx.sampleRate*0.1,buf=ctx.createBuffer(1,bs,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<bs;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/bs,4);const n=ctx.createBufferSource();n.buffer=buf;const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=300;const ng=ctx.createGain();ng.gain.setValueAtTime(vol*0.5,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.15);o.connect(g).connect(ctx.destination);n.connect(lp).connect(ng).connect(ctx.destination);o.start(t);o.stop(t+0.2);n.start(t);n.stop(t+0.15)}
function playRollStart(){for(let i=0;i<6;i++){const delay=i*0.03+Math.random()*0.015;setTimeout(()=>playClack(0.08+Math.random()*0.08,1200+Math.random()*800),delay*1000)}}
let rollNodes=null;
function startRollLoop(){const ctx=getAudio(),t=ctx.currentTime,r=ctx.createOscillator();r.type="sawtooth";r.frequency.value=60;const rg=ctx.createGain();rg.gain.value=0.04;const rlp=ctx.createBiquadFilter();rlp.type="lowpass";rlp.frequency.value=150;r.connect(rlp).connect(rg).connect(ctx.destination);const bs=ctx.sampleRate*2,buf=ctx.createBuffer(1,bs,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<bs;i++){d[i]=Math.random()<0.08?(Math.random()*2-1)*0.8:(Math.random()*2-1)*0.05}const n=ctx.createBufferSource();n.buffer=buf;n.loop=true;const nbp=ctx.createBiquadFilter();nbp.type="bandpass";nbp.frequency.value=1800;nbp.Q.value=1.5;const ng=ctx.createGain();ng.gain.value=0.1;n.connect(nbp).connect(ng).connect(ctx.destination);r.start(t);n.start(t);rollNodes={rumble:r,rumbleGain:rg,noise:n,nGain:ng,ctx}}
function stopRollLoop(){if(!rollNodes)return;const{rumble,rumbleGain,noise,nGain,ctx}=rollNodes,t=ctx.currentTime;rumbleGain.gain.setValueAtTime(rumbleGain.gain.value,t);rumbleGain.gain.exponentialRampToValueAtTime(0.001,t+0.3);nGain.gain.setValueAtTime(nGain.gain.value,t);nGain.gain.exponentialRampToValueAtTime(0.001,t+0.3);setTimeout(()=>{try{rumble.stop();noise.stop()}catch(e){}},350);rollNodes=null}
function playSettleSound(){const ctx=getAudio();[{delay:0,vol:0.15,pitch:700},{delay:0.1,vol:0.1,pitch:600},{delay:0.22,vol:0.06,pitch:500},{delay:0.38,vol:0.03,pitch:450}].forEach(({delay,vol,pitch})=>{setTimeout(()=>{const bs=ctx.sampleRate*0.03,buf=ctx.createBuffer(1,bs,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<bs;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/bs,4);const s=ctx.createBufferSource();s.buffer=buf;const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=pitch;bp.Q.value=3;const g=ctx.createGain();g.gain.setValueAtTime(vol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05);s.connect(bp).connect(g).connect(ctx.destination);s.start();s.stop(ctx.currentTime+0.05)},delay*1000)});setTimeout(()=>{const o=ctx.createOscillator();o.type="sine";o.frequency.setValueAtTime(90,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(35,ctx.currentTime+0.2);const g=ctx.createGain();g.gain.setValueAtTime(0.08,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.25)},450)}

// === DICE SETUP ===
const PIP_LAYOUTS={1:[[0,0]],2:[[-0.25,-0.25],[0.25,0.25]],3:[[-0.25,-0.25],[0,0],[0.25,0.25]],4:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]],5:[[-0.25,-0.25],[0.25,-0.25],[0,0],[-0.25,0.25],[0.25,0.25]],6:[[-0.25,-0.25],[0.25,-0.25],[-0.25,0],[0.25,0],[-0.25,0.25],[0.25,0.25]]};

function createPipTexture(num){
  const C=document.createElement("canvas");C.width=512;C.height=512;const ctx=C.getContext("2d");
  const base=ctx.createRadialGradient(180,160,20,280,280,400);
  base.addColorStop(0,"#EEC850");base.addColorStop(0.2,"#D4A828");base.addColorStop(0.5,"#B8901C");base.addColorStop(0.8,"#996E10");base.addColorStop(1,"#7A580A");
  ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
  for(let i=0;i<30;i++){const cx=Math.random()*512,cy=Math.random()*512,r=30+Math.random()*80,p=ctx.createRadialGradient(cx,cy,0,cx,cy,r);if(Math.random()>0.5){p.addColorStop(0,"rgba(240,200,80,"+(0.1+Math.random()*0.15)+")");p.addColorStop(1,"rgba(240,200,80,0)")}else{p.addColorStop(0,"rgba(100,70,15,"+(0.1+Math.random()*0.12)+")");p.addColorStop(1,"rgba(100,70,15,0)")}ctx.fillStyle=p;ctx.fillRect(0,0,512,512)}
  ctx.strokeStyle="rgba(255,220,100,0.08)";ctx.lineWidth=1;for(let i=0;i<40;i++){ctx.beginPath();const sx=Math.random()*512,sy=Math.random()*512,len=20+Math.random()*60,a=Math.random()*Math.PI*2;ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);ctx.stroke()}
  ctx.strokeStyle="rgba(60,40,5,0.1)";for(let i=0;i<25;i++){ctx.beginPath();const sx=Math.random()*512,sy=Math.random()*512,len=15+Math.random()*40,a=Math.random()*Math.PI*2;ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);ctx.stroke()}
  for(let i=0;i<4000;i++){const x=Math.random()*512,y=Math.random()*512;ctx.fillStyle=Math.random()>0.5?"rgba(255,230,130,"+Math.random()*0.06+")":"rgba(80,55,8,"+Math.random()*0.08+")";ctx.fillRect(x,y,1+Math.random(),1+Math.random())}
  ctx.strokeStyle="rgba(180,140,40,0.35)";ctx.lineWidth=4;ctx.strokeRect(16,16,480,480);ctx.strokeStyle="rgba(120,90,20,0.25)";ctx.lineWidth=2;ctx.strokeRect(28,28,456,456);ctx.strokeStyle="rgba(255,220,100,0.12)";ctx.lineWidth=1;ctx.strokeRect(14,14,484,484);
  [[38,38],[474,38],[38,474],[474,474]].forEach(([cx,cy])=>{const cg=ctx.createRadialGradient(cx-2,cy-2,1,cx,cy,10);cg.addColorStop(0,"rgba(240,200,80,0.3)");cg.addColorStop(1,"rgba(140,100,20,0.1)");ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(180,140,40,0.2)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.stroke()});
  ctx.lineWidth=2.5;for(let i=0;i<4;i++){const sa=i*0.6+0.2,ea=sa+Math.PI*0.8,r=55+i*22;ctx.strokeStyle="rgba(80,55,10,"+(0.15-i*0.02)+")";ctx.beginPath();ctx.arc(258,258,r,sa,ea);ctx.stroke();ctx.strokeStyle="rgba(240,200,80,"+(0.1-i*0.015)+")";ctx.beginPath();ctx.arc(254,254,r,sa,ea);ctx.stroke()}
  const vig=ctx.createRadialGradient(256,256,140,256,256,280);vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(50,30,5,0.3)");ctx.fillStyle=vig;ctx.fillRect(0,0,512,512);
  (PIP_LAYOUTS[num]||[]).forEach(([px,py])=>{const x=256+px*512,y=256+py*512;const os=ctx.createRadialGradient(x+2,y+2,24,x,y,44);os.addColorStop(0,"rgba(0,0,0,0.5)");os.addColorStop(0.6,"rgba(40,25,5,0.2)");os.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=os;ctx.beginPath();ctx.arc(x,y,44,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(220,180,60,0.3)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.fillStyle="#080808";ctx.fill();const inn=ctx.createRadialGradient(x-4,y-4,1,x,y,26);inn.addColorStop(0,"#181510");inn.addColorStop(0.5,"#0a0a08");inn.addColorStop(1,"#030303");ctx.beginPath();ctx.arc(x,y,26,0,Math.PI*2);ctx.fillStyle=inn;ctx.fill();ctx.strokeStyle="rgba(255,220,100,0.25)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-1,31,Math.PI*1.1,Math.PI*1.9);ctx.stroke()});
  return new THREE.CanvasTexture(C);
}

const STICK_MAT=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.8,metalness:0.15});
function createArm(){const a=new THREE.Group();a.add(new THREE.Mesh(new THREE.SphereGeometry(0.045,8,8),STICK_MAT));const u=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.022,0.45,6),STICK_MAT);u.position.y=-0.27;a.add(u);const e=new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8),STICK_MAT);e.position.y=-0.5;a.add(e);const fg=new THREE.Group();fg.position.y=-0.5;const f=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.018,0.4,6),STICK_MAT);f.position.y=-0.22;fg.add(f);const h=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),STICK_MAT);h.position.y=-0.44;fg.add(h);a.add(fg);a.userData.forearm=fg;return a}
function createLeg(){const l=new THREE.Group();l.add(new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),STICK_MAT));const t=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.02,0.35,6),STICK_MAT);t.position.y=-0.2;l.add(t);const k=new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8),STICK_MAT);k.position.y=-0.38;l.add(k);const sg=new THREE.Group();sg.position.y=-0.38;const s=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.016,0.3,6),STICK_MAT);s.position.y=-0.17;sg.add(s);const ft=new THREE.Mesh(new THREE.SphereGeometry(0.03,8,6),STICK_MAT);ft.position.set(0,-0.34,0.015);sg.add(ft);l.add(sg);l.userData.shin=sg;return l}

const SC=0.6,BOUNDS=2.0;
function createDiceChar(tint){const root=new THREE.Group();root.scale.setScalar(SC);const bp=new THREE.Group();root.add(bp);const bg=new THREE.BoxGeometry(1,1,1,8,8,8);const pos=bg.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),len=Math.sqrt(x*x+y*y+z*z);if(len>0.82){const s=0.82/len;pos.setXYZ(i,x*s,y*s,z*s)}}bg.computeVertexNormals();const fv=[2,5,1,6,3,4],mats=fv.map(v=>new THREE.MeshStandardMaterial({map:createPipTexture(v),roughness:0.45,metalness:0.35,emissive:new THREE.Color(tint),emissiveIntensity:0.03}));const body=new THREE.Mesh(bg,mats);body.castShadow=true;body.receiveShadow=true;bp.add(body);const glow=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1),new THREE.MeshBasicMaterial({color:0xD4A017,transparent:true,opacity:0.06,side:THREE.BackSide}));bp.add(glow);const la=createArm();la.position.set(-0.58,0.05,0);la.rotation.z=0.2;bp.add(la);const ra=createArm();ra.position.set(0.58,0.05,0);ra.rotation.z=-0.2;bp.add(ra);const ll=createLeg();ll.position.set(-0.2,-0.52,0);bp.add(ll);const rl=createLeg();rl.position.set(0.2,-0.52,0);bp.add(rl);return{root,bodyPivot:bp,body,glow,leftArm:la,rightArm:ra,leftLeg:ll,rightLeg:rl,wx:(Math.random()-0.5)*3,wz:(Math.random()-0.5)*3,heading:Math.random()*Math.PI*2,targetHeading:Math.random()*Math.PI*2,walkVel:0.5+Math.random()*0.3,nextTurn:1.5+Math.random()*2.5,turnTimer:0,bumpCooldown:0,stepPhase:Math.random()*Math.PI*2,px:0,py:0,pz:0,vx:0,vy:0,vz:0,throwResult:0,throwPhase:null,tumbleAngle:0,tumbleTarget:0,tumbleCount:0,settleStart:0,radius:0.55}}

function faceUpRot(n){return{1:{x:0,z:0},2:{x:0,z:Math.PI/2},3:{x:Math.PI/2,z:0},4:{x:-Math.PI/2,z:0},5:{x:0,z:-Math.PI/2},6:{x:Math.PI,z:0}}[n]}
function collideWalking(chars,dt){for(let i=0;i<chars.length;i++)for(let j=i+1;j<chars.length;j++){const a=chars[i],b=chars[j],dx=b.wx-a.wx,dz=b.wz-a.wz,dist=Math.sqrt(dx*dx+dz*dz);if(dist<1.3&&dist>0.01){const nx=dx/dist,nz=dz/dist,ov=(1.3-dist)/2+0.02;a.wx-=nx*ov;a.wz-=nz*ov;b.wx+=nx*ov;b.wz+=nz*ov;a.targetHeading=Math.atan2(-nx,-nz)+(Math.random()-0.5);b.targetHeading=Math.atan2(nx,nz)+(Math.random()-0.5);a.bumpCooldown=0.3;b.bumpCooldown=0.3;playClack(0.06,500+Math.random()*300)}}}
function collideRolling(chars){for(let i=0;i<chars.length;i++)for(let j=i+1;j<chars.length;j++){const a=chars[i],b=chars[j],dx=b.px-a.px,dz=b.pz-a.pz,dist=Math.sqrt(dx*dx+dz*dz);if(dist<1.3&&dist>0.01){const nx=dx/dist,nz=dz/dist,ov=(1.3-dist)/2;a.px-=nx*ov;a.pz-=nz*ov;b.px+=nx*ov;b.pz+=nz*ov;const rv=a.vx-b.vx,rz=a.vz-b.vz,dot=rv*nx+rz*nz;if(dot>0){const imp=dot*0.5;a.vx-=imp*nx;a.vz-=imp*nz;b.vx+=imp*nx;b.vz+=imp*nz}}}}

// === MAIN SCENE ===
const canvas=document.getElementById("c");
const W=window.innerWidth,H=window.innerHeight;
canvas.width=W;canvas.height=H;

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.setClearColor(0x000000,0);

const scene=new THREE.Scene();

// Camera: LOWER angle, closer - dice feel grounded
const camera=new THREE.PerspectiveCamera(40,W/H,0.1,100);
camera.position.set(0,2.8,4.5);
camera.lookAt(0,-0.5,0);

scene.add(new THREE.AmbientLight(0xffa040,0.5));
const sun=new THREE.DirectionalLight(0xfff0dd,1.5);
sun.position.set(2,7,3);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.near=0.5;sun.shadow.camera.far=25;
sun.shadow.camera.left=-8;sun.shadow.camera.right=8;
sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;
sun.shadow.bias=-0.0005;scene.add(sun);
const p1=new THREE.PointLight(0xff6600,0.4,15);p1.position.set(-4,3,-1);scene.add(p1);
const p2=new THREE.PointLight(0xff9944,0.3,12);p2.position.set(0,2,-5);scene.add(p2);

// Floor: positioned so dice feet touch it naturally
const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:0.3}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.0;floor.receiveShadow=true;scene.add(floor);

// Dust particles
const dustGeo=new THREE.BufferGeometry(),dustArr=new Float32Array(50*3);
for(let i=0;i<50;i++){dustArr[i*3]=(Math.random()-0.5)*10;dustArr[i*3+1]=Math.random()*4;dustArr[i*3+2]=(Math.random()-0.5)*10}
dustGeo.setAttribute("position",new THREE.BufferAttribute(dustArr,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xffcc44,size:0.015,transparent:true,opacity:0.2}));
scene.add(dust);

const tints=[0xD4A017,0xBF8A0C,0xE8B830];
const diceChars=tints.map((tint,i)=>{const d=createDiceChar(tint);d.wx=(i-1)*1.2;d.wz=(Math.random()-0.5)*1.5;d.heading=Math.random()*Math.PI*2;d.targetHeading=d.heading;d.speed=1.2+i*0.08;d.stepPhase=i*2.1;scene.add(d.root);return d});

const FLOOR_Y=-1.0;
const GROUND_Y=FLOOR_Y+(0.52+0.35+0.3+0.34+0.5)*SC;
const FALLEN_Y=FLOOR_Y+0.5*SC;
const IDLE=0,THROWING=1,RESULT=2,STANDUP=3;
let gameState=IDLE,tTime=0,resultShown=false,throwResults=[],throwTotal=0;
let camPos=camera.position.clone(),camLook=new THREE.Vector3(0,-0.3,0);
let camTgtPos=camera.position.clone(),camTgtLook=new THREE.Vector3(0,-0.3,0);

// === THROW FUNCTION (called from RN) ===
window.doThrow=function(){
  if(gameState!==IDLE)return;
  resultShown=false;throwResults=[];
  diceChars.forEach((d,i)=>{
    const r=Math.floor(Math.random()*6)+1;
    d.throwResult=r;d.throwPhase="roll";d.tumbleAngle=0;
    d.tumbleCount=1+Math.floor(Math.random()*2);
    d.tumbleTarget=d.tumbleCount*Math.PI*2;
    d.px=d.wx;d.py=0;d.pz=d.wz;
    d.vx=(i-1)*0.3+(Math.random()-0.5)*0.3;d.vy=0;d.vz=-(0.3+Math.random()*0.2);
    d.drunkWobble=1.5+Math.random()*1.5;d.drunkSway=Math.random()*Math.PI*2;d.lastClackAngle=0;
    throwResults.push(r);
  });
  throwTotal=throwResults.reduce((a,b)=>a+b,0);
  gameState=THROWING;
  playRollStart();startRollLoop();
};

// Also allow tap on canvas to throw
canvas.addEventListener("click",()=>{
  if(gameState===IDLE)window.doThrow();
});

// === ANIMATION LOOP ===
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05);tTime+=dt;const t=tTime;

  // Dust
  const dp=dust.geometry.attributes.position;
  for(let i=0;i<dp.count;i++){let y=dp.getY(i)+dt*0.05;if(y>4)y=0;dp.setY(i,y)}dp.needsUpdate=true;

  if(gameState===IDLE){
    diceChars.forEach(d=>{
      d.turnTimer+=dt;d.bumpCooldown=Math.max(0,d.bumpCooldown-dt);
      if(d.turnTimer>=d.nextTurn){d.turnTimer=0;d.nextTurn=1.5+Math.random()*3;d.targetHeading=d.heading+(Math.random()-0.5)*Math.PI*2}
      let hd=d.targetHeading-d.heading;while(hd>Math.PI)hd-=Math.PI*2;while(hd<-Math.PI)hd+=Math.PI*2;d.heading+=hd*dt*2.5;
      const spd=d.bumpCooldown>0?d.walkVel*0.3:d.walkVel;
      d.wx+=Math.sin(d.heading)*spd*dt;d.wz+=Math.cos(d.heading)*spd*dt;
      const dfc=Math.sqrt(d.wx*d.wx+d.wz*d.wz);
      if(dfc>BOUNDS){d.targetHeading=Math.atan2(-d.wx,-d.wz)+(Math.random()-0.5)*0.5;d.wx=(d.wx/dfc)*BOUNDS;d.wz=(d.wz/dfc)*BOUNDS}
      d.stepPhase+=dt*d.speed*1.2;const sc=d.stepPhase;
      d.root.position.x=d.wx*SC;d.root.position.z=d.wz*SC;d.root.rotation.y=d.heading;
      const bob=-Math.abs(Math.sin(sc))*0.025*SC,lift=Math.max(0,Math.sin(sc*2-0.5))*0.015*SC;
      d.root.position.y=GROUND_Y+bob+lift;d.bodyPivot.rotation.set(0.02,0,Math.sin(sc)*0.05);
      const sw=0.5;d.leftLeg.rotation.x=Math.sin(sc)*sw;d.rightLeg.rotation.x=Math.sin(sc+Math.PI)*sw;
      if(d.leftLeg.userData.shin)d.leftLeg.userData.shin.rotation.x=Math.max(0,Math.sin(sc))*0.6;
      if(d.rightLeg.userData.shin)d.rightLeg.userData.shin.rotation.x=Math.max(0,Math.sin(sc+Math.PI))*0.6;
      d.leftArm.rotation.x=Math.sin(sc+Math.PI)*0.35;d.rightArm.rotation.x=Math.sin(sc)*0.35;
      d.leftArm.rotation.z=0.2;d.rightArm.rotation.z=-0.2;
      if(d.leftArm.userData.forearm)d.leftArm.userData.forearm.rotation.x=-0.3+Math.sin(sc)*0.12;
      if(d.rightArm.userData.forearm)d.rightArm.userData.forearm.rotation.x=-0.3+Math.sin(sc+Math.PI)*0.12;
      d.glow.material.opacity=0.04+Math.sin(t*1.5+d.stepPhase)*0.02;
    });
    collideWalking(diceChars,dt);
    diceChars.forEach(d=>{d.root.position.x=d.wx*SC;d.root.position.z=d.wz*SC});
    const cx=diceChars.reduce((s,d)=>s+d.wx,0)/3*SC,cz=diceChars.reduce((s,d)=>s+d.wz,0)/3*SC;
    camTgtPos.set(cx+Math.sin(t*0.08)*0.3,2.8,cz+4.5);camTgtLook.set(cx,GROUND_Y-0.5,cz);
  }

  if(gameState===THROWING){
    let allDone=true;
    diceChars.forEach((d,i)=>{
      if(d.throwPhase==="roll"){
        allDone=false;const rollDur=1.2,rollSpd=d.tumbleTarget/rollDur;d.tumbleAngle+=rollSpd*dt;
        d.px+=d.vx*dt+Math.sin(t*d.drunkWobble+d.drunkSway)*0.15*dt;d.pz+=d.vz*dt+Math.cos(t*d.drunkWobble*0.7+d.drunkSway)*0.1*dt;
        d.vx*=0.995;d.vz*=0.995;
        const cb=BOUNDS*0.9;d.px=Math.max(-cb,Math.min(cb,d.px));d.pz=Math.max(-cb,Math.min(cb,d.pz));
        d.bodyPivot.rotation.x=d.tumbleAngle;d.bodyPivot.rotation.z=Math.sin(d.tumbleAngle*0.4+d.drunkSway)*0.4+Math.sin(t*d.drunkWobble)*0.15;d.bodyPivot.rotation.y=Math.sin(t*d.drunkWobble*0.5+d.drunkSway)*0.25;
        const cornerLift=Math.abs(Math.sin(d.tumbleAngle*2))*0.15*SC;d.root.position.x=d.px*SC;d.root.position.y=FALLEN_Y+cornerLift;d.root.position.z=d.pz*SC;
        d.leftArm.rotation.x=Math.sin(t*1.5+d.drunkSway)*1.0;d.rightArm.rotation.x=Math.sin(t*1.2+d.drunkSway+2)*1.0;
        d.leftArm.rotation.z=0.5+Math.sin(t*d.drunkWobble)*0.4;d.rightArm.rotation.z=-0.5+Math.sin(t*d.drunkWobble+1)*0.4;
        if(d.leftArm.userData.forearm)d.leftArm.userData.forearm.rotation.x=Math.sin(t*2+d.drunkSway)*0.6;
        if(d.rightArm.userData.forearm)d.rightArm.userData.forearm.rotation.x=Math.sin(t*1.8+d.drunkSway+1)*0.6;
        d.leftLeg.rotation.x=-0.3+Math.sin(t*1.3+d.drunkSway)*0.4;d.rightLeg.rotation.x=-0.3+Math.sin(t*1.1+d.drunkSway+1.5)*0.4;
        if(d.tumbleAngle>=d.tumbleTarget){d.throwPhase="fall";d.settleStart=t;d.px=d.root.position.x/SC;d.pz=d.root.position.z/SC;playThud(0.15+Math.random()*0.1);if(rollNodes)stopRollLoop();playSettleSound()}
        const ci=Math.PI/2,cc=Math.floor(d.tumbleAngle/ci),lc=Math.floor(d.lastClackAngle/ci);if(cc>lc)playClack(0.1+Math.random()*0.15,600+Math.random()*600);d.lastClackAngle=d.tumbleAngle;d.glow.material.opacity=0.1+Math.sin(t*5)*0.03;
      }else if(d.throwPhase==="fall"){
        allDone=false;const el=t-d.settleStart,dur=0.8,p=Math.min(el/dur,1),ease=1-Math.pow(1-p,3),tgt=faceUpRot(d.throwResult);
        d.bodyPivot.rotation.x+=(tgt.x-d.bodyPivot.rotation.x)*ease*0.15;d.bodyPivot.rotation.z+=(tgt.z-d.bodyPivot.rotation.z)*ease*0.15;d.bodyPivot.rotation.y*=(1-ease*0.1);
        const fx=Math.max(-BOUNDS*0.9,Math.min(BOUNDS*0.9,(i-1)*1.8)),fz=Math.max(-BOUNDS*0.5,Math.min(BOUNDS*0.5,d.pz*0.2));
        d.px+=(fx-d.px)*ease*0.1;d.pz+=(fz-d.pz)*ease*0.1;d.root.position.x=d.px*SC;d.root.position.z=d.pz*SC;d.root.position.y+=(FALLEN_Y+0.05-d.root.position.y)*ease*0.1;
        d.leftArm.rotation.x+=(0-d.leftArm.rotation.x)*ease*0.08;d.rightArm.rotation.x+=(0-d.rightArm.rotation.x)*ease*0.08;
        d.leftArm.rotation.z+=(1.0-d.leftArm.rotation.z)*ease*0.08;d.rightArm.rotation.z+=(-1.0-d.rightArm.rotation.z)*ease*0.08;
        d.leftLeg.rotation.x*=(1-ease*0.08);d.rightLeg.rotation.x*=(1-ease*0.08);
        if(p>=1){d.throwPhase="done";d.bodyPivot.rotation.set(tgt.x,0,tgt.z);d.root.position.set(fx*SC,FALLEN_Y+0.05,fz*SC);d.root.rotation.y=0}
        d.glow.material.opacity=0.08+ease*0.04;
      }else if(d.throwPhase==="done"){
        d.root.position.y=FALLEN_Y+0.05+Math.sin(t*2+i*2)*0.005;d.leftArm.rotation.x=Math.sin(t*2+i)*0.08;d.rightArm.rotation.x=Math.sin(t*2+i+1.5)*0.08;
      }
    });
    const rolling=diceChars.filter(d=>d.throwPhase==="roll");
    if(rolling.length>1){collideRolling(rolling);rolling.forEach(d=>{d.root.position.x=d.px*SC;d.root.position.z=d.pz*SC})}
    if(allDone&&!resultShown){
      resultShown=true;
      // Send result to React Native
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"diceResult",results:throwResults,total:throwTotal}));
      gameState=RESULT;
      setTimeout(()=>{
        diceChars.forEach(d=>{d.throwPhase="standup";d.standupStart=tTime;d.wx=d.root.position.x/SC;d.wz=d.root.position.z/SC;d.standupFromRotX=d.bodyPivot.rotation.x;d.standupFromRotZ=d.bodyPivot.rotation.z;d.standupFromY=d.root.position.y});
        gameState=STANDUP;resultShown=false;
      },3000);
    }
    camTgtPos.set(0,4.0,3.5);camTgtLook.set(0,FALLEN_Y,-0.5);
  }

  if(gameState===RESULT){
    diceChars.forEach((d,i)=>{d.root.position.y=FALLEN_Y+0.05+Math.sin(t*2+i*2)*0.005;d.leftArm.rotation.x=Math.sin(t*2+i)*0.08;d.rightArm.rotation.x=Math.sin(t*2+i+1.5)*0.08;d.glow.material.opacity=0.1+Math.sin(t*3+i)*0.03});
    camTgtPos.set(0,4.5,3);camTgtLook.set(0,FALLEN_Y,-0.5);
  }

  if(gameState===STANDUP){
    let allUp=true;
    diceChars.forEach(d=>{
      if(d.throwPhase!=="standup")return;
      const el=t-d.standupStart,dur=1.0,p=Math.min(el/dur,1),ease=1-Math.pow(1-p,3);
      d.bodyPivot.rotation.x+=(0-d.bodyPivot.rotation.x)*ease*0.12;d.bodyPivot.rotation.z+=(0-d.bodyPivot.rotation.z)*ease*0.12;d.bodyPivot.rotation.y*=(1-ease*0.1);
      d.root.position.y+=(GROUND_Y-d.root.position.y)*ease*0.1;
      d.leftArm.rotation.x+=(0-d.leftArm.rotation.x)*ease*0.1;d.rightArm.rotation.x+=(0-d.rightArm.rotation.x)*ease*0.1;
      d.leftArm.rotation.z+=(0.2-d.leftArm.rotation.z)*ease*0.1;d.rightArm.rotation.z+=(-0.2-d.rightArm.rotation.z)*ease*0.1;
      d.leftLeg.rotation.x*=(1-ease*0.1);d.rightLeg.rotation.x*=(1-ease*0.1);
      if(p>=1){d.throwPhase=null;d.bodyPivot.rotation.set(0,0,0);d.root.position.y=GROUND_Y;d.heading=d.root.rotation.y||Math.random()*Math.PI*2;d.targetHeading=d.heading+(Math.random()-0.5)*Math.PI}else{allUp=false}
    });
    if(allUp)gameState=IDLE;
    camTgtPos.set(Math.sin(t*0.08)*0.3,2.8,4.8);camTgtLook.set(0,GROUND_Y-0.5,0);
  }

  camPos.lerp(camTgtPos,dt*3);camLook.lerp(camTgtLook,dt*3);camera.position.copy(camPos);camera.lookAt(camLook);renderer.render(scene,camera);
}
animate();

// Handle resize
window.addEventListener("resize",()=>{const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});
<\/script>
</body></html>
`;
