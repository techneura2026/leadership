import { DataSource } from 'typeorm';
import { CompetencyDomain } from '../../assessment/items/entities/competency-domain.entity';
import { Competency } from '../../assessment/items/entities/competency.entity';
import { CompetencyLevel } from '../../assessment/items/entities/competency-level.entity';
import { CompetencyBehaviour } from '../../assessment/items/entities/competency-behaviour.entity';

interface DomainSeedData {
  name: string;
  code: string;
  colour: string;
  displayOrder: number;
  competencies: CompetencySeedData[];
}

interface CompetencySeedData {
  name: string;
  description: string;
  displayOrder: number;
  levels: LevelSeedData[];
  behaviours: string[];
}

interface LevelSeedData {
  level: number;
  label: string;
  description: string;
  indicators: string[];
}

const FRAMEWORK: DomainSeedData[] = [
  {
    name: 'Communication & Influence',
    code: 'COMM',
    colour: '#3B82F6',
    displayOrder: 1,
    competencies: [
      {
        name: 'Verbal & Written Communication',
        description: 'Conveys ideas clearly and persuasively in both spoken and written form.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Communicates basic information with some clarity gaps.', indicators: ['Uses simple language', 'Occasionally unclear', 'Listens passively'] },
          { level: 2, label: 'Proficient', description: 'Communicates clearly and adjusts style to the audience.', indicators: ['Clear and structured messages', 'Adapts tone to audience', 'Active listening'] },
          { level: 3, label: 'Advanced', description: 'Influences others through compelling communication.', indicators: ['Crafts persuasive arguments', 'Handles difficult conversations', 'Tailors complex messages'] },
          { level: 4, label: 'Expert', description: 'Sets the communication standard for the organisation.', indicators: ['Inspires through narrative', 'Masters all communication channels', 'Coaches others on communication'] },
        ],
        behaviours: [
          'Presents information in a clear, structured, and logical manner',
          'Adapts communication style to suit different audiences and contexts',
          'Listens attentively and asks clarifying questions before responding',
          'Writes concise and professional documents, reports, and emails',
          'Uses storytelling and examples to make complex ideas accessible',
        ],
      },
      {
        name: 'Stakeholder Engagement',
        description: 'Builds and maintains productive relationships with key stakeholders.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Engages with immediate stakeholders with guidance.', indicators: ['Identifies key stakeholders', 'Seeks direction on engagement', 'Responds to stakeholder needs'] },
          { level: 2, label: 'Proficient', description: 'Proactively manages stakeholder relationships.', indicators: ['Maps stakeholder interests', 'Communicates updates proactively', 'Manages expectations'] },
          { level: 3, label: 'Advanced', description: 'Builds strategic alliances and navigates complex stakeholder landscapes.', indicators: ['Negotiates mutually beneficial outcomes', 'Manages conflicting interests', 'Builds trust with senior stakeholders'] },
          { level: 4, label: 'Expert', description: 'Shapes stakeholder ecosystems and influences at the board level.', indicators: ['Builds enterprise-wide coalitions', 'Represents the organisation externally', 'Creates stakeholder value'] },
        ],
        behaviours: [
          'Proactively identifies and maps key stakeholders and their interests',
          'Builds trust-based relationships through consistent follow-through',
          'Communicates relevant information to stakeholders in a timely manner',
          'Navigates conflicting stakeholder interests diplomatically',
          'Represents the organisation professionally in external forums',
        ],
      },
    ],
  },
  {
    name: 'Team Leadership & Development',
    code: 'TEAM',
    colour: '#10B981',
    displayOrder: 2,
    competencies: [
      {
        name: 'Team Building & Motivation',
        description: 'Creates a cohesive, motivated team with a shared sense of purpose.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Supports team cohesion under direction.', indicators: ['Participates in team activities', 'Acknowledges team contributions', 'Follows team norms'] },
          { level: 2, label: 'Proficient', description: 'Actively fosters team collaboration and morale.', indicators: ['Recognises individual strengths', 'Facilitates inclusive discussions', 'Celebrates team wins'] },
          { level: 3, label: 'Advanced', description: 'Builds high-performing teams with strong culture.', indicators: ['Creates psychological safety', 'Manages team dynamics proactively', 'Develops shared team identity'] },
          { level: 4, label: 'Expert', description: 'Builds elite teams that consistently exceed expectations.', indicators: ['Designs team structures for performance', 'Attracts top talent', 'Builds cross-functional teams'] },
        ],
        behaviours: [
          'Creates a safe and inclusive environment where every team member feels valued',
          'Recognises and leverages the unique strengths of each team member',
          'Sets clear team goals and ensures alignment with organisational objectives',
          'Facilitates open dialogue and constructive debate within the team',
          'Celebrates team and individual achievements to sustain motivation',
        ],
      },
      {
        name: 'Coaching & Developing Others',
        description: 'Actively develops the capabilities of direct reports and colleagues.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Provides basic guidance when asked.', indicators: ['Shares knowledge when requested', 'Supports onboarding', 'Gives simple feedback'] },
          { level: 2, label: 'Proficient', description: 'Coaches individuals and provides developmental feedback.', indicators: ['Conducts regular 1:1s', 'Sets development goals', 'Provides timely feedback'] },
          { level: 3, label: 'Advanced', description: 'Develops talent pipeline and coaches for senior roles.', indicators: ['Creates individual development plans', 'Sponsors high-potential staff', 'Shares stretch assignments'] },
          { level: 4, label: 'Expert', description: 'Establishes a coaching culture across the organisation.', indicators: ['Mentors senior leaders', 'Designs leadership development programmes', 'Creates succession pipeline'] },
        ],
        behaviours: [
          'Provides regular, specific, and balanced feedback to support growth',
          'Coaches team members to solve problems independently rather than providing answers',
          'Identifies learning and stretch opportunities aligned to development goals',
          'Creates personalised development plans with clear milestones',
          'Invests time in mentoring and sponsoring high-potential individuals',
        ],
      },
    ],
  },
  {
    name: 'Decision Making & Problem Solving',
    code: 'DECS',
    colour: '#F59E0B',
    displayOrder: 3,
    competencies: [
      {
        name: 'Analytical Thinking',
        description: 'Breaks down complex problems and uses data to inform decisions.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Analyses straightforward problems with guidance.', indicators: ['Gathers basic data', 'Identifies obvious causes', 'Uses provided frameworks'] },
          { level: 2, label: 'Proficient', description: 'Analyses multifaceted problems and identifies root causes.', indicators: ['Uses structured problem-solving', 'Interprets data accurately', 'Considers multiple options'] },
          { level: 3, label: 'Advanced', description: 'Applies advanced analytical techniques to ambiguous problems.', indicators: ['Synthesises diverse data sets', 'Identifies non-obvious patterns', 'Builds predictive models'] },
          { level: 4, label: 'Expert', description: 'Sets analytical standards and solves enterprise-level problems.', indicators: ['Creates analytical frameworks', 'Leads complex investigations', 'Trains others in analytics'] },
        ],
        behaviours: [
          'Breaks down complex problems into manageable components before acting',
          'Gathers relevant data and evidence before drawing conclusions',
          'Identifies root causes rather than treating surface-level symptoms',
          'Evaluates multiple options against defined criteria before deciding',
          'Uses quantitative and qualitative data to support recommendations',
        ],
      },
      {
        name: 'Decisive Judgment',
        description: 'Makes timely, well-reasoned decisions even under ambiguity and pressure.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Makes routine decisions with guidance.', indicators: ['Follows established procedures', 'Escalates when uncertain', 'Makes decisions with full information'] },
          { level: 2, label: 'Proficient', description: 'Makes sound decisions independently under moderate uncertainty.', indicators: ['Weighs risks and benefits', 'Decides within reasonable timeframes', 'Stands by decisions'] },
          { level: 3, label: 'Advanced', description: 'Makes high-stakes decisions under significant ambiguity.', indicators: ['Comfortable with incomplete information', 'Manages decision risk actively', 'Reverses decisions when new data emerges'] },
          { level: 4, label: 'Expert', description: 'Makes organisationally defining decisions with strategic foresight.', indicators: ['Sets decision-making frameworks', 'Balances short and long-term implications', 'Accepts accountability for outcomes'] },
        ],
        behaviours: [
          'Makes timely decisions without being paralysed by incomplete information',
          'Clearly articulates the rationale behind important decisions',
          'Appropriately escalates decisions that require senior authorisation',
          'Takes calculated risks and owns the outcomes regardless of result',
          'Revisits and adjusts decisions when new evidence emerges',
        ],
      },
    ],
  },
  {
    name: 'Strategic Thinking',
    code: 'STRA',
    colour: '#8B5CF6',
    displayOrder: 4,
    competencies: [
      {
        name: 'Vision & Long-Term Planning',
        description: 'Thinks beyond immediate tasks to articulate and pursue a compelling long-term direction.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Understands team goals and links work to broader strategy.', indicators: ['Connects daily tasks to strategy', 'Understands department objectives', 'Asks strategic questions'] },
          { level: 2, label: 'Proficient', description: 'Contributes to and executes departmental strategic plans.', indicators: ['Translates strategy to action plans', 'Anticipates one-year horizon', 'Aligns resources to priorities'] },
          { level: 3, label: 'Advanced', description: 'Shapes divisional strategy and drives organisational alignment.', indicators: ['Develops multi-year plans', 'Identifies strategic opportunities', 'Influences strategic direction'] },
          { level: 4, label: 'Expert', description: 'Sets organisational vision and navigates the competitive landscape.', indicators: ['Articulates inspiring vision', 'Makes strategic portfolio decisions', 'Anticipates industry disruptions'] },
        ],
        behaviours: [
          'Thinks at least two to three years ahead when planning initiatives',
          'Connects team objectives to the wider organisational strategy',
          'Scans the external environment for emerging trends and opportunities',
          'Translates strategic intent into actionable operational plans',
          'Challenges conventional thinking to identify transformative possibilities',
        ],
      },
      {
        name: 'Business & Commercial Acumen',
        description: 'Understands business economics and makes commercially sound decisions.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Understands basic business concepts relevant to the role.', indicators: ['Understands budget basics', 'Aware of revenue and costs', 'Manages resources carefully'] },
          { level: 2, label: 'Proficient', description: 'Applies sound commercial judgment in day-to-day decisions.', indicators: ['Manages team budget', 'Identifies efficiency opportunities', 'Tracks key business metrics'] },
          { level: 3, label: 'Advanced', description: 'Drives business growth and commercial performance.', indicators: ['Develops business cases', 'Manages P&L', 'Identifies market opportunities'] },
          { level: 4, label: 'Expert', description: 'Sets commercial strategy and creates sustainable competitive advantage.', indicators: ['Shapes commercial models', 'Leads major negotiations', 'Manages investor relationships'] },
        ],
        behaviours: [
          'Understands the key financial and commercial drivers of the business',
          'Makes decisions with a clear awareness of cost, value, and ROI',
          'Identifies opportunities to improve efficiency and commercial performance',
          'Develops well-structured business cases supported by financial analysis',
          'Monitors market trends and competitor activity to inform strategy',
        ],
      },
    ],
  },
  {
    name: 'Emotional Intelligence',
    code: 'EMOT',
    colour: '#EC4899',
    displayOrder: 5,
    competencies: [
      {
        name: 'Self-Awareness & Regulation',
        description: 'Understands own emotions, strengths, and triggers, and manages reactions effectively.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Shows basic awareness of own emotional responses.', indicators: ['Recognises own emotions', 'Manages reactions in low-stress situations', 'Seeks feedback occasionally'] },
          { level: 2, label: 'Proficient', description: 'Manages emotions effectively and uses feedback for growth.', indicators: ['Maintains composure under pressure', 'Acts on developmental feedback', 'Reflects on own behaviour'] },
          { level: 3, label: 'Advanced', description: 'Demonstrates deep self-awareness and models emotional regulation.', indicators: ['Consistently composed under high pressure', 'Proactively manages personal biases', 'Develops others\' self-awareness'] },
          { level: 4, label: 'Expert', description: 'Uses emotional intelligence as a leadership superpower.', indicators: ['Reads organisational emotional climate', 'Shapes culture through emotional leadership', 'Coaches leaders on EI'] },
        ],
        behaviours: [
          'Remains calm and composed when faced with setbacks or criticism',
          'Recognises own emotional triggers and manages reactions proactively',
          'Seeks and acts on honest feedback about personal impact on others',
          'Demonstrates consistency between stated values and observable behaviour',
          'Reflects thoughtfully before responding in emotionally charged situations',
        ],
      },
      {
        name: 'Empathy & Social Awareness',
        description: 'Understands and responds appropriately to the emotions and perspectives of others.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Shows basic awareness of others\' feelings.', indicators: ['Notices when others are distressed', 'Avoids dismissive behaviour', 'Adjusts tone when needed'] },
          { level: 2, label: 'Proficient', description: 'Empathises with diverse perspectives and responds supportively.', indicators: ['Actively listens without judgment', 'Validates others\' experiences', 'Reads group dynamics'] },
          { level: 3, label: 'Advanced', description: 'Creates psychologically safe environments through empathic leadership.', indicators: ['Pre-empts others\' concerns', 'Navigates sensitive issues with care', 'Champions wellbeing at work'] },
          { level: 4, label: 'Expert', description: 'Shapes inclusive cultures where all feel seen and valued.', indicators: ['Designs inclusive practices', 'Advocates for marginalised voices', 'Models compassionate leadership'] },
        ],
        behaviours: [
          'Listens to understand rather than to respond during conversations',
          'Acknowledges and validates the feelings and concerns of others',
          'Adjusts leadership approach based on the needs of individuals',
          'Shows genuine interest in the wellbeing of team members',
          'Creates an environment where people feel safe to raise concerns',
        ],
      },
    ],
  },
  {
    name: 'Accountability & Integrity',
    code: 'ACCT',
    colour: '#6366F1',
    displayOrder: 6,
    competencies: [
      {
        name: 'Personal Accountability',
        description: 'Takes full ownership of commitments, actions, and outcomes.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Takes responsibility for assigned tasks.', indicators: ['Completes assigned work on time', 'Acknowledges own errors', 'Meets basic commitments'] },
          { level: 2, label: 'Proficient', description: 'Consistently delivers on commitments and holds self accountable.', indicators: ['Proactively flags risks to commitments', 'Owns mistakes openly', 'Follows through without reminders'] },
          { level: 3, label: 'Advanced', description: 'Models accountability and drives a culture of ownership.', indicators: ['Holds team to high standards', 'Accepts accountability for team failures', 'Sets clear performance expectations'] },
          { level: 4, label: 'Expert', description: 'Embeds accountability culture across the enterprise.', indicators: ['Designs accountability frameworks', 'Creates transparent performance cultures', 'Publicly owns organisational outcomes'] },
        ],
        behaviours: [
          'Delivers on commitments without needing to be reminded or chased',
          'Owns mistakes openly and focuses on learning rather than blame',
          'Proactively communicates when timelines or outcomes are at risk',
          'Holds self and others to consistent and fair performance standards',
          'Takes responsibility for team outcomes regardless of individual contribution',
        ],
      },
      {
        name: 'Ethics & Integrity',
        description: 'Demonstrates consistent ethical behaviour aligned with organisational values.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Adheres to policies and avoids ethical breaches.', indicators: ['Follows code of conduct', 'Reports unethical behaviour', 'Acts honestly in low-stakes situations'] },
          { level: 2, label: 'Proficient', description: 'Demonstrates consistent integrity in all professional interactions.', indicators: ['Maintains confidentiality', 'Acts consistently regardless of observation', 'Speaks up against unethical behaviour'] },
          { level: 3, label: 'Advanced', description: 'Champions ethical standards and builds an integrity culture.', indicators: ['Challenges unethical norms', 'Creates ethical decision-making frameworks', 'Role-models values under pressure'] },
          { level: 4, label: 'Expert', description: 'Sets the moral compass for the organisation.', indicators: ['Shapes governance frameworks', 'Takes ethical stands publicly', 'Builds trust with all stakeholders'] },
        ],
        behaviours: [
          'Acts with honesty and transparency in all professional dealings',
          'Upholds ethical standards even when it is personally costly to do so',
          'Challenges practices that conflict with organisational values',
          'Treats all people fairly regardless of their seniority or background',
          'Maintains strict confidentiality on sensitive information',
        ],
      },
    ],
  },
  {
    name: 'Change & Innovation',
    code: 'CHNG',
    colour: '#F97316',
    displayOrder: 7,
    competencies: [
      {
        name: 'Leading Change',
        description: 'Guides individuals and teams through organisational change with energy and confidence.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Adapts to change and supports others through transitions.', indicators: ['Adapts own behaviour to change', 'Supports team during transitions', 'Stays positive during uncertainty'] },
          { level: 2, label: 'Proficient', description: 'Plans and communicates change effectively.', indicators: ['Develops change plans', 'Addresses resistance proactively', 'Communicates change rationale'] },
          { level: 3, label: 'Advanced', description: 'Leads complex transformational change programmes.', indicators: ['Manages organisational change at scale', 'Builds change capability in teams', 'Sustains momentum through resistance'] },
          { level: 4, label: 'Expert', description: 'Architects enterprise-wide transformations.', indicators: ['Designs transformation strategies', 'Creates agile organisations', 'Leads culture change programmes'] },
        ],
        behaviours: [
          'Communicates the purpose and benefits of change clearly and compellingly',
          'Addresses resistance to change empathetically and constructively',
          'Maintains energy and optimism when leading through uncertainty',
          'Creates a clear roadmap with milestones to guide change implementation',
          'Celebrates early wins to build momentum and confidence in change',
        ],
      },
      {
        name: 'Innovation & Creative Thinking',
        description: 'Generates novel ideas and creates an environment where innovation thrives.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Contributes ideas and embraces new ways of working.', indicators: ['Suggests process improvements', 'Tries new approaches', 'Supports others\' ideas'] },
          { level: 2, label: 'Proficient', description: 'Generates practical innovations that improve performance.', indicators: ['Identifies inefficiencies and designs solutions', 'Tests and iterates ideas', 'Encourages team creativity'] },
          { level: 3, label: 'Advanced', description: 'Creates systemic innovations with measurable business impact.', indicators: ['Leads innovation projects', 'Builds cross-functional idea pipelines', 'Manages innovation risk'] },
          { level: 4, label: 'Expert', description: 'Builds innovation as an organisational competency.', indicators: ['Designs innovation ecosystems', 'Creates culture of experimentation', 'Leads disruptive initiatives'] },
        ],
        behaviours: [
          'Regularly challenges the status quo and asks "how can we do this better?"',
          'Generates creative ideas and encourages the same in team members',
          'Tests new approaches on a small scale before broader implementation',
          'Creates space for experimentation and views failure as a learning opportunity',
          'Connects ideas from outside the industry to solve internal challenges',
        ],
      },
    ],
  },
  {
    name: 'Results Orientation',
    code: 'RESL',
    colour: '#EF4444',
    displayOrder: 8,
    competencies: [
      {
        name: 'Execution & Delivery',
        description: 'Drives consistent delivery of high-quality outcomes on time and within scope.',
        displayOrder: 1,
        levels: [
          { level: 1, label: 'Developing', description: 'Completes assigned tasks to acceptable quality standards.', indicators: ['Meets deadlines with guidance', 'Produces acceptable quality work', 'Follows established processes'] },
          { level: 2, label: 'Proficient', description: 'Delivers consistently high-quality outcomes independently.', indicators: ['Meets deadlines without prompting', 'Manages own workload effectively', 'Proactively addresses blockers'] },
          { level: 3, label: 'Advanced', description: 'Drives team delivery and removes systemic blockers to performance.', indicators: ['Manages complex project delivery', 'Optimises team workflow', 'Delivers under resource constraints'] },
          { level: 4, label: 'Expert', description: 'Sets execution standards and builds delivery capability across the organisation.', indicators: ['Designs high-performance operating models', 'Leads delivery transformation', 'Creates accountability systems'] },
        ],
        behaviours: [
          'Sets clear goals with measurable success criteria for all key work',
          'Manages own time and priorities effectively to deliver consistently',
          'Identifies and removes blockers that impede team performance',
          'Maintains quality standards even under time and resource pressure',
          'Tracks progress against targets and takes corrective action when needed',
        ],
      },
      {
        name: 'Goal Setting & Performance Focus',
        description: 'Sets ambitious yet achievable goals and drives relentless focus on outcomes.',
        displayOrder: 2,
        levels: [
          { level: 1, label: 'Developing', description: 'Works towards goals set by others.', indicators: ['Understands assigned objectives', 'Tracks own progress', 'Reports on goal status'] },
          { level: 2, label: 'Proficient', description: 'Sets and achieves meaningful individual and team goals.', indicators: ['Sets SMART goals', 'Monitors KPIs', 'Adjusts approach to stay on track'] },
          { level: 3, label: 'Advanced', description: 'Sets stretching goals that drive organisational performance.', indicators: ['Cascades strategic goals to teams', 'Drives a high-performance culture', 'Benchmarks against best-in-class'] },
          { level: 4, label: 'Expert', description: 'Designs performance management systems that drive enterprise results.', indicators: ['Sets organisational OKRs', 'Creates performance review frameworks', 'Builds performance cultures'] },
        ],
        behaviours: [
          'Sets specific, measurable, and time-bound goals aligned to organisational priorities',
          'Regularly reviews progress against goals and adjusts plans as needed',
          'Stretches team members with ambitious yet achievable performance targets',
          'Maintains focus on priority outcomes without being distracted by low-value tasks',
          'Holds regular performance conversations to ensure alignment and accountability',
        ],
      },
    ],
  },
];

export async function seedCompetencyFramework(dataSource: DataSource): Promise<void> {
  const domainRepo = dataSource.getRepository(CompetencyDomain);
  const competencyRepo = dataSource.getRepository(Competency);
  const levelRepo = dataSource.getRepository(CompetencyLevel);
  const behaviourRepo = dataSource.getRepository(CompetencyBehaviour);

  for (const domainData of FRAMEWORK) {
    const existing = await domainRepo.findOne({ where: { code: domainData.code, organisationId: null as any } });
    if (existing) {
      continue;
    }

    const domain = domainRepo.create({
      name: domainData.name,
      code: domainData.code,
      colour: domainData.colour,
      displayOrder: domainData.displayOrder,
      organisationId: null as any,
    });
    const savedDomain = await domainRepo.save(domain);

    for (const compData of domainData.competencies) {
      const competency = competencyRepo.create({
        name: compData.name,
        description: compData.description,
        displayOrder: compData.displayOrder,
        domainId: savedDomain.id,
        organisationId: null as any,
        isActive: true,
      });
      const savedComp = await competencyRepo.save(competency);

      for (const levelData of compData.levels) {
        const level = levelRepo.create({
          competencyId: savedComp.id,
          level: levelData.level,
          label: levelData.label,
          description: levelData.description,
          indicators: levelData.indicators,
        });
        await levelRepo.save(level);
      }

      for (let i = 0; i < compData.behaviours.length; i++) {
        const behaviour = behaviourRepo.create({
          competencyId: savedComp.id,
          statement: compData.behaviours[i],
          displayOrder: i + 1,
        });
        await behaviourRepo.save(behaviour);
      }
    }
  }
}
