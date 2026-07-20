import "./LeadershipAssessment.css";

export default function LeadershipAssessment() {
  return (
    <section className="leadership-assessment" id="capability-360">
      <div className="leadership-assessment-container">
        {/* LEFT - Assessment Card */}
        <div className="assessment-card-wrapper">
          <div className="assessment-card-glow"></div>

          <div className="assessment-card">
            <div className="assessment-profile">
              <img
                src="/images/Thomas Wickramasinghe.jpg"
                alt="Thomas Wickramasinghe"
                className="assessment-avatar-img"
              />

              <div>
                <h3>Thomas Wickramasinghe</h3>
                <p>Senior Sales Manager</p>
              </div>
            </div>

            <div className="assessment-scores">
              {/* Strategic Thinking */}
              <div className="score-item">
                <div className="score-header">
                  <span>Strategic Thinking</span>
                  <strong className="score-primary">92%</strong>
                </div>

                <div className="score-bar">
                  <div
                    className="score-progress score-progress-primary"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </div>

              {/* Communication */}
              <div className="score-item">
                <div className="score-header">
                  <span>Communication</span>
                  <strong className="score-tertiary">85%</strong>
                </div>

                <div className="score-bar">
                  <div
                    className="score-progress score-progress-tertiary"
                    style={{ width: "85%" }}
                  ></div>
                </div>
              </div>

              {/* People Leadership */}
              <div className="score-item">
                <div className="score-header">
                  <span>People Leadership</span>
                  <strong className="score-primary">78%</strong>
                </div>

                <div className="score-bar">
                  <div
                    className="score-progress score-progress-primary"
                    style={{ width: "78%" }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Rating Summary */}
            <div className="assessment-rating-summary">
              <div className="rating-item">
                <span>PEERS</span>
                <strong>4.8</strong>
              </div>

              <div className="rating-item">
                <span>REPORTS</span>
                <strong>4.2</strong>
              </div>

              <div className="rating-item">
                <span>MANAGER</span>
                <strong>4.9</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT - Content */}
        <div className="leadership-assessment-content">
          <div className="capability-label">
            <span className="capability-icon">↻</span>
            <span>CAPABILITY 01</span>
          </div>

          <h2>360° Leadership Assessments.</h2>

          <p className="leadership-assessment-description">
            Understand leadership from every perspective. Our multi-rater
            modules aggregate feedback from all levels, providing a non-biased,
            holistic view of impact and developmental needs.
          </p>

          <ul className="assessment-benefits">
            <li>
              <svg className="check-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Eliminate blind spots with multi-rater feedback.</span>
            </li>

            <li>
              <svg className="check-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Compare self-perception with peer reality.</span>
            </li>

            <li>
              <svg className="check-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#adc6ff" />
                <path d="M6 10.5L9 13.5L14 8" stroke="#002e6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Build hyper-personalized development plans.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}