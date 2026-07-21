"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import "./IntelligenceCore.css";

const BoltIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      fill="currentColor"
    />
  </svg>
);

const GroupIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="8.5"
      cy="8"
      r="2.5"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle
      cx="16"
      cy="7"
      r="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M13 15C13 15 13.5 17 16 17C18.5 17 18.5 15 18.5 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PersonIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 21V19C20 18.2044 19.6839 17.4413 19.1213 16.8787C18.5587 16.3161 17.7956 16 17 16H7C6.20435 16 5.44129 16.3161 4.87868 16.8787C4.31607 17.4413 4 18.2044 4 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="7"
      r="4"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const BarChartIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 20V10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M12 20V4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M6 20V14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const HubIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="2"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M16.24 7.76L14.12 5.64"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M20 12H18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M16.24 16.24L14.12 18.36"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M12 20V18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M7.76 16.24L9.88 18.36"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M4 12H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M7.76 7.76L9.88 5.64"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const FactCheckIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M8 12L11 15L16 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const capabilities = [
  {
    icon: <GroupIcon />,
    iconBg: "rgba(173, 198, 255, 0.1)",
    iconColor: "#adc6ff",
    title: "360 FEEDBACK",
    description: "Multi-rater insights",
  },
  {
    icon: <PersonIcon />,
    iconBg: "rgba(137, 206, 255, 0.1)",
    iconColor: "#89ceff",
    title: "PERSONALITY",
    description: "Deep trait analysis",
  },
  {
    icon: <BarChartIcon />,
    iconBg: "rgba(173, 198, 255, 0.1)",
    iconColor: "#adc6ff",
    title: "TALENT ANALYTICS",
    description: "Data-driven decisions",
  },
  {
    icon: <HubIcon />,
    iconBg: "rgba(192, 193, 255, 0.1)",
    iconColor: "#c0c1ff",
    title: "SUCCESSION",
    description: "Pipeline planning",
  },
  {
    icon: <FactCheckIcon />,
    iconBg: "rgba(137, 206, 255, 0.1)",
    iconColor: "#89ceff",
    title: "COMPETENCY",
    description: "Skills framework",
  },
  {
    icon: <BoltIcon />,
    iconBg: "rgba(173, 198, 255, 0.1)",
    iconColor: "#adc6ff",
    title: "READINESS",
    description: "Leader preparedness",
  },
];

export default function IntelligenceCore() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  // 3D Particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0;

    const resize = () => {
      w = canvas!.width = canvas!.offsetWidth;
      h = canvas!.height = canvas!.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Colors - bright blue/cyan palette
    const colors = [
      [173, 198, 255],
      [137, 206, 255],
      [192, 193, 255],
      [255, 255, 255],
    ];

    // 3D Wireframe geometric shape (icosahedron)
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoRaw = [
      [0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi],
      [1, phi, 0], [1, -phi, 0], [-1, phi, 0], [-1, -phi, 0],
      [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1]
    ];
    const icoScaleVal = 1.5;
    const wireframeVerts = icoRaw.map(v => [v[0]*icoScaleVal, v[1]*icoScaleVal, v[2]*icoScaleVal]);
    const wireframeEdges: [number, number][] = [];
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const dx = wireframeVerts[i][0] - wireframeVerts[j][0];
        const dy = wireframeVerts[i][1] - wireframeVerts[j][1];
        const dz = wireframeVerts[i][2] - wireframeVerts[j][2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (Math.abs(dist - 2*icoScaleVal) < 0.1) {
          wireframeEdges.push([i, j]);
        }
      }
    }

    // Create many particles - large, bright
    const count = 200;
    const particles: any[] = [];
    for (let i = 0; i < count; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 3,
        z: Math.random() * 2 + 0.1,
        size: Math.random() * 4 + 2,
        speed: Math.random() * 0.005 + 0.002,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.04 + 0.02,
        color: c,
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.003,
      });
    }

    let time = 0;

    const draw = () => {
      time++;
      ctx!.clearRect(0, 0, w, h);

      const mx = (mouseRef.current.x - 0.5) * 2;
      const my = (mouseRef.current.y - 0.5) * 2;

      // Sort by z for depth
      particles.sort((a: any, b: any) => a.z - b.z);

      // Draw particle connections
      
      // Draw 3D wireframe geometry in background
      const wireframeBaseSize = Math.min(w, h) * 0.25;
      const wireRotY = time * 0.003;
      const wireRotX = Math.sin(time * 0.002) * 0.25;
      
      const projectedWire = wireframeVerts.map(v => {
        let x = v[0] * wireframeBaseSize;
        let y = v[1] * wireframeBaseSize;
        let z = v[2] * wireframeBaseSize;
        
        // Rotate around Y axis
        const cosRY = Math.cos(wireRotY);
        const sinRY = Math.sin(wireRotY);
        const x1 = x * cosRY - z * sinRY;
        const z1 = x * sinRY + z * cosRY;
        
        // Rotate around X axis (tilt)
        const cosRX = Math.cos(wireRotX);
        const sinRX = Math.sin(wireRotX);
        const y1 = y * cosRX - z1 * sinRX;
        const z2 = y * sinRX + z1 * cosRX;
        
        // Perspective projection
        const persp = 800 / (800 + z2);
        
        return [
          x1 * persp + w * 0.5,
          y1 * persp + h * 0.5,
          persp
        ];
      });
      
      ctx!.strokeStyle = 'rgba(173, 198, 255, 0.08)';
      ctx!.lineWidth = 0.5;
      wireframeEdges.forEach(([i, j]) => {
        const [x1, y1] = projectedWire[i];
        const [x2, y2] = projectedWire[j];
        ctx!.beginPath();
        ctx!.moveTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.stroke();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const pa = particles[i];
          const pb = particles[j];
          const avgZ = (pa.z + pb.z) / 2;
          const pA = 800 / (800 + pa.z * 400);
          const pB = 800 / (800 + pb.z * 400);
          const ax = (pa.x * pA + mx * 0.15 * pa.z) * w / 2 + w / 2;
          const ay = (pa.y * pA + my * 0.15 * pa.z) * h / 2 + h / 2;
          const bx = (pb.x * pB + mx * 0.15 * pb.z) * w / 2 + w / 2;
          const by = (pb.y * pB + my * 0.15 * pb.z) * h / 2 + h / 2;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const alpha = (1 - dist / 200) * 0.2;
            ctx!.beginPath();
            ctx!.moveTo(ax, ay);
            ctx!.lineTo(bx, by);
            ctx!.strokeStyle = `rgba(173, 198, 255, ${alpha})`;
            ctx!.lineWidth = 0.6;
            ctx!.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const pulseFactor = 0.6 + 0.4 * Math.sin(p.pulse);

        // Movement
        p.x += p.vx + Math.sin(time * 0.001 + p.z) * 0.001;
        p.y += p.vy + Math.cos(time * 0.001 + p.z) * 0.001;

        // 3D projection
        const perspective = 800 / (800 + p.z * 400);
        const px = (p.x * perspective + mx * 0.15 * p.z) * w / 2 + w / 2;
        const py = (p.y * perspective + my * 0.15 * p.z) * h / 2 + h / 2;

        // Clamp to visible area
        if (px < -100 || px > w + 100 || py < -100 || py > h + 100) {
          p.x = (Math.random() - 0.5) * 2;
          p.y = (Math.random() - 0.5) * 2;
          continue;
        }

        const size = p.size * perspective * pulseFactor;
        const depthAlpha = Math.max(0.3, 0.8 - p.z * 0.2);
        const [r, g, b] = p.color;

        // Large visible glow
        const grad = ctx!.createRadialGradient(px, py, 0, px, py, size * 6);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
        grad.addColorStop(0.2, `rgba(${r},${g},${b},0.5)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.2)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath();
        ctx!.arc(px, py, size * 6, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // Bright solid core
        ctx!.beginPath();
        ctx!.arc(px, py, size * 0.8, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r},${g},${b},1)`;
        ctx!.fill();

        // White hot center
        ctx!.beginPath();
        ctx!.arc(px, py, size * 0.3, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, 1)`;
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Mouse tracking for 3D parallax
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleMouse = (e: MouseEvent) => {
      const rect = section!.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    section.addEventListener("mousemove", handleMouse, { passive: true });
    return () => section.removeEventListener("mousemove", handleMouse);
  }, []);

  const handleCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      card.style.setProperty("--card-rx", `${rotateX}deg`);
      card.style.setProperty("--card-ry", `${rotateY}deg`);
      card.style.setProperty(
        "--shine-x",
        `${(x / rect.width) * 100}%`
      );
      card.style.setProperty(
        "--shine-y",
        `${(y / rect.height) * 100}%`
      );
    },
    []
  );

  const handleCardMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = e.currentTarget;
      card.style.setProperty("--card-rx", "0deg");
      card.style.setProperty("--card-ry", "0deg");
    },
    []
  );

  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    const handleScroll = () => {
      const rect = diagram.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = 1 - rect.top / viewH;
      const clamped = Math.max(0, Math.min(1, progress));
      diagram.style.setProperty("--scroll-progress", `${clamped}`);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      className="intelligence-core"
      id="intelligence-core"
      ref={sectionRef}
    >
      {/* 3D Canvas particle background */}
      <canvas className="ic-bg-canvas" ref={canvasRef} aria-hidden="true" />

      {/* Deep background layers */}
      <div className="ic-bg-layer ic-bg-nebula" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-stars" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-grid" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-aurora" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-float-particles" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-shooting-stars" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-vortex" aria-hidden="true" />

      {/* Floating ambient orbs */}
      <div className="ic-bg-orb ic-bg-orb--1" aria-hidden="true" />
      <div className="ic-bg-orb ic-bg-orb--2" aria-hidden="true" />
      <div className="ic-bg-orb ic-bg-orb--3" aria-hidden="true" />
      <div className="ic-bg-orb ic-bg-orb--4" aria-hidden="true" />

      <div className="intelligence-core-container">

        {/* Heading */}

        <div className="intelligence-heading">
          <h2>
            One Platform. Complete Leadership Intelligence.
          </h2>

          <p>
            The unified OS for your talent ecosystem,
            connecting every assessment tool to strategic
            workforce decisions.
          </p>
        </div>


        {/* Orbit Area */}

        <div className="core-diagram" ref={diagramRef}>

          {/* Ambient glow rings */}
          <div className="core-ambient-ring core-ambient-ring-1" aria-hidden="true" />
          <div className="core-ambient-ring core-ambient-ring-2" aria-hidden="true" />

          {/* Orbit Ring */}
          <div className="core-orbit-ring" />

          {/* Connection lines (SVG) */}
          <svg className="core-connections" viewBox="0 0 700 650" aria-hidden="true">
            <defs>
              <radialGradient id="lineGlow">
                <stop offset="0%" stopColor="rgba(173,198,255,0.3)" />
                <stop offset="100%" stopColor="rgba(173,198,255,0)" />
              </radialGradient>
            </defs>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const cx = 350 + 250 * Math.cos(angle);
              const cy = 325 + 250 * Math.sin(angle);
              return (
                <line
                  key={i}
                  x1="350"
                  y1="325"
                  x2={cx}
                  y2={cy}
                  stroke="rgba(173,198,255,0.08)"
                  strokeWidth="1"
                  strokeDasharray="4 8"
                  className="core-connection-line"
                />
              );
            })}
          </svg>

          {/* Central Intelligence Core */}

          <div className="core-center">
            <div className="core-center-glow" aria-hidden="true" />
            <div className="core-center-rings" aria-hidden="true">
              <span /><span /><span />
            </div>
            <h3>
              Intelligence
              <br />
              Core
            </h3>
          </div>


          {/* Orbiting Cards */}

          <div className="orbit-container">
            <div className="orbit-rotator">
              {capabilities.map((capability, index) => (
                <div
                  className="orbiting-node"
                  key={capability.title}
                  style={
                    {
                      "--i": index,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="node-counter-rotate"
                    style={
                      {
                        "--i": index,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      className="core-node"
                      ref={(el) => { cardRefs.current[index] = el; }}
                      onMouseMove={handleCardMouseMove}
                      onMouseLeave={handleCardMouseLeave}
                    >
                      {/* 3D shine overlay */}
                      <div className="core-node-shine" aria-hidden="true" />

                      {/* Holographic edge */}
                      <div className="core-node-edge" aria-hidden="true" />

                      <div
                        className="core-node-icon"
                        style={{
                          background: capability.iconBg,
                          color: capability.iconColor,
                        }}
                      >
                        {capability.icon}
                      </div>

                      <span>{capability.title}</span>
                      <span className="core-node-desc">{capability.description}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}