import "./AIAnalytics.css";

export default function AIAnalytics() {
  return (
    <section className="ai-analytics-section" id="capability-analytics">
      <div className="ai-analytics-container">
        {/* HEADER */}
        <div className="ai-analytics-heading">
          <div className="ai-capability-label">
            <span className="ai-label-icon">✦</span>
            <span>CAPABILITY 05</span>
          </div>

          <h2>AI-Powered Analytics &amp; Intelligence.</h2>

          <p>
            Move beyond static reports. Our AI engine analyzes thousands of
            data points to identify trends, predict attrition risks, and
            highlight hidden &quot;dark horse&quot; leaders.
          </p>
        </div>

        {/* DASHBOARD */}
        <div className="ai-dashboard-wrapper">
          <div className="ai-dashboard-glow"></div>

          <div className="ai-dashboard">
            <video
              className="ai-dashboard-video"
              autoPlay
              loop
              muted
              playsInline
              poster="/images/analytics-img.png"
            >
              <source src="/videos/dash-video.mp4" type="video/mp4" />
            </video>

            <div className="ai-dashboard-overlay"></div>

            {/* FLOATING CARDS */}
            <div className="ai-insight-cards">
              <div className="ai-insight-card">
                <div className="ai-insight-icon primary">
                  ↗
                </div>

                <div>
                  <span>PREDICTIVE INSIGHTS</span>
                  <p>Succession readiness projection 24mo out.</p>
                </div>
              </div>

              <div className="ai-insight-card">
                <div className="ai-insight-icon tertiary">
                  ✦
                </div>

                <div>
                  <span>BIAS DETECTION</span>
                  <p>
                    Automatic identification of rating discrepancies.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}