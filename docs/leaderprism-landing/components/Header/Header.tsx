"use client";

import { useEffect, useState } from "react";
import "./Header.css";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? "header-scrolled" : ""}`}>
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo">
          <div className="header-logo-icon">
            <img src="/images/Logo.png" alt="LeaderPrism Logo" className="header-logo-img" />
          </div>
          <span className="header-logo-text">LeaderPrism</span>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <a href="#capability-360">360° Feedback</a>
          <a href="#capability-personality">Personality</a>
          <a href="#capability-competency">Competencies</a>
          <a href="#capability-readiness">Readiness</a>
          <a href="#capability-analytics">AI Analytics</a>
        </nav>

        {/* Actions */}
        <div className="header-actions">
          <button className="sign-in-btn">Sign In</button>
          <button className="demo-btn">Book a Demo</button>
        </div>
      </div>
    </header>
  );
}