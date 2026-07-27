import "./LeadershipSteps.css";

const steps = [
  {
    number: "01",
    title: "Assess",
    description: "Run 360° reviews and competency evaluations effortlessly.",
  },
  {
    number: "02",
    title: "Analyze",
    description: "Our AI engines surface strengths and development areas.",
  },
  {
    number: "03",
    title: "Map",
    description: "Plot talent on the 9-box grid to see high-potential clear.",
  },
  {
    number: "04",
    title: "Select",
    description: "Identify candidates for critical leadership roles.",
  },
  {
    number: "05",
    title: "Pipeline Plan",
    description: "Establish long-term succession roadmaps with confidence.",
  },
];

export default function LeadershipSteps() {
  return (
    <section className="leadership-steps">
      <div className="leadership-steps-container">
        <h2 className="leadership-steps-title">
          Modern Leadership Planning in 5 Steps
        </h2>

        <div className="leadership-steps-grid">
          {steps.map((step) => (
            <div className="leadership-step" key={step.number}>
              <span className="leadership-step-number">{step.number}</span>

              <h3>{step.title}</h3>

              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}