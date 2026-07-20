import "./Hero.css";
import { useEffect, useRef } from "react";

export default function Hero() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -6;
      const rotateY = ((x - centerX) / centerX) * 8;
      const translateX = ((x - centerX) / centerX) * -4;
      const translateY = ((y - centerY) / centerY) * -4;

      card.style.setProperty("--tilt-x", `${rotateX}deg`);
      card.style.setProperty("--tilt-y", `${rotateY}deg`);
      card.style.setProperty("--tilt-translate-x", `${translateX}px`);
      card.style.setProperty("--tilt-translate-y", `${translateY}px`);
      card.style.setProperty("--mouse-x-pct", `${(x / rect.width) * 100}%`);
      card.style.setProperty("--mouse-y-pct", `${(y / rect.height) * 100}%`);
    };

    const handleMouseLeave = () => {
      card.style.setProperty("--tilt-x", `0deg`);
      card.style.setProperty("--tilt-y", `0deg`);
      card.style.setProperty("--tilt-translate-x", `0px`);
      card.style.setProperty("--tilt-translate-y", `0px`);
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <section className="hero">
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
        poster="/images/leadership-video-poster.jpg"
      >
        <source src="/videos/leadership-video.mp4" type="video/mp4" />
      </video>

      <div className="hero-overlay"></div>
      <div className="hero-glow"></div>

      <div className="hero-container">
        {/* LEFT SIDE */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">✥</span>
            <span>Next-Gen Leadership Intelligence</span>
          </div>

          <h1 className="hero-title">
            See the Leaders of
            <br />
            <span>Tomorrow, Today.</span>
          </h1>

          <p className="hero-description">
            LeaderPrism transforms fragmented talent data into a unified
            leadership pipeline. Identify high-potentials, assess readiness,
            and de-risk your succession planning with AI-powered insights.
          </p>

          <div className="hero-actions">
            <button className="hero-primary-btn">
              Book a Demo
              <span className="arrow">→</span>
            </button>

            <button className="hero-secondary-btn">
              Explore LeaderPrism
            </button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="hero-dashboard-wrapper">
          <div className="dashboard-glow"></div>

          <div className="readiness-card" ref={cardRef}>
            {/* CARD HEADER */}
            <div className="readiness-header">
              <div>
                <p className="readiness-label">SUCCESSION OVERVIEW</p>
                <h2>Leadership Readiness</h2>
              </div>

              <div className="card-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-blue"></span>
                <span className="dot dot-purple"></span>
              </div>
            </div>

            {/* STATS */}
            <div className="readiness-stats">
              <div className="stat-box">
                <p>CEO READY</p>
                <strong className="primary-stat">02</strong>
              </div>

              <div className="stat-box">
                <p>HIGH POTENTIAL</p>
                <strong className="tertiary-stat">15</strong>
              </div>

              <div className="stat-box">
                <p>COVERAGE</p>
                <strong className="white-stat">92%</strong>
              </div>
            </div>

            {/* PEOPLE */}
            <div className="people-list">
              <div className="person-card person-card-active">
                <img
                  src="/images/Hero-Dashboard/Amara Perera.jpg"
                  alt="Amara Perera"
                  className="person-avatar-img"
                />

                <div className="person-info">
                  <h3>Amara Perera</h3>
                  <p>Senior Manager - Strategy</p>
                </div>

                <div className="person-score">
                  <strong>92</strong>
                  <span>READINESS</span>
                </div>
              </div>

              <div className="person-card">
                <img
                  src="/images/Hero-Dashboard/Saman Mendis.jpg"
                  alt="Saman Mendis"
                  className="person-avatar-img"
                />

                <div className="person-info">
                  <h3>Saman Mendis</h3>
                  <p>Engineering Lead</p>
                </div>

                <div className="person-score david-score">
                  <strong>89</strong>
                  <span>READINESS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}