import { useEffect, useRef } from "react";

import "./ReadinessAssessment.css";

export default function ReadinessAssessment() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          section.classList.add("animate-scores");
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="readiness-section" id="capability-readiness">
      <div className="readiness-container">
        {/* LEFT CONTENT */}
        <div className="readiness-content">
          <div className="readiness-capability-label">
            <img
              src="/images/power-icon.png"
              alt="Power"
              className="readiness-label-icon-img"
            />
            <span>CAPABILITY 04</span>
          </div>

          <h2>Readiness Assessment.</h2>

          <p className="readiness-description">
            Assess readiness for leadership roles using SJT (Situational
            Judgment Tests) and learning agility to evaluate situational
            judgment and potential for growth.
          </p>

          <ul className="readiness-benefits">
            <li>
              <span className="readiness-check">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                  <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                Analyze situational judgment in high-stakes scenarios.
              </span>
            </li>

            <li>
              <span className="readiness-check">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                  <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                Measure learning agility and adaptability to new challenges.
              </span>
            </li>

            <li>
              <span className="readiness-check">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                  <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                Predict success in future roles based on current readiness
                levels.
              </span>
            </li>
          </ul>
        </div>

        {/* RIGHT SCORECARD */}
        <div className="readiness-scorecard-wrapper">
          <div className="readiness-scorecard-glow"></div>

          <div className="readiness-scorecard">
            <div className="readiness-scorecard-header">
              <h3>Readiness Scorecard</h3>

              <span className="high-potential-badge">
                HIGH POTENTIAL
              </span>
            </div>

            <div className="readiness-score-grid">
              {/* SJT SCORE */}
              <div className="readiness-score-item">
                <div className="circular-score sjt-score">
                  <svg viewBox="0 0 120 120">
                    <circle
                      className="score-circle-background"
                      cx="60"
                      cy="60"
                      r="48"
                    />

                     <circle
                       className="score-circle-progress score-circle-primary"
                       cx="60"
                       cy="60"
                       r="48"
                     />
                  </svg>

                  <span>90%</span>
                </div>

                <p>SJT SCORE</p>
              </div>

              {/* LEARNING AGILITY */}
              <div className="readiness-score-item">
                <div className="circular-score agility-score">
                  <svg viewBox="0 0 120 120">
                    <circle
                      className="score-circle-background"
                      cx="60"
                      cy="60"
                      r="48"
                    />

                     <circle
                       className="score-circle-progress score-circle-tertiary"
                       cx="60"
                       cy="60"
                       r="48"
                     />
                  </svg>

                  <span>80%</span>
                </div>

                <p>LEARNING AGILITY</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}