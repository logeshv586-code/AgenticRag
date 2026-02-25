import { useEffect, useRef } from 'react';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect } from 'postprocessing';
import * as THREE from 'three';
import * as faceapi from 'face-api.js';
import './GridScan.css';

const vert = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const frag = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uSkew;
uniform float uTilt;
uniform float uYaw;
uniform float uLineThickness;
uniform vec3 uLinesColor;
uniform vec3 uScanColor;
uniform float uGridScale;
uniform float uLineStyle;
uniform float uLineJitter;
uniform float uScanOpacity;
uniform float uScanDirection;
uniform float uNoise;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uPhaseTaper;
uniform float uScanDuration;
uniform float uScanDelay;
varying vec2 vUv;

float smoother01(float a, float b, float x){
  float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main(){
  vec2 uv = vUv;
  vec2 res = iResolution.xy;
  vec2 p = (2.0 * uv * res - res) / res.y;
  vec3 ro = vec3(0.0);
  vec3 rd = normalize(vec3(p, 2.0));
  float cR = cos(uTilt), sR = sin(uTilt);
  rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;
  float cY = cos(uYaw), sY = sin(uYaw);
  rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;
  vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
  rd.xy += skew * rd.z;

  float gridScale = max(1e-5, uGridScale);
  vec2 g = p / gridScale;
  if (uLineJitter > 0.0) {
    vec2 j = vec2(
      sin(g.y * 2.7 + iTime * 1.8),
      cos(g.x * 2.3 - iTime * 1.6)
    ) * (0.15 * uLineJitter);
    g += j;
  }
  float fx = fract(g.x);
  float fy = fract(g.y);
  float ax = min(fx, 1.0 - fx);
  float ay = min(fy, 1.0 - fy);
  float wx = fwidth(g.x);
  float wy = fwidth(g.y);
  float halfPx = max(0.0, uLineThickness) * 0.5;
  float tx = halfPx * wx;
  float ty = halfPx * wy;
  float aax = wx;
  float aay = wy;
  float lineX = 1.0 - smoothstep(tx, tx + aax, ax);
  float lineY = 1.0 - smoothstep(ty, ty + aay, ay);
  if (uLineStyle > 0.5) {
    float dashRepeat = 4.0;
    float dashDuty = 0.5;
    float vy = fract(g.y * dashRepeat);
    float vx = fract(g.x * dashRepeat);
    float dashMaskY = step(vy, dashDuty);
    float dashMaskX = step(vx, dashDuty);
    if (uLineStyle < 1.5) {
      lineX *= dashMaskY;
      lineY *= dashMaskX;
    } else {
      float dotRepeat = 6.0;
      float dotWidth = 0.18;
      float cy = abs(fract(g.y * dotRepeat) - 0.5);
      float cx = abs(fract(g.x * dotRepeat) - 0.5);
      float dotMaskY = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(g.y * dotRepeat), cy);
      float dotMaskX = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(g.x * dotRepeat), cx);
      lineX *= dotMaskY;
      lineY *= dotMaskX;
    }
  }
  float primaryMask = max(lineX, lineY);
  vec3 gridCol = uLinesColor * primaryMask;

  float dir = uScanDirection;
  float tCycle = uScanDuration + uScanDelay;
  float t = mod(iTime, tCycle);
  float phase = clamp((t - uScanDelay) / max(1e-4, uScanDuration), 0.0, 1.0);
  float xPos = mix(-1.0, 1.0, dir < 0.5 ? phase : (dir < 1.5 ? 1.0 - phase : (phase < 0.5 ? phase * 2.0 : 2.0 - phase * 2.0)));
  float scanBand = 1.0 - smoothstep(0.0, uScanSoftness, abs(uv.x * 2.0 - 1.0 - xPos));
  vec3 scanCol = uScanColor * (uScanGlow * scanBand);
  float scanAlpha = uScanOpacity * scanBand;

  float noise = uNoise * (fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453));
  vec3 col = gridCol + scanCol;
  col += noise;
  gl_FragColor = vec4(col, clamp(primaryMask + scanAlpha, 0.0, 1.0));
}
`;

function toVec3(color) {
  const c = new THREE.Color(color);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const GridScan = ({
  enableWebcam = false,
  showPreview = false,
  modelsPath = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/models',
  sensitivity = 0.55,
  lineThickness = 1,
  linesColor = '#392e4e',
  gridScale = 0.1,
  lineStyle = 'solid',
  lineJitter = 0.1,
  enablePost = true,
  bloomIntensity = 0.6,
  bloomThreshold = 0.0,
  bloomSmoothing = 0.0,
  chromaticAberration = 0.002,
  noiseIntensity = 0.01,
  scanColor = '#FF9FFC',
  scanOpacity = 0.4,
  scanDirection = 'pingpong',
  scanSoftness = 2,
  scanGlow = 0.5,
  scanPhaseTaper = 0.9,
  scanDuration = 2.0,
  scanDelay = 2.0,
  className = '',
  style = {}
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvasRef.current });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      iResolution: { value: new THREE.Vector3(width, height, 1) },
      iTime: { value: 0 },
      uSkew: { value: new THREE.Vector2(0, 0) },
      uTilt: { value: 0 },
      uYaw: { value: 0 },
      uLineThickness: { value: lineThickness },
      uLinesColor: { value: toVec3(linesColor) },
      uScanColor: { value: toVec3(scanColor) },
      uGridScale: { value: gridScale },
      uLineStyle: { value: lineStyle === 'solid' ? 0.0 : lineStyle === 'dashed' ? 1.0 : 2.0 },
      uLineJitter: { value: lineJitter },
      uScanOpacity: { value: scanOpacity },
      uScanDirection: { value: scanDirection === 'forward' ? 0.0 : scanDirection === 'backward' ? 1.0 : 2.0 },
      uNoise: { value: noiseIntensity },
      uScanGlow: { value: scanGlow },
      uScanSoftness: { value: scanSoftness / 100.0 },
      uPhaseTaper: { value: scanPhaseTaper },
      uScanDuration: { value: scanDuration },
      uScanDelay: { value: scanDelay }
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let composer;
    if (enablePost) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new BloomEffect({ intensity: bloomIntensity, threshold: bloomThreshold, smoothing: bloomSmoothing });
      const ca = new ChromaticAberrationEffect(chromaticAberration);
      const effectPass = new EffectPass(camera, bloom, ca);
      composer.addPass(effectPass);
      composerRef.current = composer;
    }

    let stop = false;
    let start = performance.now();
    function animate() {
      if (stop) return;
      const now = performance.now();
      uniforms.iTime.value = (now - start) / 1000.0;
      if (composer) composer.render();
      else renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    function onPointerMove(e) {
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const dx = (mx - 0.5) * 2.0;
      const dy = (my - 0.5) * 2.0;
      uniforms.uSkew.value.set(dx * sensitivity, dy * sensitivity);
    }
    container.addEventListener('pointermove', onPointerMove);

    if (enableWebcam) {
      faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath).catch(() => {});
      if (showPreview && navigator.mediaDevices && videoRef.current) {
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { void 0; });
          } catch { void 0; }
        }).catch(() => { void 0; });
      }
    }

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.iResolution.value.set(w, h, 1);
    }
    window.addEventListener('resize', onResize);
    return () => {
      stop = true;
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointermove', onPointerMove);
      composer && composer.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    };
  }, [
    lineThickness,
    linesColor,
    gridScale,
    lineStyle,
    lineJitter,
    enablePost,
    bloomIntensity,
    bloomThreshold,
    bloomSmoothing,
    chromaticAberration,
    noiseIntensity,
    scanColor,
    scanOpacity,
    scanDirection,
    scanSoftness,
    scanGlow,
    scanPhaseTaper,
    scanDuration,
    scanDelay,
    sensitivity,
    enableWebcam,
    modelsPath,
    showPreview
  ]);

  return (
    <div ref={containerRef} className={`gridscan ${className}`} style={style}>
      <canvas ref={canvasRef} className="gridscan-canvas" />
      {showPreview && (
        <div className="gridscan__preview">
          <div className="gridscan__badge">Grid Scan</div>
          {enableWebcam ? <video ref={videoRef} className="gridscan__video" playsInline muted /> : null}
        </div>
      )}
    </div>
  );
};

export default GridScan;
