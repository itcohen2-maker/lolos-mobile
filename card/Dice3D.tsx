// Dice3D.tsx — קוביות תלת-מימד בסגנון זהב
// Three.js 3D dice inside a WebView, bridges to React Native via postMessage

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface Dice3DProps {
  onRollComplete: (values: [number, number, number]) => void;
  disabled: boolean;
}

export default function Dice3D({ onRollComplete, disabled }: Dice3DProps) {
  const webViewRef = useRef<WebView>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if(document.getElementById('rb')) document.getElementById('rb').disabled = ${disabled}; true;`
      );
    }
  }, [disabled]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: DICE_HTML }}
        onLoad={() => {
          loadedRef.current = true;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `if(document.getElementById('rb')) document.getElementById('rb').disabled = ${disabled}; true;`
            );
          }
        }}
        onMessage={(event) => {
          try {
            const values = JSON.parse(event.nativeEvent.data);
            if (Array.isArray(values) && values.length === 3) {
              onRollComplete(values as [number, number, number]);
            }
          } catch {}
        }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 320,
    overflow: 'hidden',
    borderRadius: 16,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f1b33',
  },
});

// ═══════════════════════════════════════════════════════════════
// Full HTML with Three.js 3D golden dice
// Modified: removed title, added RN bridge postMessage
// ═══════════════════════════════════════════════════════════════
const DICE_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#0f1b33;overflow:hidden;font-family:'Segoe UI',Tahoma,sans-serif}
canvas{display:block;width:100%!important;height:100%!important}
#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10}
#results{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:8px}
#results.show{display:flex;animation:fi .5s ease}
.dr{background:linear-gradient(135deg,#FFE566,#FFD700,#DAA520);color:#3D2800;font-size:24px;font-weight:bold;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;box-shadow:0 3px 12px rgba(255,215,0,0.4)}
.ps{color:#FFD700;font-size:18px;font-weight:bold}
.tv{background:linear-gradient(135deg,#FFE566,#FFD700);color:#3D2800;font-size:28px;font-weight:bold;padding:4px 14px;border-radius:10px;box-shadow:0 3px 16px rgba(255,215,0,0.5)}
#rb{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FFE566,#FFD700,#DAA520);color:#3D2800;border:none;padding:11px 36px;font-size:17px;font-weight:bold;border-radius:14px;cursor:pointer;pointer-events:auto;box-shadow:0 5px 25px rgba(255,215,0,0.4),inset 0 1px 0 rgba(255,255,255,0.3);letter-spacing:2px;transition:all .2s}
#rb:disabled{background:linear-gradient(135deg,#666,#444);color:#999;cursor:not-allowed;box-shadow:none}
@keyframes fi{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
</style>
</head>
<body>
<div id="ui">
  <div id="results"></div>
  <button id="rb" disabled>🎲 הטל קוביות</button>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
var AC=null;
function initAC(){if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();}
function noiseBuf(dur){var n=AC.sampleRate*dur,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;return b;}
function swoosh(start,dur){if(!AC)return;var t=AC.currentTime+start;var s=AC.createBufferSource();s.buffer=noiseBuf(dur);var f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(300,t);f.frequency.linearRampToValueAtTime(1800,t+dur*.6);f.frequency.linearRampToValueAtTime(500,t+dur);var g=AC.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.1,t+dur*.3);g.gain.linearRampToValueAtTime(.15,t+dur*.6);g.gain.linearRampToValueAtTime(0,t+dur);s.connect(f);f.connect(g);g.connect(AC.destination);s.start(t);s.stop(t+dur);}
function thud(delay,vol){if(!AC)return;var t=AC.currentTime+delay;var o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(35,t+.15);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.25);var s=AC.createBufferSource();s.buffer=noiseBuf(.03);var g2=AC.createGain();g2.gain.setValueAtTime(vol*.4,t);g2.gain.exponentialRampToValueAtTime(.001,t+.04);s.connect(g2);g2.connect(AC.destination);s.start(t);}
function rollSnd(delay,dur){if(!AC)return;var t=AC.currentTime+delay,taps=Math.floor(dur*14);for(var i=0;i<taps;i++){var tt=t+i*(dur/taps),v=.05*(1-i/taps);var s=AC.createBufferSource();s.buffer=noiseBuf(.012);var g=AC.createGain();g.gain.setValueAtTime(v,tt);g.gain.exponentialRampToValueAtTime(.001,tt+.015);s.connect(g);g.connect(AC.destination);s.start(tt);}}
function chime(delay){if(!AC)return;var t=AC.currentTime+delay;[523,659,784].forEach(function(f,i){var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;var st=t+i*.07;g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(.1,st+.02);g.gain.exponentialRampToValueAtTime(.001,st+.4);o.connect(g);g.connect(AC.destination);o.start(st);o.stop(st+.45);});}

function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}

function tex(val){
  var s=512,cv=document.createElement('canvas');cv.width=s;cv.height=s;
  var c=cv.getContext('2d');
  var g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.65);
  g.addColorStop(0,'#FFF3B0');g.addColorStop(.3,'#FFE566');g.addColorStop(.65,'#FFD700');g.addColorStop(1,'#D4A800');
  c.fillStyle=g;rr(c,12,12,s-24,s-24,44);c.fill();
  c.strokeStyle='rgba(255,255,255,0.25)';c.lineWidth=3;rr(c,18,18,s-36,s-36,40);c.stroke();
  c.strokeStyle='#B8860B';c.lineWidth=3;rr(c,12,12,s-24,s-24,44);c.stroke();
  var dm={1:[[.5,.5]],2:[[.3,.7],[.7,.3]],3:[[.3,.7],[.5,.5],[.7,.3]],4:[[.3,.3],[.7,.3],[.3,.7],[.7,.7]],5:[[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]],6:[[.3,.26],[.7,.26],[.3,.5],[.7,.5],[.3,.74],[.7,.74]]};
  dm[val].forEach(function(p){
    var cx=p[0]*s,cy=p[1]*s,dr=s*.068;
    c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.arc(cx+2,cy+2,dr+1,0,Math.PI*2);c.fill();
    var dg=c.createRadialGradient(cx-2,cy-2,0,cx,cy,dr);dg.addColorStop(0,'#5a3a00');dg.addColorStop(1,'#2a1500');
    c.fillStyle=dg;c.beginPath();c.arc(cx,cy,dr,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(255,255,255,0.12)';c.beginPath();c.arc(cx-dr*.2,cy-dr*.2,dr*.35,0,Math.PI*2);c.fill();
  });
  var t=new THREE.CanvasTexture(cv);t.needsUpdate=true;return t;
}

function eoC(t){return 1-Math.pow(1-t,3)}
function eIQ(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}

var FM=[3,4,1,6,2,5];
var TQ={};
TQ[1]=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,0));
TQ[2]=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
TQ[3]=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.PI/2));
TQ[4]=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-Math.PI/2));
TQ[5]=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
TQ[6]=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI,0,0));

window.addEventListener('load',function(){
  var W=window.innerWidth,H=window.innerHeight;
  var scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0f1b33);
  var cam=new THREE.PerspectiveCamera(55,W/H,.1,100);
  cam.position.set(0,8,4);
  cam.lookAt(0,0,0);
  var ren=new THREE.WebGLRenderer({antialias:true});
  ren.setSize(W,H);
  ren.setPixelRatio(Math.min(window.devicePixelRatio,2));
  ren.shadowMap.enabled=true;
  ren.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.insertBefore(ren.domElement,document.getElementById('ui'));

  scene.add(new THREE.AmbientLight(0xffffff,.5));
  var dl=new THREE.DirectionalLight(0xffffff,.9);
  dl.position.set(2,10,4);dl.castShadow=true;
  dl.shadow.mapSize.set(2048,2048);
  dl.shadow.camera.left=-8;dl.shadow.camera.right=8;
  dl.shadow.camera.top=8;dl.shadow.camera.bottom=-8;
  scene.add(dl);
  var wl=new THREE.PointLight(0xFFD700,.4,18);wl.position.set(-2,5,2);scene.add(wl);
  var rl=new THREE.PointLight(0xFFEEAA,.25,14);rl.position.set(3,3,-2);scene.add(rl);

  var gnd=new THREE.Mesh(
    new THREE.PlaneGeometry(40,40),
    new THREE.MeshStandardMaterial({color:0x141e35,roughness:.92,metalness:.05})
  );
  gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;scene.add(gnd);

  var dice=[];
  for(var i=0;i<3;i++){
    var mats=FM.map(function(v){return new THREE.MeshStandardMaterial({map:tex(v),metalness:.38,roughness:.28})});
    var d=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
    d.castShadow=true;d.receiveShadow=true;
    d.position.set((i-1)*1.5,.5,0);
    scene.add(d);
    dice.push({mesh:d,ss:[3+i*.7,2.5+i*.5,2+i*.8],so:(i*Math.PI*2)/3});
  }

  var sn=120,sg=new THREE.BufferGeometry();
  var sp2=new Float32Array(sn*3),scl=new Float32Array(sn*3);
  for(var j=0;j<sn;j++){sp2[j*3]=(Math.random()-.5)*3;sp2[j*3+1]=Math.random()*3+1;sp2[j*3+2]=(Math.random()-.5)*3;var b=.7+Math.random()*.3;scl[j*3]=b;scl[j*3+1]=b*.85;scl[j*3+2]=b*.3;}
  sg.setAttribute('position',new THREE.BufferAttribute(sp2,3));
  sg.setAttribute('color',new THREE.BufferAttribute(scl,3));
  var spk=new THREE.Points(sg,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(spk);

  var rolling=false;
  (function loop(){requestAnimationFrame(loop);ren.render(scene,cam)})();
  window.addEventListener('resize',function(){
    W=window.innerWidth;H=window.innerHeight;
    cam.aspect=W/H;cam.updateProjectionMatrix();ren.setSize(W,H);
  });

  function showRes(v){
    var el=document.getElementById('results'),tot=v[0]+v[1]+v[2];el.innerHTML='';
    v.forEach(function(val,i){
      var d=document.createElement('span');d.className='dr';d.textContent=val;el.appendChild(d);
      if(i<2){var p=document.createElement('span');p.className='ps';p.textContent='+';el.appendChild(p);}
    });
    var eq=document.createElement('span');eq.className='ps';eq.textContent='=';el.appendChild(eq);
    var t=document.createElement('span');t.className='tv';t.textContent=tot;el.appendChild(t);
    el.className='show';
  }

  document.getElementById('rb').onclick=function(){
    if(rolling)return;rolling=true;initAC();
    var btn=document.getElementById('rb');
    btn.disabled=true;btn.textContent='\\uD83C\\uDFB2 מסתחרר...';
    document.getElementById('results').className='';
    document.getElementById('results').innerHTML='';

    var tv=[Math.ceil(Math.random()*6),Math.ceil(Math.random()*6),Math.ceil(Math.random()*6)];

    var rollCount=1+Math.floor(Math.random()*2);
    var idx=[0,1,2],rollers=[];
    for(var r=0;r<rollCount;r++){var p2=Math.floor(Math.random()*idx.length);rollers.push(idx[p2]);idx.splice(p2,1);}

    var landPos=[];
    for(var i=0;i<3;i++){
      var ang=(i/3)*Math.PI*2+Math.random()*.8-.4;
      var dist=1.2+Math.random()*1.8;
      landPos.push(new THREE.Vector3(Math.cos(ang)*dist,0.5,Math.sin(ang)*dist-.5));
    }
    for(var a=0;a<3;a++)for(var b2=a+1;b2<3;b2++){
      var dx=landPos[a].x-landPos[b2].x,dz=landPos[a].z-landPos[b2].z,dd=Math.sqrt(dx*dx+dz*dz);
      if(dd<1.6){var pu=(1.6-dd)/2,nx=dx/dd*pu,nz=dz/dd*pu;landPos[a].x+=nx;landPos[a].z+=nz;landPos[b2].x-=nx;landPos[b2].z-=nz;}
    }

    var prePos=landPos.map(function(lp,i){
      if(rollers.indexOf(i)>=0){
        var ra=Math.atan2(lp.z,lp.x)+Math.PI+(Math.random()-.5)*.6;
        var rd=1+Math.random()*1;
        return new THREE.Vector3(lp.x+Math.cos(ra)*rd,0.5,lp.z+Math.sin(ra)*rd);
      }
      return lp.clone();
    });

    var tq=tv.map(function(v){
      var yQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.random()*Math.PI*2,0));
      return yQ.multiply(TQ[v].clone());
    });

    var ss=dice.map(function(d){return{pos:d.mesh.position.clone()}});
    var seq=[null,null,null],sep=[null,null,null];
    var throwSpin=dice.map(function(){return new THREE.Vector3((Math.random()-.5)*12,(Math.random()-.5)*6,(Math.random()-.5)*12)});

    var t0=performance.now();
    var T_GATHER=150,T_SWIRL=1800,T_THROW=700,T_SETTLE=200,T_ROLL=1200;
    var TOTAL=T_GATHER+T_SWIRL+T_THROW+T_SETTLE+T_ROLL;

    swoosh(0,T_SWIRL/1000);
    var landT=(T_GATHER+T_SWIRL+T_THROW)/1000;
    for(var i=0;i<3;i++) thud(landT+i*.06,rollers.indexOf(i)>=0?.15:.25);
    rollers.forEach(function(){rollSnd((T_GATHER+T_SWIRL+T_THROW+T_SETTLE)/1000,T_ROLL/1000)});
    chime(TOTAL/1000+.05);

    function anim(now){
      var ms=now-t0,t=Math.min(ms/TOTAL,1);
      var P_G=T_GATHER/TOTAL;
      var P_SW=(T_GATHER+T_SWIRL)/TOTAL;
      var P_TH=(T_GATHER+T_SWIRL+T_THROW)/TOTAL;
      var P_ST=(T_GATHER+T_SWIRL+T_THROW+T_SETTLE)/TOTAL;

      dice.forEach(function(d,i){
        var m=d.mesh;
        var isR=rollers.indexOf(i)>=0;

        if(t<=P_G){
          var p=eIQ(t/P_G);
          m.position.lerpVectors(ss[i].pos,new THREE.Vector3(0,3,0),p);
          m.rotation.x+=.1;m.rotation.y+=.07;
        }else if(t<=P_SW){
          var p=(t-P_G)/(P_SW-P_G),spd=1+p*4;
          var ang=p*Math.PI*12*spd*.2+d.so;
          var rad=(.8+Math.sin(p*Math.PI*2.5)*.4)*(1-p*.4);
          var hgt=3+Math.sin(p*Math.PI*5+i*1.3)*1.2+p*1.5;
          m.position.set(Math.cos(ang)*rad,hgt,Math.sin(ang)*rad);
          m.rotation.x+=d.ss[0]*.055*spd;m.rotation.y+=d.ss[1]*.055*spd;m.rotation.z+=d.ss[2]*.055*spd;
          m.scale.setScalar(1+Math.sin(p*Math.PI*10)*.03);
          if(p>.88){seq[i]=m.quaternion.clone();sep[i]=m.position.clone();}
          spk.material.opacity=.7*Math.sin(p*Math.PI);
          var pos=spk.geometry.attributes.position;
          for(var j=0;j<pos.count;j++){
            var a2=p*Math.PI*9+j*.3,r2=.6+Math.sin(j*.5+p*13)*.7;
            pos.setXYZ(j,Math.cos(a2+j*.25)*r2,2+Math.sin(j*.3+p*11)*2+p*2,Math.sin(a2+j*.25)*r2);
          }
          pos.needsUpdate=true;
          wl.intensity=.4+Math.sin(p*Math.PI*6)*.4;
        }else if(t<=P_TH){
          var p=(t-P_SW)/(P_TH-P_SW),ep=eoC(p);
          var sP=sep[i]||new THREE.Vector3(0,4.5,0);
          var eP=isR?prePos[i]:landPos[i];
          var arcH=Math.max(0,(1-Math.pow(p*1.8-0.5,2))*3.5-0.5);
          m.position.x=THREE.MathUtils.lerp(sP.x,eP.x,ep);
          m.position.z=THREE.MathUtils.lerp(sP.z,eP.z,ep);
          m.position.y=THREE.MathUtils.lerp(sP.y,0.5,ep)+arcH*(1-ep*ep);
          var decay=Math.max(0,1-p*.8);
          m.rotation.x+=throwSpin[i].x*.012*decay;
          m.rotation.y+=throwSpin[i].y*.012*decay;
          m.rotation.z+=throwSpin[i].z*.012*decay;
          if(!isR&&p>.75){var lp3=(p-.75)/.25;m.quaternion.copy(m.quaternion.clone()).slerp(tq[i],lp3*lp3);}
          m.scale.setScalar(1);
          spk.material.opacity=.1*(1-p);
        }else if(t<=P_ST){
          var p=(t-P_TH)/(P_ST-P_TH);
          if(!isR){
            m.position.copy(landPos[i]);m.position.y=0.5;
            m.quaternion.copy(tq[i]);
            var mw=Math.sin(p*Math.PI*3)*Math.exp(-p*5)*.01;
            m.rotation.z+=mw;
          }else{
            m.position.copy(prePos[i]);m.position.y=0.5;
            var tiltQ=tq[i].clone();
            var tiltAxis=new THREE.Vector3().subVectors(landPos[i],prePos[i]).normalize();
            var perpAxis=new THREE.Vector3(-tiltAxis.z,0,tiltAxis.x).normalize();
            var tiltAmt=new THREE.Quaternion().setFromAxisAngle(perpAxis,0.35);
            m.quaternion.copy(tiltAmt.multiply(tiltQ));
          }
          spk.material.opacity=0;wl.intensity=.4;
        }else{
          var p=(t-P_ST)/(1-P_ST);
          if(!isR){
            m.position.copy(landPos[i]);m.position.y=0.5;
            m.quaternion.copy(tq[i]);
          }else{
            var rollP=1-Math.pow(1-p,2.5);
            m.position.x=THREE.MathUtils.lerp(prePos[i].x,landPos[i].x,rollP);
            m.position.z=THREE.MathUtils.lerp(prePos[i].z,landPos[i].z,rollP);
            var dir=new THREE.Vector3().subVectors(landPos[i],prePos[i]);
            var dist=dir.length();
            dir.normalize();
            var rollAxis=new THREE.Vector3(-dir.z,0,dir.x).normalize();
            var rollAng=rollP*dist*Math.PI*1.5;
            var rollQ=new THREE.Quaternion().setFromAxisAngle(rollAxis,rollAng*(1-rollP));
            var blend=p*p*p;
            var cur=tq[i].clone().premultiply(rollQ);
            cur.slerp(tq[i],blend);
            m.quaternion.copy(cur);
            var lift=Math.sin(rollP*Math.PI*3)*.04*(1-rollP);
            m.position.y=0.5+Math.max(0,lift);
          }
        }
      });

      if(t<1){
        requestAnimationFrame(anim);
      }else{
        dice.forEach(function(d,i){
          d.mesh.quaternion.copy(tq[i]);
          d.mesh.position.copy(landPos[i]);d.mesh.position.y=0.5;
          d.mesh.scale.setScalar(1);
        });
        rolling=false;
        showRes(tv);
        // Send values to React Native after brief delay to show results
        setTimeout(function(){
          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify(tv));
          }
        }, 600);
      }
    }
    requestAnimationFrame(anim);
  };
});
<\/script>
</body>
</html>`;
