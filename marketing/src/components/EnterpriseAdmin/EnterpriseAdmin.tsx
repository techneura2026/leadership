import "./EnterpriseAdmin.css";

const adminItems = [
  {
    icon: "♙",
    title: "User Management",
    description: "Manage users, roles and access.",
  },
  {
    icon: "▦",
    title: "Assessment Templates",
    description: "Configure reusable assessment frameworks.",
  },
  {
    icon: "⌘",
    title: "Organization Structure",
    description: "Map departments and reporting lines.",
  },
  {
    icon: "⚙",
    title: "System Settings",
    description: "Customize platform preferences.",
  },
];

export default function EnterpriseAdmin() {
  return (
    <section className="enterprise-section">
      <div className="enterprise-container">
        {/* LEFT - ADMIN CONSOLE */}
        <div className="enterprise-console-wrapper">
          <div className="enterprise-console-glow"></div>

          <div className="enterprise-console">
            <div className="enterprise-console-header">
              <div>
                <span className="console-label">ADMINISTRATION</span>
                <h3>Enterprise Settings</h3>
              </div>

              <div className="console-status">
                <span className="status-dot"></span>
                Active
              </div>
            </div>

            <div className="enterprise-admin-list">
              {adminItems.map((item, index) => (
                <div
                  className={`enterprise-admin-item ${
                    index === 0 ? "enterprise-admin-item-active" : ""
                  }`}
                  key={item.title}
                >
                  <div className="enterprise-admin-icon">
                    {item.icon}
                  </div>

                  <div className="enterprise-admin-info">
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>

                  <span className="enterprise-admin-arrow">›</span>
                </div>
              ))}
            </div>

            <div className="enterprise-console-footer">
              <div>
                <span>PLATFORM HEALTH</span>
                <strong>All systems operational</strong>
              </div>

              <div className="health-indicator">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="enterprise-content">
          <div className="enterprise-capability-label">
            <span className="enterprise-label-icon">▦</span>
            <span>CAPABILITY 08</span>
          </div>

          <h2>Enterprise Administration &amp; Scale.</h2>

          <p className="enterprise-description">
            Built for complex organizations. Manage users, permissions,
            organizational structures, assessment frameworks, and leadership
            programs from one secure administrative environment.
          </p>

          <div className="enterprise-features">
            <div className="enterprise-feature">
              <div className="enterprise-feature-icon">✓</div>

              <div>
                <h3>Role-Based Access</h3>
                <p>
                  Control permissions across HR teams, managers, and
                  administrators.
                </p>
              </div>
            </div>

            <div className="enterprise-feature">
              <div className="enterprise-feature-icon">✓</div>

              <div>
                <h3>Organization-Wide Scale</h3>
                <p>
                  Support leadership programs across teams, departments, and
                  regions.
                </p>
              </div>
            </div>

            <div className="enterprise-feature">
              <div className="enterprise-feature-icon">✓</div>

              <div>
                <h3>Secure &amp; Configurable</h3>
                <p>
                  Adapt LeaderPrism to your organization&apos;s governance and
                  talent processes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}