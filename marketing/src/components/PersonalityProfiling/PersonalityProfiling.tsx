import "./PersonalityProfiling.css";

export default function PersonalityProfiling() {
  return (
    <section className="personality-section" id="capability-personality">
      <div className="personality-container">
        {/* LEFT CONTENT */}
        <div className="personality-content">
          <div className="personality-capability-label">
            <svg className="personality-label-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#89ceff" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4" fill="#89ceff"/>
              <line x1="12" y1="2" x2="12" y2="8" stroke="#89ceff" strokeWidth="2"/>
              <line x1="12" y1="16" x2="12" y2="22" stroke="#89ceff" strokeWidth="2"/>
              <line x1="2" y1="12" x2="8" y2="12" stroke="#89ceff" strokeWidth="2"/>
              <line x1="16" y1="12" x2="22" y2="12" stroke="#89ceff" strokeWidth="2"/>
            </svg>
            <span>CAPABILITY 02</span>
          </div>

          <h2>Personality Profiling</h2>

          <p className="personality-description">
            Measure personality traits using validated psychometric
            questionnaires to understand leadership styles. Gain deeper insight
            into how leaders think, react, and relate to others.
          </p>

          <div className="personality-feature-grid">
            <div className="personality-feature-card">
              <div className="personality-feature-icon">
                <img
                  src="/images/trait-analysis.png"
                  alt="Trait Analysis"
                  className="feature-icon-img"
                />
              </div>

              <h3>Trait Analysis</h3>

              <p>
                Identify core behavioral drivers and natural tendencies.
              </p>
            </div>

            <div className="personality-feature-card">
              <div className="personality-feature-icon tertiary">
                <img
                  src="/images/style-matching.png"
                  alt="Style Matching"
                  className="feature-icon-img"
                />
              </div>

              <h3>Style Matching</h3>

              <p>
                Evaluate cultural fit and team dynamic contribution.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT CHART */}
        <div className="personality-chart-wrapper">
          <div className="personality-chart-glow"></div>

          <div className="personality-chart-card">
              <div className="personality-chart-header">
                <h3>Personality Dimensions</h3>
                <svg className="chart-header-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="12,2 22,8.5 19,19.5 5,19.5 2,8.5" stroke="#8c909f" strokeWidth="2" fill="none"/>
                  <polygon points="12,6 18,10 16,16 8,16 6,10" stroke="#8c909f" strokeWidth="1.5" fill="none"/>
                  <circle cx="12" cy="12" r="2" fill="#8c909f"/>
                </svg>
              </div>

            <div className="radar-chart-container">
              <svg
                className="radar-chart"
                viewBox="0 0 300 300"
                role="img"
                aria-label="Personality dimensions radar chart"
              >
                {/* Outer Grid */}
                <polygon
                  points="150,35 260,115 218,245 82,245 40,115"
                  className="radar-grid"
                />

                <polygon
                  points="150,65 230,123 199,218 101,218 70,123"
                  className="radar-grid"
                />

                <polygon
                  points="150,95 201,132 181,191 119,191 99,132"
                  className="radar-grid"
                />

                <polygon
                  points="150,125 172,141 164,166 136,166 128,141"
                  className="radar-grid"
                />

                {/* Axis Lines */}
                <line x1="150" y1="150" x2="150" y2="35" className="radar-axis" />
                <line x1="150" y1="150" x2="260" y2="115" className="radar-axis" />
                <line x1="150" y1="150" x2="218" y2="245" className="radar-axis" />
                <line x1="150" y1="150" x2="82" y2="245" className="radar-axis" />
                <line x1="150" y1="150" x2="40" y2="115" className="radar-axis" />

                {/* Data */}
                <polygon
                  points="150,52 245,120 205,225 94,225 55,120"
                  className="radar-data"
                />

                {/* Data Points */}
                <circle cx="150" cy="52" r="4" className="radar-point" />
                <circle cx="245" cy="120" r="4" className="radar-point" />
                <circle cx="205" cy="225" r="4" className="radar-point" />
                <circle cx="94" cy="225" r="4" className="radar-point" />
                <circle cx="55" cy="120" r="4" className="radar-point" />
              </svg>

              {/* Labels */}
              <span className="radar-label label-openness">
                OPENNESS
              </span>

              <span className="radar-label label-conscientiousness">
                CONSCIENTIOUSNESS
              </span>

              <span className="radar-label label-extraversion">
                EXTRAVERSION
              </span>

              <span className="radar-label label-agreeableness">
                AGREEABLENESS
              </span>

              <span className="radar-label label-stability">
                STABILITY
              </span>
            </div>

            <div className="personality-insight">
              <p>
                &quot;Highly adaptable leader with strong focus on execution
                and strategic foresight.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}