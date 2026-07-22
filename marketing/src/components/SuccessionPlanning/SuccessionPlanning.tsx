import "./SuccessionPlanning.css";
import { useEffect, useRef } from "react";

export default function SuccessionPlanning() {
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
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 6;

      card.style.setProperty("--tilt-x", `${rotateX}deg`);
      card.style.setProperty("--tilt-y", `${rotateY}deg`);
      card.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
      card.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);
    };

    const handleMouseLeave = () => {
      card.style.setProperty("--tilt-x", `0deg`);
      card.style.setProperty("--tilt-y", `0deg`);
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <section className="succession-section" id="capability-succession">
      <div className="succession-container">
        {/* LEFT CONTENT */}
        <div className="succession-content">
          <div className="succession-capability-label">
            <img
              src="/images/succession-planning.png"
              alt="Succession Planning"
              className="succession-label-icon-img"
            />
            <span>CAPABILITY 06</span>
          </div>

          <h2>Succession Planning &amp; De-Risking.</h2>

          <p className="succession-description">
            Build your leadership pipeline before a vacancy appears. Visual
            pipeline tracking allows HR teams to see precisely how deep their
            bench is for critical roles.
          </p>

          {/* RISK CARD */}
          <div className="succession-risk-card">
            <div className="succession-risk-header">
              <h3>Chief Technology Officer</h3>

              <span className="risk-badge">High Risk Gap</span>
            </div>

            <div className="successor-summary">
              <div className="successor-avatars">
                <div className="successor-avatar avatar-one">AP</div>
                <div className="successor-avatar avatar-two">DM</div>
                <div className="successor-avatar avatar-more">+3</div>
              </div>

              <p>5 Potential Successors Identified</p>
            </div>
          </div>
        </div>

        {/* RIGHT SUCCESSION MAP */}
        <div className="succession-map-wrapper">
          <div className="succession-map-glow"></div>

          <div className="succession-map-card" ref={cardRef}>
            <div className="succession-map-header">
              <img
                src="/images/succession-planning.png"
                alt="Succession Planning"
                className="succession-map-icon-img"
              />
              <h3>Succession Map: CEO Office</h3>
            </div>

            {/* CURRENT CEO */}
            <div className="current-ceo-card">
              <div className="ceo-avatar">CEO</div>

              <div>
                <h4>Current CEO</h4>
                <p>Status: Active</p>
              </div>
            </div>

            {/* CONNECTION */}
            <div className="succession-connector"></div>

            {/* SUCCESSORS */}
            <div className="succession-candidates">
              <div className="candidate-card candidate-ready">
                <img
                  src="/images/hero-dashboard/amara-perera.jpg"
                  alt="Amara Perera"
                  className="candidate-avatar-img"
                />

                <h4>Amara Perera</h4>

                <span className="candidate-status ready-now">
                  READY NOW
                </span>
              </div>

              <div className="candidate-card candidate-future">
                <img
                  src="/images/hero-dashboard/saman-mendis.jpg"
                  alt="David Mendis"
                  className="candidate-avatar-img"
                />

                <h4>David Mendis</h4>

                <span className="candidate-status future-ready">
                  1-2 YEARS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}