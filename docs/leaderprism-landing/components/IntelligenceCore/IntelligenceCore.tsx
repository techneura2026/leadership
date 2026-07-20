"use client";

import { useEffect, useRef, useCallback } from "react";
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
    >
      {/* Deep background layers */}
      <div className="ic-bg-layer ic-bg-nebula" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-stars" aria-hidden="true" />
      <div className="ic-bg-layer ic-bg-grid" aria-hidden="true" />

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