import "./TalentPool.css";

const candidates = [
  {
    initials: "AP",
    name: "Amara Perera",
    department: "Executive",
    performance: "High",
    readiness: "Ready Now",
    score: 92,
    type: "primary",
  },
  {
    initials: "DM",
    name: "David Mendis",
    department: "Engineering",
    performance: "High",
    readiness: "Ready Now",
    score: 90,
    type: "tertiary",
  },
  {
    initials: "PK",
    name: "Priya Kumari",
    department: "Finance",
    performance: "Medium",
    readiness: "1-2 Years",
    score: 84,
    type: "neutral",
  },
];

export default function TalentPool() {
  return (
    <section className="talent-pool-section" id="capability-talent">
      <div className="talent-pool-container">
        {/* LEFT SIDE */}
        <div className="talent-pool-left">
          <div className="talent-capability-label">
            <img
              src="/images/Talent-pool.png"
              alt="Talent Pool"
              className="talent-label-icon-img"
            />
            <span>CAPABILITY 07</span>
          </div>

          <h2>Talent Pool Management.</h2>

          <p className="talent-description">
            Maintain a clear view of your organization's human capital.
            Dynamically segment talent by performance, potential, and skill
            sets to ensure optimal resource allocation.
          </p>

          {/* 9 BOX GRID */}
          <div className="nine-box-wrapper">
            <img
              src="/images/9box-grid.png"
              alt="9 Box Grid"
              className="nine-box-image"
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="talent-pool-right">
          <div className="talent-table-header">
            <h3>Know Exactly Who's Ready</h3>

            <div className="talent-search">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="7" stroke="#8c909f" strokeWidth="2"/>
                <line x1="16" y1="16" x2="21" y2="21" stroke="#8c909f" strokeWidth="2" strokeLinecap="round"/>
              </svg>

              <input
                type="text"
                placeholder="Search candidates..."
                aria-label="Search candidates"
              />
            </div>
          </div>

          <div className="talent-table-wrapper">
            <table className="talent-table">
              <thead>
                <tr>
                  <th>CANDIDATE</th>
                  <th>PERFORMANCE</th>
                  <th>READINESS</th>
                  <th className="score-column">SCORE</th>
                </tr>
              </thead>

              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.name}>
                    <td>
                      <div className="candidate-profile">
                        <div
                          className={`candidate-initials ${candidate.type}`}
                        >
                          {candidate.initials}
                        </div>

                        <div>
                          <strong>{candidate.name}</strong>
                          <span>{candidate.department}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          candidate.performance === "High"
                            ? "performance-high"
                            : "performance-medium"
                        }
                      >
                        {candidate.performance}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`readiness-pill ${
                          candidate.readiness === "Ready Now"
                            ? "ready"
                            : "future"
                        }`}
                      >
                        {candidate.readiness}
                      </span>
                    </td>

                    <td className="candidate-score">
                      {candidate.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}