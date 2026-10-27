'use client';
import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

// Dot-matrix globe for the landing hero. Light, flat and brand-blue, so it
// reads as a diagram rather than a photograph of the Earth.
export default function DottedGlobe({ markers = [], arcs = [], className = '' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Opens on Europe/Africa/South Asia so the hub cards around the globe sit
    // over the face that is actually showing.
    let phi = 4.75;
    let size = wrap.offsetWidth;
    let globe = null;

    // cobe draws nothing if it is built at zero width, which happens when the
    // hero has not been laid out yet, so hold off until the wrapper measures.
    const start = () => {
      if (globe || !size) return;
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: size * 2,
        height: size * 2,
        phi,
        theta: 0.2,
        dark: 0,
        diffuse: 0.4,
        mapSamples: 24000,
        mapBrightness: 1.15,
        baseColor: [0.84, 0.89, 0.97],
        markerColor: [0.07, 0.29, 0.68],
        glowColor: [0.93, 0.96, 1],
        markers,
        arcs,
        arcColor: [0.42, 0.59, 0.86],
        arcWidth: 0.35,
        arcHeight: 0.35,
        onRender: (state) => {
          state.phi = phi;
          phi += 0.0016;
          state.width = size * 2;
          state.height = size * 2;
        },
      });
    };

    start();

    const ro = new ResizeObserver(() => {
      size = wrap.offsetWidth;
      start();
    });
    ro.observe(wrap);

    return () => { ro.disconnect(); globe?.destroy(); };
  }, [markers, arcs]);

  return (
    <div ref={wrapRef} className={className} style={{ aspectRatio: '1 / 1' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
