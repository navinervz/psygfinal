import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  a: number;
  hue: number;
}

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let parts: Particle[] = [];
    const count = 80;

    function createParticle(): Particle {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 3 + 1,
        a: Math.random() * 0.3 + 0.2,
        hue: Math.random() * 60 + 100 // Green hues
      };
    }

    function initParticles() {
      parts = [];
      for (let i = 0; i < count; i++) parts.push(createParticle());
    }

    function updateParticles() {
      parts.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        
        // Subtle hue shift
        p.hue += 0.1;
        if (p.hue > 160) p.hue = 100;
      });
    }

    function drawParticles() {
      ctx.clearRect(0, 0, w, h);
      
      // Draw particles with glass effect
      parts.forEach(p => {
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 100%, 50%, ${p.a})`);
        gradient.addColorStop(0.5, `hsla(${p.hue}, 100%, 50%, ${p.a * 0.5})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core particle
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.a * 0.8})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw connections with glass effect
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const dx = parts[i].x - parts[j].x;
          const dy = parts[i].y - parts[j].y;
          const d = Math.hypot(dx, dy);
          
          if (d < 120) {
            const opacity = (1 - d / 120) * 0.3;
            const gradient = ctx.createLinearGradient(
              parts[i].x, parts[i].y, 
              parts[j].x, parts[j].y
            );
            gradient.addColorStop(0, `hsla(${parts[i].hue}, 100%, 50%, ${opacity})`);
            gradient.addColorStop(0.5, `hsla(${(parts[i].hue + parts[j].hue) / 2}, 100%, 50%, ${opacity * 0.5})`);
            gradient.addColorStop(1, `hsla(${parts[j].hue}, 100%, 50%, ${opacity})`);
            
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.moveTo(parts[i].x, parts[i].y);
            ctx.lineTo(parts[j].x, parts[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function animateParticles() {
      updateParticles();
      drawParticles();
      requestAnimationFrame(animateParticles);
    }

    // Handle resize
    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);
    
    initParticles();
    animateParticles();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{ background: 'transparent' }}
    />
  );
};

export default Background;