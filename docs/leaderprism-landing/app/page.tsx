"use client";

import { useEffect } from "react";
import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import LeadershipSteps from "../components/LeadershipSteps/LeadershipSteps";
import IntelligenceCore from "../components/IntelligenceCore/IntelligenceCore";
import AssessmentProcess from "../components/AssessmentProcess/AssessmentProcess";
import LeadershipAssessment from "../components/LeadershipAssessment/LeadershipAssessment";
import PersonalityProfiling from "../components/PersonalityProfiling/PersonalityProfiling";
import CompetencyEvaluation from "../components/CompetencyEvaluation/CompetencyEvaluation";
import ReadinessAssessment from "../components/ReadinessAssessment/ReadinessAssessment";
import AIAnalytics from "../components/AIAnalytics/AIAnalytics";
import SuccessionPlanning from "../components/SuccessionPlanning/SuccessionPlanning";
import TalentPool from "../components/TalentPool/TalentPool";
import EnterpriseAdmin from "../components/EnterpriseAdmin/EnterpriseAdmin";
import FinalCTA from "../components/FinalCTA/FinalCTA";
import Footer from "../components/Footer/Footer";

function FloatingParticles() {
  return (
    <div aria-hidden="true">
      <span className="floating-particle" />
      <span className="floating-particle" />
      <span className="floating-particle" />
      <span className="floating-particle" />
      <span className="floating-particle" />
      <span className="floating-particle" />
    </div>
  );
}

function PageEffects() {
  return (
    <>
      <div className="mouse-spotlight" aria-hidden="true" />
      <div className="page-vignette" aria-hidden="true" />
      <span className="light-streak" aria-hidden="true" />
      <span className="light-streak" aria-hidden="true" />
      <span className="light-streak" aria-hidden="true" />
    </>
  );
}


export default function Home() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const elements = Array.from(document.querySelectorAll<HTMLElement>(".scroll-hidden"));

    if (!elements.length) return;

    let scrolled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!scrolled) return;
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -6% 0px",
      }
    );

    const onScroll = () => {
      if (!scrolled) {
        scrolled = true;
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <>
      <FloatingParticles />
      <PageEffects />
      <Header />
      <Hero />
      <LeadershipSteps />
      <div className="scroll-hidden delay-2">
        <IntelligenceCore />
      </div>
      <div className="scroll-hidden delay-1">
        <AssessmentProcess />
      </div>
      <div className="scroll-hidden delay-2">
        <LeadershipAssessment />
      </div>
      <div className="scroll-hidden delay-1">
        <PersonalityProfiling />
      </div>
      <div className="scroll-hidden delay-2">
        <CompetencyEvaluation />
      </div>
      <div className="scroll-hidden delay-1">
        <ReadinessAssessment />
      </div>
      <div className="scroll-hidden delay-2">
        <AIAnalytics />
      </div>
      <div className="scroll-hidden delay-1">
        <SuccessionPlanning />
      </div>
      <div className="scroll-hidden delay-2">
        <TalentPool />
      </div>
      <div className="scroll-hidden delay-1">
        <EnterpriseAdmin />
      </div>
      <div className="scroll-hidden delay-2">
        <FinalCTA />
      </div>
      <div className="scroll-hidden">
        <Footer />
      </div>
    </>
  );
}