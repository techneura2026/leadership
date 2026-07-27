import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          {/* BRAND */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img
                src="/images/logo.png"
                alt="LeaderPrism"
                className="footer-logo-img"
              />
              <span>LeaderPrism</span>
            </div>

            <p>
              Leadership intelligence for organizations building the leaders
              of tomorrow.
            </p>

            <div className="footer-highlight">
              <span>Trusted by modern people teams</span>
              <strong>From assessment to succession planning</strong>
            </div>
          </div>

          {/* PLATFORM */}
          <div className="footer-column">
            <h3>Platform</h3>

            <a href="#capability-360">360° Feedback</a>
            <a href="#capability-personality">Personality</a>
            <a href="#capability-competency">Competencies</a>
            <a href="#capability-readiness">Readiness</a>
            <a href="#capability-analytics">AI Analytics</a>
          </div>

          {/* COMPANY */}
          <div className="footer-column">
            <h3>Company</h3>

            <a href="#">About</a>
            <a href="#">Contact</a>
            <a href="#">Careers</a>
            <a href="#">Book a Demo</a>
          </div>

          {/* LEGAL */}
          <div className="footer-column">
            <h3>Legal</h3>

            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Security</a>
          </div>
        </div>

        {/* BOTTOM */}
        <div className="footer-bottom">
          <p>© 2026 Techneura Labs. All rights reserved.</p>

          <div className="footer-bottom-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}