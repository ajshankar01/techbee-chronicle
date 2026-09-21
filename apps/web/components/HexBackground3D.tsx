'use client';
import { useEffect, useState } from 'react';

/**
 * Optimized light-themed animated background.
 * Uses hardware-accelerated pure CSS transitions and SVG grids.
 * 100% lightweight, loads instantly, uses zero GPU WebGL or external library (Three.js removed).
 */
export default function HexBackground3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      }}
    >
      {/* ── Ambient Glowing Blobs ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/20 blur-[120px] animate-blob-drift" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-200/20 blur-[130px] animate-blob-drift-reverse" />
      <div className="absolute top-[30%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-blue-100/10 blur-[100px] animate-blob-pulse" />

      {/* ── Subtle Geometric Grid Overlay ── */}
      <div 
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #4f46e5 1px, transparent 0),
            linear-gradient(to right, rgba(79, 70, 229, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(79, 70, 229, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 80px 80px, 80px 80px',
        }}
      />

      {/* ── Dynamic floating modern particles ── */}
      <div className="absolute inset-0 animate-grid-float opacity-[0.4]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Subtle outline hexagons to preserve the "Techbee Chronicle" theme in an ultra-light format */}
          <polygon points="120,80 140,90 140,110 120,120 100,110 100,90" fill="none" stroke="rgba(79, 70, 229, 0.08)" strokeWidth="1.5" className="animate-float-slow-1" />
          <polygon points="520,300 545,312 545,338 520,350 495,338 495,312" fill="none" stroke="rgba(139, 92, 246, 0.08)" strokeWidth="1.5" className="animate-float-slow-2" />
          <polygon points="850,150 870,160 870,180 850,190 830,180 830,160" fill="none" stroke="rgba(59, 130, 246, 0.06)" strokeWidth="1" className="animate-float-slow-3" />
          <polygon points="300,600 320,610 320,630 300,640 280,630 280,610" fill="none" stroke="rgba(79, 70, 229, 0.05)" strokeWidth="1" className="animate-float-slow-4" />
          <polygon points="1000,550 1030,565 1030,595 1000,610 970,595 970,565" fill="none" stroke="rgba(139, 92, 246, 0.07)" strokeWidth="1.5" className="animate-float-slow-5" />
        </svg>
      </div>

      <style jsx global>{`
        @keyframes blob-drift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(8vw, 12vh, 0) scale(1.1); }
          66% { transform: translate3d(-6vw, 8vh, 0) scale(0.9); }
        }
        @keyframes blob-drift-reverse {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(-10vw, -8vh, 0) scale(0.95); }
          66% { transform: translate3d(6vw, -12vh, 0) scale(1.05); }
        }
        @keyframes blob-pulse {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.8; }
          50% { transform: translate3d(2vw, -2vh, 0) scale(1.15); opacity: 1; }
        }
        .animate-blob-drift {
          animation: blob-drift 24s ease-in-out infinite;
        }
        .animate-blob-drift-reverse {
          animation: blob-drift-reverse 28s ease-in-out infinite;
        }
        .animate-blob-pulse {
          animation: blob-pulse 18s ease-in-out infinite;
        }

        /* Float animations for geometric shapes */
        @keyframes float-slow-1 {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(15px, -25px, 0) rotate(15deg); }
        }
        @keyframes float-slow-2 {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(-20px, 30px, 0) rotate(-20deg); }
        }
        @keyframes float-slow-3 {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(10px, 15px, 0) rotate(10deg); }
        }
        @keyframes float-slow-4 {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(-15px, -15px, 0) rotate(-10deg); }
        }
        @keyframes float-slow-5 {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(30px, -20px, 0) rotate(25deg); }
        }

        .animate-float-slow-1 { animation: float-slow-1 16s ease-in-out infinite; transform-origin: center; }
        .animate-float-slow-2 { animation: float-slow-2 20s ease-in-out infinite; transform-origin: center; }
        .animate-float-slow-3 { animation: float-slow-3 14s ease-in-out infinite; transform-origin: center; }
        .animate-float-slow-4 { animation: float-slow-4 18s ease-in-out infinite; transform-origin: center; }
        .animate-float-slow-5 { animation: float-slow-5 22s ease-in-out infinite; transform-origin: center; }
      `}</style>
    </div>
  );
}
