import React, { useRef, useCallback } from 'react';
import { View, TouchableOpacity, Animated, Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { HtmlCanvasEmbed } from './HtmlCanvasEmbed';

export interface LulosButtonProps {
  text: string;
  color: 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'orange';
  onPress: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  /** Override text color (e.g. '#FFFFFF' for white on dark yellow button) */
  textColor?: string;
  style?: any;
}

const PALETTES = {
  green: {
    s1: '#143824', s2: '#1C4C30', s3: '#245C3C', s4: '#2D6B48',
    hi: 'rgba(80,160,100,', sym: '#3A8855', symhi: '#6ABB80',
    twinkle: 'rgba(220,255,230,0.5)', twinkleGlow: 'rgba(100,210,140,0)',
    text: { fill: '#F0E8C0', stroke: 'rgba(0,60,20,0.5)', shadow: 'rgba(0,40,10,0.7)' },
    rnShadow: '#0a2a18',
  },
  red: {
    // Google red family (#EA4335) with darker rim shades
    s1: '#8B1A12', s2: '#A5271C', s3: '#DC4736', s4: '#EA4335',
    hi: 'rgba(234,67,53,', sym: '#B3261E', symhi: '#DC4736',
    twinkle: 'rgba(255,170,170,0.5)', twinkleGlow: 'rgba(234,67,53,0)',
    text: { fill: '#FFD0CC', stroke: 'rgba(100,10,5,0.5)', shadow: 'rgba(60,5,0,0.7)' },
    rnShadow: '#8B1A12',
  },
  blue: {
    s1: '#060E2A', s2: '#0E1A42', s3: '#12245C', s4: '#1A2E6B',
    hi: 'rgba(60,100,200,', sym: '#223388', symhi: '#5577CC',
    twinkle: 'rgba(200,220,255,0.5)', twinkleGlow: 'rgba(80,120,210,0)',
    text: { fill: '#D0E0FF', stroke: 'rgba(10,20,80,0.5)', shadow: 'rgba(5,10,50,0.7)' },
    rnShadow: '#060e2a',
  },
  yellow: {
    s1: '#2A1A00', s2: '#3D2600', s3: '#523300', s4: '#664200',
    hi: 'rgba(200,140,20,', sym: '#886622', symhi: '#CCAA33',
    twinkle: 'rgba(255,240,180,0.5)', twinkleGlow: 'rgba(210,160,30,0)',
    text: { fill: '#FFFFFF', stroke: 'rgba(80,50,0,0.55)', shadow: 'rgba(40,20,0,0.7)' },
    rnShadow: '#2a1a00',
  },
  orange: {
    s1: '#3A1400', s2: '#5A2200', s3: '#7A3300', s4: '#A34705',
    hi: 'rgba(255,145,40,', sym: '#B85A16', symhi: '#F08C3A',
    twinkle: 'rgba(255,210,170,0.52)', twinkleGlow: 'rgba(255,140,40,0)',
    text: { fill: '#FFFFFF', stroke: 'rgba(80,30,5,0.2)', shadow: 'rgba(40,10,0,0.45)' },
    rnShadow: '#4a1c00',
  },
  purple: {
    s1: '#1A0028', s2: '#2A0042', s3: '#3A005C', s4: '#4A0A6B',
    hi: 'rgba(140,60,200,', sym: '#5522AA', symhi: '#8855CC',
    twinkle: 'rgba(230,210,255,0.5)', twinkleGlow: 'rgba(140,80,210,0)',
    text: { fill: '#E8D0FF', stroke: 'rgba(50,0,80,0.5)', shadow: 'rgba(30,0,50,0.7)' },
    rnShadow: '#1a0028',
  },
};

function buildHTML(text: string, color: keyof typeof PALETTES, w: number, h: number, fs: number, textFillOverride?: string): string {
  const p = PALETTES[color];
  const textFill = textFillOverride ?? p.text.fill;
  const escaped = text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // For JS string inside HTML (newline as \n so runtime string has real newline for multiline)
  const jsEscaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block}</style></head><body><canvas id="c"></canvas><script>
var cv=document.getElementById("c"),x=cv.getContext("2d");
var W=${w},H=${h},FS=${fs};
var dpr=Math.min(window.devicePixelRatio||1,2);
cv.width=W*dpr;cv.height=H*dpr;
cv.style.width=W+"px";cv.style.height=H+"px";

function pp(c,x1,y1,w1,h1){
var pr=h1/2;
c.beginPath();
c.moveTo(x1+pr,y1);
c.lineTo(x1+w1-pr,y1);
c.arc(x1+w1-pr,y1+pr,pr,-Math.PI/2,Math.PI/2);
c.lineTo(x1+pr,y1+h1);
c.arc(x1+pr,y1+pr,pr,Math.PI/2,-Math.PI/2);
c.closePath();
}

// Pre-render background
var bg=document.createElement("canvas");
bg.width=W*dpr;bg.height=H*dpr;
var b=bg.getContext("2d");b.scale(dpr,dpr);
var pad=1;

// Bottom shadow stack
pp(b,0,3,W,H-1);b.fillStyle="#3A2504";b.fill();
pp(b,0,2,W,H-1);b.fillStyle="#6B4A08";b.fill();
pp(b,0,1,W,H);b.fillStyle="#8A6010";b.fill();

// Gold rim gradient
pp(b,1,1,W-2,H-2);
var gr=b.createLinearGradient(0,0,W,H);
gr.addColorStop(0,"#FFF0A0");gr.addColorStop(0.15,"#F5D45A");
gr.addColorStop(0.35,"#E8BC28");gr.addColorStop(0.55,"#D4A010");
gr.addColorStop(0.75,"#C09018");gr.addColorStop(0.9,"#E8C030");
gr.addColorStop(1,"#F5D860");
b.fillStyle=gr;b.fill();

// Specular on rim
b.save();pp(b,1,1,W-2,H-2);b.clip();
var rs=b.createRadialGradient(W*0.25,H*0.15,1,W*0.3,H*0.2,W*0.3);
rs.addColorStop(0,"rgba(255,255,220,0.45)");
rs.addColorStop(0.5,"rgba(255,240,160,0.12)");
rs.addColorStop(1,"rgba(255,220,80,0)");
b.fillStyle=rs;b.fillRect(0,0,W,H);b.restore();

// Inner dark ring
pp(b,pad+2,pad+2,W-pad*2-4,H-pad*2-5);
b.fillStyle="#0A1A0E";b.fill();

// Felt surface
var fp=pad+3,fr=Math.max(H/2-6,4);
pp(b,fp,fp,W-fp*2,H-fp*2-2);
var felt=b.createRadialGradient(W*0.4,H*0.35,4,W*0.5,H*0.5,W*0.4);
felt.addColorStop(0,"${p.s4}");
felt.addColorStop(0.3,"${p.s3}");
felt.addColorStop(0.6,"${p.s2}");
felt.addColorStop(1,"${p.s1}");
b.fillStyle=felt;b.fill();

b.save();pp(b,fp,fp,W-fp*2,H-fp*2-2);b.clip();

// Felt noise
for(var ni=0;ni<2500;ni++){
var rx=Math.random();
b.fillStyle=rx>0.72?"${p.hi}"+Math.random()*0.06+")":rx>0.44?"rgba(20,20,20,"+Math.random()*0.08+")":"rgba(0,0,0,"+Math.random()*0.07+")";
b.fillRect(Math.random()*W,Math.random()*H,1,1);
}

// Card suit symbols
var syms=["\\u2660","\\u2665","\\u2666","\\u2663"];
b.font="bold 7px Arial";b.textAlign="center";b.textBaseline="middle";
var ts=12;
for(var ty=fp+3;ty<H-fp;ty+=ts){
for(var tx=fp+3;tx<W-fp;tx+=ts){
var sym=syms[Math.floor((tx/ts+ty/ts*2))%4];
if(sym==="\\u2665"||sym==="\\u2666"){b.globalAlpha=0.08;b.fillStyle="${p.symhi}";}
else{b.globalAlpha=0.06;b.fillStyle="${p.sym}";}
b.fillText(sym,tx,ty);
}}
b.globalAlpha=1;

// Center glow
var ch=b.createRadialGradient(W*0.5,H*0.35,2,W*0.5,H*0.4,W*0.25);
ch.addColorStop(0,"${p.hi}0.1)");ch.addColorStop(1,"rgba(0,0,0,0)");
b.fillStyle=ch;b.fillRect(0,0,W,H);

// Vignette
var ev=b.createRadialGradient(W*0.5,H*0.5,W*0.15,W*0.5,H*0.5,W*0.45);
ev.addColorStop(0,"rgba(0,0,0,0)");ev.addColorStop(0.6,"rgba(0,0,0,0)");
ev.addColorStop(1,"rgba(0,0,0,0.3)");
b.fillStyle=ev;b.fillRect(0,0,W,H);
b.restore();

// Rim strokes
pp(b,fp,fp,W-fp*2,H-fp*2-2);
b.strokeStyle="${p.hi}0.2)";b.lineWidth=0.6;b.stroke();
pp(b,pad+3,pad+3,W-pad*2-6,H-pad*2-8);
b.strokeStyle="rgba(0,0,0,0.4)";b.lineWidth=1.2;b.stroke();
pp(b,1.5,1.5,W-3,H-6);
b.strokeStyle="rgba(255,248,180,0.25)";b.lineWidth=0.8;b.stroke();

// Pre-render text onto bg (support multiline: split by \\n)
b.textAlign="center";b.textBaseline="middle";
b.font="900 "+FS+"px system-ui,sans-serif";
var tx2=W/2,ty2=H/2-1;
var textStr="${jsEscaped}";
var textLines=textStr.split("\\n");
var lineHeight=FS*1.25;
var totalTextH=(textLines.length-1)*lineHeight;
var startY=ty2-totalTextH/2;
for(var li=0;li<textLines.length;li++){
var ly=startY+li*lineHeight;
b.fillStyle="${p.text.shadow}";b.fillText(textLines[li],tx2+1,ly+2);
b.strokeStyle="${p.text.stroke}";b.lineWidth=3;b.strokeText(textLines[li],tx2,ly);
b.fillStyle="${textFill}";b.fillText(textLines[li],tx2,ly);
}

// Twinkle positions
var twinkles=[];
var twCount=Math.round((W*H)/1100);
for(var ti=0;ti<twCount;ti++){
twinkles.push({x:fp+4+Math.random()*(W-fp*2-8),y:fp+2+Math.random()*(H-fp*2-6),
phase:Math.random()*Math.PI*2,speed:0.8+Math.random()*1.4,size:0.4+Math.random()*0.9});
}

var t=0;
function loop(){
requestAnimationFrame(loop);
t+=1/60;
x.clearRect(0,0,cv.width,cv.height);
x.save();x.scale(dpr,dpr);

// Drop shadow
x.save();
pp(x,3,4,W-6,H-4);
x.shadowColor="rgba(0,15,8,0.6)";x.shadowBlur=14;x.shadowOffsetY=5;
x.fillStyle="rgba(0,0,0,0)";x.fill();
x.restore();

// Background
x.drawImage(bg,0,0,W*dpr,H*dpr,0,0,W,H);

// Animated twinkles
x.save();
pp(x,fp,fp,W-fp*2,H-fp*2-2);x.clip();
for(var i=0;i<twinkles.length;i++){
var tw=twinkles[i];
var a=Math.pow(Math.max(0,Math.sin(t*tw.speed+tw.phase)),3);
if(a<0.04)continue;
var sz=tw.size*(1+a*0.5);
x.save();x.translate(tw.x,tw.y);x.globalAlpha=a*0.65;
var g2=x.createRadialGradient(0,0,0,0,0,sz*4);
g2.addColorStop(0,"${p.twinkle}");g2.addColorStop(1,"${p.twinkleGlow}");
x.fillStyle=g2;x.beginPath();x.arc(0,0,sz*4,0,Math.PI*2);x.fill();
x.fillStyle="rgba(240,255,245,"+(a*0.8)+")";
x.beginPath();
for(var si=0;si<8;si++){var ang=si*Math.PI/4;var r2=si%2===0?sz*2.5:sz*0.6;
si===0?x.moveTo(Math.cos(ang)*r2,Math.sin(ang)*r2):x.lineTo(Math.cos(ang)*r2,Math.sin(ang)*r2);}
x.closePath();x.fill();x.restore();
}
x.restore();

// Glass gloss
x.save();
pp(x,3,3,W-6,H-8);x.clip();
var glo=x.createLinearGradient(0,3,0,H*0.48);
glo.addColorStop(0,"rgba(255,255,255,0.15)");
glo.addColorStop(0.5,"rgba(200,240,210,0.06)");
glo.addColorStop(1,"rgba(100,180,120,0)");
x.beginPath();x.ellipse(W/2,H*0.18,W*0.42,H*0.28,0,0,Math.PI*2);
x.fillStyle=glo;x.fill();
x.restore();

x.restore();
}
loop();
<\/script></body></html>`;
}

export function LulosButton({ text, color, onPress, disabled, width, height = 68, fontSize, textColor, style }: LulosButtonProps) {
  const fs = fontSize ?? Math.round(height * 0.38);
  const w = width ?? Math.max(140, Math.min(300, text.length * fs * 0.6 + 80));
  const palette = PALETTES[color];

  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, []);

  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  const html = buildHTML(text, color, w, height, fs, textColor);

  return (
    <View style={[{ width: w, height: height + 8, opacity: disabled ? 0.3 : 1 }, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
      >
        <Animated.View style={[
          {
            width: w,
            height,
            borderRadius: height / 2,
            transform: [{ translateY }],
            ...Platform.select({
              ios: {
                shadowColor: palette.rnShadow,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
              },
              android: { elevation: 8 },
            }),
          },
        ]}>
          {Platform.OS === 'web' ? (
            <HtmlCanvasEmbed
              key={text + color + w + height + (textColor ?? '')}
              html={html}
              style={[btnStyles.webview, { borderRadius: height / 2 }]}
              borderRadius={height / 2}
              pointerEvents="none"
            />
          ) : (
            <WebView
              key={text + color + w + height + (textColor ?? '')}
              source={{ html }}
              style={[btnStyles.webview, { borderRadius: height / 2 }]}
              scrollEnabled={false}
              bounces={false}
              pointerEvents="none"
              javaScriptEnabled={true}
              originWhitelist={['*']}
              transparent={true}
              androidLayerType="hardware"
            />
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const btnStyles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
