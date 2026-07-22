import { getAppLoginUrl } from "@/lib/urls";
import "./FinalCTA.css";

export default function FinalCTA() {
  const loginUrl = getAppLoginUrl();

  return (
    <section className="final-cta">
      <div className="final-cta-glow"></div>

      <div className="final-cta-container">
        <h2>Ready to See Your Leadership Future Clearly?</h2>

        <p>
          Join forward-thinking organizations using LeaderPrism to build
          stronger leadership pipelines and make confident succession
          decisions.
        </p>

        <a href={loginUrl} className="final-cta-button">
          Book a Demo
          <span>→</span>
        </a>
      </div>
    </section>
  );
}