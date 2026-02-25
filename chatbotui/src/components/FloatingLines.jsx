import React, { useEffect, useRef } from 'react';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export default function FloatingLines({
  linesGradient = ['#22d3ee', '#00B2FF', '#3b82f6'],
  enabledWaves = ['top', 'middle', 'bottom'],
  lineCount = 6,
  lineDistance = 5,
  topWavePosition,
  middleWavePosition,
  bottomWavePosition = { x: 2.0, y: -0.7, rotate: -1 },
  animationSpeed = 1,
  interactive = true,
  bendRadius = 10.0,
  bendStrength = -5.0,
  mouseDamping = 0.05,
  parallax = true,
  parallaxStrength = 0.2,
  mixBlendMode = 'screen',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const timeRef = useRef(0);
  const pointerTargetRef = useRef({ x: 0.5, y: 0.5 });
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      sizeRef.current = { w, h, dpr };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    const onResize = () => setSize();
    window.addEventListener('resize', onResize);

    const onPointerMove = (e) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      pointerTargetRef.current = { x, y };
    };
    window.addEventListener('pointermove', onPointerMove);

    const toArray3 = (val) => {
      if (Array.isArray(val)) {
        if (val.length === 3) return val;
        if (val.length === 0) return [6, 6, 6];
        return [val[0], val[1] ?? val[0], val[2] ?? val[0]];
      }
      return [val, val, val];
    };

    const lc = toArray3(lineCount);
    const ld = toArray3(lineDistance);
    const positions = {
      top: topWavePosition ?? { x: 0, y: 0, rotate: 0 },
      middle: middleWavePosition ?? { x: 0, y: 0, rotate: 0 },
      bottom: bottomWavePosition ?? { x: 2.0, y: -0.7, rotate: -1 },
    };

    const waves = [
      { key: 'top', baseY: 0.22, amp: 36, freq: 0.0035, speed: 0.9, count: lc[0], dist: ld[0] },
      { key: 'middle', baseY: 0.50, amp: 28, freq: 0.0030, speed: 0.8, count: lc[1], dist: ld[1] },
      { key: 'bottom', baseY: 0.78, amp: 22, freq: 0.0026, speed: 0.7, count: lc[2], dist: ld[2] },
    ].filter(w => enabledWaves.includes(w.key));

    const gradientFor = () => {
      const { w: W } = sizeRef.current;
      const g = ctx.createLinearGradient(0, 0, W, 0);
      const n = linesGradient.length;
      if (n === 0) {
        g.addColorStop(0, '#22d3ee');
        g.addColorStop(1, '#3b82f6');
      } else {
        for (let i = 0; i < n; i++) {
          g.addColorStop(i / (n - 1), linesGradient[i]);
        }
      }
      return g;
    };

    const bendSigma = Math.max(1, bendRadius);

    const draw = () => {
      const { w: W, h: H } = sizeRef.current;
      ctx.clearRect(0, 0, W, H);

      pointerRef.current.x += (pointerTargetRef.current.x - pointerRef.current.x) * mouseDamping;
      pointerRef.current.y += (pointerTargetRef.current.y - pointerRef.current.y) * mouseDamping;

      timeRef.current += 0.016 * animationSpeed;
      const t = timeRef.current;

      for (let wi = 0; wi < waves.length; wi++) {
        const wv = waves[wi];
        const pos = positions[wv.key];
        ctx.save();
        const parallaxX = parallax ? (pointerRef.current.x - 0.5) * parallaxStrength * 40 * (wi + 1) : 0;
        const parallaxY = parallax ? (pointerRef.current.y - 0.5) * parallaxStrength * 30 * (wi + 1) : 0;
        ctx.translate(parallaxX, parallaxY);
        if (pos.rotate) {
          const deg = pos.rotate;
          ctx.translate(W * 0.5, H * 0.5);
          ctx.rotate((deg * Math.PI) / 180);
          ctx.translate(-W * 0.5, -H * 0.5);
        }
        ctx.translate(pos.x, pos.y);
        ctx.strokeStyle = gradientFor();
        ctx.lineWidth = 1.2;

        for (let i = 0; i < wv.count; i++) {
          const baseY = H * wv.baseY + i * wv.dist;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const bend = interactive
              ? bendStrength * Math.exp(-((x - pointerRef.current.x * W) ** 2) / (2 * bendSigma ** 2))
              : 0;
            const y =
              baseY +
              wv.amp * Math.sin((x * wv.freq) + (t * wv.speed) + i * 0.6) +
              bend;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [
    linesGradient,
    enabledWaves,
    lineCount,
    lineDistance,
    topWavePosition,
    middleWavePosition,
    bottomWavePosition,
    animationSpeed,
    interactive,
    bendRadius,
    bendStrength,
    mouseDamping,
    parallax,
    parallaxStrength,
    mixBlendMode,
  ]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.style.mixBlendMode = mixBlendMode;
  }, [mixBlendMode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
