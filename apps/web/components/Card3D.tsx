'use client';
import { useRef, CSSProperties, ReactNode, useCallback } from 'react';

interface Card3DProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** Tilt intensity in degrees — default 14 */
  intensity?: number;
  /** Show amber shimmer on hover — default true */
  shimmer?: boolean;
  /** Ambient glow color */
  glowColor?: string;
}

/**
 * Card3D — CSS 3D perspective tilt card with mouse-tracking shimmer.
 * Works entirely client-side, no WebGL needed, zero added bundle overhead.
 * Wraps any children with a 3D transform container.
 */
export default function Card3D({
  children,
  style,
  className,
  intensity = 14,
  shimmer = true,
  glowColor = 'rgba(245,168,0,0.18)',
}: Card3DProps) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const glowRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x  = (e.clientX - left) / width;
    const y  = (e.clientY - top)  / height;
    const rx = (y - 0.5) * intensity;
    const ry = (x - 0.5) * -intensity;

    card.style.transform =
      `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(12px) scale(1.01)`;

    if (shimmer && glowRef.current) {
      glowRef.current.style.opacity = '1';
      glowRef.current.style.background =
        `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${glowColor} 0%, transparent 65%)`;
    }

    // Subtle inner parallax
    if (innerRef.current) {
      innerRef.current.style.transform =
        `translateX(${(x - 0.5) * -4}px) translateY(${(y - 0.5) * -4}px)`;
    }
  }, [intensity, shimmer, glowColor]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform =
      'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
    if (glowRef.current) glowRef.current.style.opacity = '0';
    if (innerRef.current) innerRef.current.style.transform = 'translateX(0) translateY(0)';
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transition: 'transform 0.18s cubic-bezier(0.23,1,0.32,1), box-shadow 0.18s ease',
        transformStyle: 'preserve-3d',
        position: 'relative',
        willChange: 'transform',
        ...style,
      }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div
          ref={glowRef}
          style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            opacity: 0, transition: 'opacity 0.3s ease',
            pointerEvents: 'none', zIndex: 2,
          }}
        />
      )}
      {/* Inner content with micro-parallax */}
      <div
        ref={innerRef}
        style={{
          transition: 'transform 0.25s cubic-bezier(0.23,1,0.32,1)',
          height: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}
