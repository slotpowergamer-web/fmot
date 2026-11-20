import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  depth: number;
  color: string;
  glow: boolean;
  alpha: number;
  pulseOffset: number;
}

export const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = { x: -9999, y: -9999, active: false };

    const palette = [
      { color: '#8BAA43', glow: true },
      { color: '#526B32', glow: true },
      { color: '#526B32', glow: false },
      { color: '#263F24', glow: false },
      { color: '#A5AAA2', glow: false },
    ];

    let particles: Particle[] = [];

    const createParticles = () => {
      const isMobile = width < 768;
      const count = isMobile ? 34 : Math.min(82, Math.floor((width * height) / 18500));
      particles = Array.from({ length: count }, (_, index) => {
        const depth = 0.4 + Math.random() * 0.9;
        const swatch = palette[index % palette.length];
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.34 * depth,
          vy: (Math.random() - 0.5) * 0.34 * depth,
          radius: (1.15 + Math.random() * 1.9) * depth,
          depth,
          color: swatch.color,
          glow: swatch.glow && Math.random() > 0.35,
          alpha: 0.24 + depth * 0.32,
          pulseOffset: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    let tick = 0;

    const render = () => {
      tick += 0.012;
      ctx.clearRect(0, 0, width, height);

      const isMobile = width < 768;
      const maxConnectDist = isMobile ? 95 : 138;
      const mouseRadius = isMobile ? 0 : 145;

      // Update positions
      if (!prefersReducedMotion) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (mouse.active && mouseRadius > 0) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 0.01 && distSq < mouseRadius * mouseRadius) {
              const dist = Math.sqrt(distSq);
              const force = (1 - dist / mouseRadius) * 0.42 * p.depth;
              p.x += (dx / dist) * force;
              p.y += (dy / dist) * force;
            }
          }

          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;
        }
      }

      // Draw subtle tactical network connections
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxConnectDist * maxConnectDist) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / maxConnectDist) * 0.16;
            ctx.strokeStyle = `rgba(139, 170, 67, ${opacity.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw circular particles with discreet glow
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const flicker = p.glow ? 0.85 + 0.15 * Math.sin(tick * 2 + p.pulseOffset) : 1;
        const finalAlpha = p.alpha * flicker;

        if (p.glow) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4.2);
          grad.addColorStop(0, `rgba(139, 170, 67, ${(finalAlpha * 0.48).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(139, 170, 67, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = finalAlpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (!prefersReducedMotion) {
        animationId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none opacity-85"
    />
  );
};
