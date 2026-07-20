import "./CompetencyEvaluation.css";

const competencies = [
  {
    icon: "/images/Strategic Agility.png",
    title: "Strategic Agility",
    type: "primary",
  },
  {
    icon: "/images/Inclusive Leadership.png",
    title: "Inclusive Leadership",
    type: "tertiary",
  },
  {
    icon: "/images/Decision Velocity.png",
    title: "Decision Velocity",
    type: "secondary",
  },
];

export default function CompetencyEvaluation() {
  return (
    <section
      className="competency-section"
      id="capability-competency"
    >
      <div className="competency-container">
        {/* LEFT - COMPETENCY LIBRARY */}
        <div className="competency-library-wrapper">
          <div className="competency-library-glow"></div>

          <div className="competency-library-card">
            <div className="competency-library-header">
              <h3>Competency Library</h3>
              <span>120+ Behaviors</span>
            </div>

            <div className="competency-list">
              {competencies.map((competency) => (
                <div
                  className="competency-item"
                  key={competency.title}
                >
                  <div className="competency-item-left">
                    <div
                      className={`competency-item-icon ${competency.type}`}
                    >
                      <img
                        src={competency.icon}
                        alt={competency.title}
                        className="competency-icon-img"
                      />
                    </div>

                    <span>{competency.title}</span>
                  </div>

                  <div className="competency-drag">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="competency-content">
          <div className="competency-capability-label">
            <span className="competency-label-icon">☷</span>
            <span>CAPABILITY 03</span>
          </div>

          <h2>Competency-Based Evaluations.</h2>

          <p className="competency-description">
            Standardize leadership excellence. Use our built-in competency
            library or map your own framework to evaluate behaviors that drive
            organizational success.
          </p>

          <div className="competency-feature-grid">
            <div className="competency-feature-card">
              <div className="competency-feature-icon">
                <img
                  src="/images/Framework mapping.png"
                  alt="Framework Mapping"
                  className="feature-icon-img"
                />
              </div>

              <h3>Framework Mapping</h3>

              <p>
                Align assessments to your specific leadership model.
              </p>
            </div>

            <div className="competency-feature-card">
              <div className="competency-feature-icon tertiary">
                <img
                  src="/images/Behavioral indicators.png"
                  alt="Behavioral Indicators"
                  className="feature-icon-img"
                />
              </div>

              <h3>Behavioral Indicators</h3>

              <p>
                Measure observable actions, not just vague traits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}