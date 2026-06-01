import { DataSource } from 'typeorm';
import { Item } from '../../assessment/items/entities/item.entity';

interface PersonalityItemData {
  factor: string;
  stem: string;
  isReverse: boolean;
}

// 60 Big Five items: 12 per factor, leadership-relevant statements
// Response scale: 1=Strongly Disagree, 2=Disagree, 3=Neutral, 4=Agree, 5=Strongly Agree
const PERSONALITY_ITEMS: PersonalityItemData[] = [
  // ── OPENNESS (12 items) ──────────────────────────────────────────────────
  { factor: 'openness', stem: 'I actively seek out new and unconventional approaches to solving problems.', isReverse: false },
  { factor: 'openness', stem: 'I enjoy exploring ideas outside my area of expertise.', isReverse: false },
  { factor: 'openness', stem: 'I am curious about trends and developments in industries other than my own.', isReverse: false },
  { factor: 'openness', stem: 'I find it stimulating to think about abstract concepts and possibilities.', isReverse: false },
  { factor: 'openness', stem: 'I regularly challenge assumptions and conventional wisdom.', isReverse: false },
  { factor: 'openness', stem: 'I enjoy work that requires creative or imaginative thinking.', isReverse: false },
  { factor: 'openness', stem: 'I prefer proven, established methods over experimental new approaches.', isReverse: true },
  { factor: 'openness', stem: 'I rarely find myself pondering philosophical or big-picture questions.', isReverse: true },
  { factor: 'openness', stem: 'I tend to stick to what I know rather than experimenting with new ideas.', isReverse: true },
  { factor: 'openness', stem: 'I find value in learning from disciplines very different from my own.', isReverse: false },
  { factor: 'openness', stem: 'Routine and predictable work suits me better than novel challenges.', isReverse: true },
  { factor: 'openness', stem: 'I embrace ambiguity as an opportunity to think creatively.', isReverse: false },

  // ── CONSCIENTIOUSNESS (12 items) ────────────────────────────────────────
  { factor: 'conscientiousness', stem: 'I always plan ahead and organise my work before beginning.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I consistently meet deadlines without needing reminders.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I pay close attention to detail to ensure my work is accurate.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I set high standards for my own performance and work hard to meet them.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I persist through obstacles rather than giving up when tasks become difficult.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I complete tasks thoroughly before moving on to the next one.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I sometimes neglect important tasks in favour of more enjoyable ones.', isReverse: true },
  { factor: 'conscientiousness', stem: 'I often leave tasks unfinished and struggle to follow through.', isReverse: true },
  { factor: 'conscientiousness', stem: 'I frequently misplace things or forget commitments I have made.', isReverse: true },
  { factor: 'conscientiousness', stem: 'I take a structured, disciplined approach to achieving my goals.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I regularly review my progress against goals and adjust my plans accordingly.', isReverse: false },
  { factor: 'conscientiousness', stem: 'I tend to put off important tasks until the last possible moment.', isReverse: true },

  // ── EXTRAVERSION (12 items) ─────────────────────────────────────────────
  { factor: 'extraversion', stem: 'I feel energised after interacting with a large group of people.', isReverse: false },
  { factor: 'extraversion', stem: 'I am comfortable taking the lead in group discussions and meetings.', isReverse: false },
  { factor: 'extraversion', stem: 'I naturally gravitate toward networking and meeting new people.', isReverse: false },
  { factor: 'extraversion', stem: 'I speak up confidently and share my views in group settings.', isReverse: false },
  { factor: 'extraversion', stem: 'I enjoy being at the centre of team activities and social events.', isReverse: false },
  { factor: 'extraversion', stem: 'I feel comfortable presenting ideas to large audiences.', isReverse: false },
  { factor: 'extraversion', stem: 'I prefer working alone to working in a team.', isReverse: true },
  { factor: 'extraversion', stem: 'After social interactions, I usually need time alone to recharge.', isReverse: true },
  { factor: 'extraversion', stem: 'I tend to stay in the background rather than seek visibility in groups.', isReverse: true },
  { factor: 'extraversion', stem: 'I thrive in dynamic, fast-paced social environments.', isReverse: false },
  { factor: 'extraversion', stem: 'I find it easy to start conversations with people I have never met.', isReverse: false },
  { factor: 'extraversion', stem: 'I am more comfortable observing than actively participating in group activities.', isReverse: true },

  // ── AGREEABLENESS (12 items) ─────────────────────────────────────────────
  { factor: 'agreeableness', stem: 'I genuinely care about the wellbeing of the people I work with.', isReverse: false },
  { factor: 'agreeableness', stem: 'I find it easy to trust and cooperate with colleagues.', isReverse: false },
  { factor: 'agreeableness', stem: 'I am willing to compromise my own preferences to support team harmony.', isReverse: false },
  { factor: 'agreeableness', stem: 'I actively listen and try to understand others\' perspectives before responding.', isReverse: false },
  { factor: 'agreeableness', stem: 'I show patience and empathy when dealing with difficult individuals.', isReverse: false },
  { factor: 'agreeableness', stem: 'I prefer to resolve conflicts collaboratively rather than competitively.', isReverse: false },
  { factor: 'agreeableness', stem: 'I can be blunt or critical in ways that others find off-putting.', isReverse: true },
  { factor: 'agreeableness', stem: 'I am often sceptical of other people\'s motives and intentions.', isReverse: true },
  { factor: 'agreeableness', stem: 'I tend to prioritise my own goals over the needs of the team.', isReverse: true },
  { factor: 'agreeableness', stem: 'I make an effort to acknowledge and support others\' contributions.', isReverse: false },
  { factor: 'agreeableness', stem: 'I avoid unnecessary conflict and work toward mutually beneficial solutions.', isReverse: false },
  { factor: 'agreeableness', stem: 'I sometimes dismiss others\' concerns as unimportant or exaggerated.', isReverse: true },

  // ── EMOTIONAL STABILITY (12 items, reverse = neuroticism items) ─────────
  { factor: 'emotional_stability', stem: 'I remain calm and composed when facing difficult situations or setbacks.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I recover quickly from disappointments and move forward productively.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I rarely feel overwhelmed even when managing multiple competing demands.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I maintain a stable, positive outlook even under significant pressure.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I manage my emotions effectively and avoid impulsive reactions.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I am confident in my ability to handle most challenges that arise at work.', isReverse: false },
  { factor: 'emotional_stability', stem: 'I often feel anxious or stressed when facing uncertain or high-pressure situations.', isReverse: true },
  { factor: 'emotional_stability', stem: 'I frequently worry about things that may go wrong in my work.', isReverse: true },
  { factor: 'emotional_stability', stem: 'My moods tend to fluctuate significantly throughout the working day.', isReverse: true },
  { factor: 'emotional_stability', stem: 'I sometimes react to criticism in ways I later regret.', isReverse: true },
  { factor: 'emotional_stability', stem: 'I feel generally content and resilient in my professional role.', isReverse: false },
  { factor: 'emotional_stability', stem: 'Minor setbacks or negative feedback can affect my performance for extended periods.', isReverse: true },
];

export async function seedPersonalityItems(dataSource: DataSource): Promise<void> {
  const itemRepo = dataSource.getRepository(Item);

  for (const itemData of PERSONALITY_ITEMS) {
    const existing = await itemRepo.findOne({
      where: { stem: itemData.stem, module: 'personality' },
    });
    if (existing) {
      continue;
    }

    const item = itemRepo.create({
      itemType: 'likert',
      module: 'personality',
      factor: itemData.factor,
      stem: itemData.stem,
      options: [
        { value: 1, label: 'Strongly Disagree' },
        { value: 2, label: 'Disagree' },
        { value: 3, label: 'Neutral' },
        { value: 4, label: 'Agree' },
        { value: 5, label: 'Strongly Agree' },
      ],
      scoringKey: null,
      isReverse: itemData.isReverse,
      language: 'en',
      isActive: true,
      organisationId: null as any,
    });

    await itemRepo.save(item);
  }
}
