import "./AssessmentProcess.css";

const assessmentSteps = [
  { number: "1", title: "Create Assessment", active: "primary" },
  { number: "2", title: "Choose Competencies" },
  { number: "3", title: "Invite Participants" },
  { number: "4", title: "Collect Feedback" },
  { number: "5", title: "Generate Reports" },
  { number: "6", title: "Develop Talent", active: "tertiary" },
];

export default function AssessmentProcess() {
  return (
    <section className="assessment-process">
      <div className="assessment-process-container">
        {/* Heading */}
        <div className="assessment-process-heading">
          <h2>From Assessment to Actionable Insight.</h2>
          <p>Six simple steps to transform your leadership pipeline.</p>
        </div>

        {/* Timeline */}
        <div className="assessment-timeline">
          <div className="assessment-line"></div>

          <div className="assessment-steps">
            {assessmentSteps.map((step) => (
              <div className="assessment-step" key={step.number}>
                <div
                  className={`assessment-step-circle ${
                    step.active === "primary"
                      ? "assessment-step-primary"
                      : step.active === "tertiary"
                        ? "assessment-step-tertiary"
                        : ""
                  }`}
                >
                  {step.number}
                </div>

                <p>{step.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}