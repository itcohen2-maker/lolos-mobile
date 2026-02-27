import React, { useRef, useCallback } from 'react';
import { View, Pressable, Animated, Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LulosButtonProps {
  text: string;
  color: 'blue' | 'yellow' | 'green' | 'red';
  onPress: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  style?: any;
}

const PALETTES = {
  blue: {
    grad: ['#4A90D9', '#2B5EA7'],
    overlay: ['rgba(100,160,230,0.18)', 'rgba(30,70,140,0.22)'],
    grain: { light: 'rgba(130,180,240,0.07)', mid: 'rgba(60,110,190,0.08)', dark: 'rgba(20,50,120,0.06)' },
    vignette: 'rgba(15,40,100,0.25)',
    bevel: 'rgba(160,210,255,0.25)',
    bottom: 'rgba(15,35,80,0.18)',
    borderOuter: 'rgba(100,170,240,0.5)',
    borderInner: 'rgba(20,50,110,0.6)',
    text: { fill: '#FFFFFF', stroke: 'rgba(20,50,120,0.5)', shadow: 'rgba(10,30,80,0.6)' },
    rnShadow: '#1a3a7a',
  },
  yellow: {
    grad: ['#F5D26B', '#C49A1A'],
    overlay: ['rgba(255,220,100,0.15)', 'rgba(160,110,10,0.2)'],
    grain: { light: 'rgba(255,220,120,0.07)', mid: 'rgba(180,130,40,0.09)', dark: 'rgba(100,65,15,0.08)' },
    vignette: 'rgba(80,50,5,0.22)',
    bevel: 'rgba(255,240,180,0.3)',
    bottom: 'rgba(80,50,0,0.15)',
    borderOuter: 'rgba(240,210,100,0.5)',
    borderInner: 'rgba(120,80,10,0.6)',
    text: { fill: '#1a1510', stroke: 'rgba(180,140,30,0.4)', shadow: 'rgba(80,50,0,0.5)' },
    rnShadow: '#8a6a0a',
  },
  green: {
    grad: ['#4CAF50', '#2E7D32'],
    overlay: ['rgba(100,220,110,0.15)', 'rgba(30,90,35,0.2)'],
    grain: { light: 'rgba(130,230,140,0.07)', mid: 'rgba(50,140,55,0.08)', dark: 'rgba(15,60,20,0.06)' },
    vignette: 'rgba(10,50,15,0.22)',
    bevel: 'rgba(160,255,170,0.25)',
    bottom: 'rgba(10,40,12,0.18)',
    borderOuter: 'rgba(100,220,110,0.5)',
    borderInner: 'rgba(20,70,25,0.6)',
    text: { fill: '#FFFFFF', stroke: 'rgba(20,70,25,0.5)', shadow: 'rgba(5,35,10,0.6)' },
    rnShadow: '#1a5a1e',
  },
  red: {
    grad: ['#E05545', '#B71C1C'],
    overlay: ['rgba(240,120,100,0.15)', 'rgba(140,20,20,0.2)'],
    grain: { light: 'rgba(250,150,130,0.07)', mid: 'rgba(180,60,50,0.08)', dark: 'rgba(100,15,10,0.06)' },
    vignette: 'rgba(80,10,5,0.22)',
    bevel: 'rgba(255,180,170,0.25)',
    bottom: 'rgba(60,5,0,0.18)',
    borderOuter: 'rgba(240,120,100,0.5)',
    borderInner: 'rgba(100,15,10,0.6)',
    text: { fill: '#FFFFFF', stroke: 'rgba(100,15,10,0.5)', shadow: 'rgba(50,5,0,0.6)' },
    rnShadow: '#7a1010',
  },
};

function buildHTML(text: string, color: keyof typeof PALETTES, w: number, h: number, fs: number): string {
  const p = PALETTES[color];
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block}</style></head><body><canvas id="c"></canvas><script>
var c=document.getElementById("c"),x=c.getContext("2d");
var W=${w},H=${h},FS=${fs};
var dpr=window.devicePixelRatio||1;
c.width=W*dpr;c.height=H*dpr;
c.style.width=W+"px";c.style.height=H+"px";
x.scale(dpr,dpr);
var r=14;
function rr(x1,y1,w,h,r){x.beginPath();x.moveTo(x1+r,y1);x.lineTo(x1+w-r,y1);x.quadraticCurveTo(x1+w,y1,x1+w,y1+r);x.lineTo(x1+w,y1+h-r);x.quadraticCurveTo(x1+w,y1+h,x1+w-r,y1+h);x.lineTo(x1+r,y1+h);x.quadraticCurveTo(x1,y1+h,x1,y1+h-r);x.lineTo(x1,y1+r);x.quadraticCurveTo(x1,y1,x1+r,y1);x.closePath()}
// 1. Radial gradient bg
var g=x.createRadialGradient(W*0.35,H*0.3,W*0.1,W*0.6,H*0.65,W*0.9);
g.addColorStop(0,"${p.grad[0]}");g.addColorStop(1,"${p.grad[1]}");
rr(0,0,W,H,r);x.fillStyle=g;x.fill();
// 2. Diagonal overlay
var o=x.createLinearGradient(0,0,W,H);
o.addColorStop(0,"${p.overlay[0]}");o.addColorStop(1,"${p.overlay[1]}");
rr(0,0,W,H,r);x.fillStyle=o;x.fill();
// 3. Grain
rr(0,0,W,H,r);x.save();x.clip();
for(var i=0;i<5000;i++){var rn=Math.random();x.fillStyle=rn>0.7?"${p.grain.light}":rn>0.35?"${p.grain.mid}":"${p.grain.dark}";x.fillRect(Math.random()*W,Math.random()*H,Math.random()>0.7?2:1,1)}
x.restore();
// 4. Vignette
var v=x.createRadialGradient(W*0.45,H*0.4,W*0.2,W*0.5,H*0.5,W*0.7);
v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(0.6,"rgba(0,0,0,0)");
v.addColorStop(1,"${p.vignette}");
rr(0,0,W,H,r);x.fillStyle=v;x.fill();
// 5. Top bevel
rr(0,0,W,H,r);x.save();x.clip();
var b=x.createLinearGradient(0,0,0,H*0.4);
b.addColorStop(0,"${p.bevel}");b.addColorStop(1,"rgba(0,0,0,0)");
x.fillStyle=b;x.fillRect(0,0,W,H*0.4);
x.restore();
// 6. Bottom darken
rr(0,0,W,H,r);x.save();x.clip();
var d=x.createLinearGradient(0,H*0.65,0,H);
d.addColorStop(0,"rgba(0,0,0,0)");d.addColorStop(1,"${p.bottom}");
x.fillStyle=d;x.fillRect(0,H*0.65,W,H*0.35);
x.restore();
// 7. Borders
rr(1,1,W-2,H-2,r);x.strokeStyle="${p.borderOuter}";x.lineWidth=2;x.stroke();
rr(3,3,W-6,H-6,r);x.strokeStyle="${p.borderInner}";x.lineWidth=1;x.stroke();
// 8. Text
x.textAlign="center";x.textBaseline="middle";
x.font="800 "+FS+"px 'Fredoka',system-ui,sans-serif";
var tx=W/2,ty=H/2;
x.fillStyle="${p.text.shadow}";x.fillText("${text.replace(/"/g, '\\"')}",tx+1,ty+2);
x.strokeStyle="${p.text.stroke}";x.lineWidth=3;x.strokeText("${text.replace(/"/g, '\\"')}",tx,ty);
x.fillStyle="${p.text.fill}";x.fillText("${text.replace(/"/g, '\\"')}",tx,ty);
<\/script></body></html>`;
}

export function LulosButton({ text, color, onPress, disabled, width, height = 68, fontSize, style }: LulosButtonProps) {
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

  const html = buildHTML(text, color, w, height, fs);

  return (
    <View style={[{ width: w, height: height + 8, opacity: disabled ? 0.3 : 1 }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
      >
        <Animated.View style={[
          {
            width: w,
            height,
            borderRadius: 14,
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
          <WebView
            key={text + color + w}
            source={{ html }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            pointerEvents="none"
            javaScriptEnabled={true}
            originWhitelist={['*']}
            transparent={true}
            androidLayerType="hardware"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 14,
    overflow: 'hidden',
  },
});
