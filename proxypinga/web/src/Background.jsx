import { useEffect, useMemo, useRef } from 'react';
import { gradientParams } from './theme.js';

const VS = '#version 300 es\nin vec4 a_position;void main(){gl_Position=a_position;}';
const FS = '#version 300 es\nprecision highp float;uniform float u_time;uniform float u_pixelRatio;uniform vec2 u_resolution;uniform float u_scale;uniform float u_rotation;uniform vec4 u_color1;uniform vec4 u_color2;uniform vec4 u_color3;uniform float u_proportion;uniform float u_softness;uniform float u_shape;uniform float u_shapeScale;uniform float u_distortion;uniform float u_swirl;uniform float u_swirlIterations;out vec4 fragColor;\n#define TWO_PI 6.28318530718\n#define PI 3.14159265358979323846\nvec2 rotate(vec2 uv,float th){return mat2(cos(th),sin(th),-sin(th),cos(th))*uv;}float random(vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}float noise(vec2 st){vec2 i=floor(st);vec2 f=fract(st);float a=random(i);float b=random(i+vec2(1.0,0.0));float c=random(i+vec2(0.0,1.0));float d=random(i+vec2(1.0,1.0));vec2 u=f*f*(3.0-2.0*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}vec4 blend_colors(vec4 c1,vec4 c2,vec4 c3,float mixer,float edgesWidth,float edge_blur){vec3 color1=c1.rgb*c1.a;vec3 color2=c2.rgb*c2.a;vec3 color3=c3.rgb*c3.a;float r1=smoothstep(.0+.35*edgesWidth,.7-.35*edgesWidth+.5*edge_blur,mixer);float r2=smoothstep(.3+.35*edgesWidth,1.-.35*edgesWidth+edge_blur,mixer);vec3 b2=mix(color1,color2,r1);float o2=mix(c1.a,c2.a,r1);return vec4(mix(b2,color3,r2),mix(o2,c3.a,r2));}void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;float t=.5*u_time;float noise_scale=.0005+.006*u_scale;uv-=.5;uv*=(noise_scale*u_resolution);uv=rotate(uv,u_rotation*.5*PI);uv/=u_pixelRatio;uv+=.5;float n1=noise(uv*1.+t);float n2=noise(uv*2.-t);float angle=n1*TWO_PI;uv.x+=4.*u_distortion*n2*cos(angle);uv.y+=4.*u_distortion*n2*sin(angle);float it=ceil(clamp(u_swirlIterations,1.,30.));for(float i=1.;i<=it;i++){uv.x+=clamp(u_swirl,0.,2.)/i*cos(t+i*1.5*uv.y);uv.y+=clamp(u_swirl,0.,2.)/i*cos(t+i*1.*uv.x);}float proportion=clamp(u_proportion,0.,1.);float shape=0.;float mixer=0.;if(u_shape<.5){vec2 q=uv*(.5+3.5*u_shapeScale);shape=.5+.5*sin(q.x)*cos(q.y);mixer=shape+.48*sign(proportion-.5)*pow(abs(proportion-.5),.5);}else if(u_shape<1.5){vec2 q=uv*(.25+3.*u_shapeScale);float f=fract(q.y);shape=smoothstep(.0,.55,f)*smoothstep(1.,.45,f);mixer=shape+.48*sign(proportion-.5)*pow(abs(proportion-.5),.5);}else{float sh=1.-uv.y;sh-=.5;sh/=(noise_scale*u_resolution.y);sh+=.5;float ss=.2*(1.-u_shapeScale);shape=smoothstep(.45-ss,.55+ss,sh+.3*(proportion-.5));mixer=shape;}vec4 cm=blend_colors(u_color1,u_color2,u_color3,mixer,1.-clamp(u_softness,0.,1.),.01+.01*u_scale);fragColor=vec4(cm.rgb,cm.a);}';

const hex = (h) => {
  const c = (h || '#000000').replace('#', '');
  return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255, 1];
};

function Gradient({ params }) {
  const ref = useRef(null);
  const live = useRef(params);
  live.current = params;

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return undefined;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['u_time', 'u_resolution', 'u_pixelRatio', 'u_scale', 'u_rotation', 'u_color1', 'u_color2', 'u_color3', 'u_proportion',
      'u_softness', 'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    const start = performance.now();
    let raf;
    const frame = (time) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const p = live.current;
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { canvas.width = Math.round(w * pr); canvas.height = Math.round(h * pr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(U.u_time, (time - start) / 1000 * (p[6] / 100) * 5 + p[11] * 0.01);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(U.u_pixelRatio, pr);
      gl.uniform1f(U.u_scale, p[5]);
      gl.uniform1f(U.u_rotation, p[3] * Math.PI / 180);
      gl.uniform4fv(U.u_color1, hex(p[0]));
      gl.uniform4fv(U.u_color2, hex(p[1]));
      gl.uniform4fv(U.u_color3, hex(p[2]));
      gl.uniform1f(U.u_proportion, p[4] / 100);
      gl.uniform1f(U.u_softness, p[10] / 100);
      gl.uniform1f(U.u_shape, p[12]);
      gl.uniform1f(U.u_shapeScale, p[13] / 100);
      gl.uniform1f(U.u_distortion, p[7] / 50);
      gl.uniform1f(U.u_swirl, p[8] / 100);
      gl.uniform1f(U.u_swirlIterations, p[8] === 0 ? 0 : p[9]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="pp-fade bg-fill" aria-hidden="true" />;
}

function Waves() {
  const paths = useMemo(() => {
    const out = [];
    [1, -1].forEach((pos) => {
      for (let i = 0; i < 36; i++) {
        const a = 380 - i * 5 * pos, b = 312 - i * 5 * pos, c = 152 - i * 5 * pos, e = 616 - i * 5 * pos, f = 684 - i * 5 * pos;
        out.push({
          d: `M-${a} -${189 + i * 6}C-${a} -${189 + i * 6} -${b} ${216 - i * 6} ${c} ${343 - i * 6}C${e} ${470 - i * 6} ${f} ${875 - i * 6} ${f} ${875 - i * 6}`,
          w: (0.5 + i * 0.03).toFixed(2),
          op: Math.min(1, 0.1 + i * 0.03) * 0.55,
          dur: 20 + ((i * 37 + (pos > 0 ? 3 : 7)) % 10),
        });
      }
    });
    return out;
  }, []);
  return (
    <svg className="pp-wave pp-fade bg-fill" viewBox="0 0 696 316" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      {paths.map((w, i) => (
        <path key={i} d={w.d} pathLength="1" stroke="var(--on)" strokeWidth={w.w} strokeOpacity={w.op} style={{ animationDuration: w.dur + 's' }} />
      ))}
    </svg>
  );
}

export default function Background({ s }) {
  return (
    <>
      {s.bgMode === 0 && <Gradient params={gradientParams(s)} />}
      {s.bgMode === 1 && <Waves />}
      {s.bgMode === 3 && s.img && <img src={s.img} alt="" className="pp-fade bg-fill" style={{ objectFit: 'cover' }} />}
      <div aria-hidden="true" className="bg-fill pp-t" style={{ background: 'var(--bg)', opacity: s.dim / 100 }} />
    </>
  );
}
