import { DataSource } from 'typeorm';
import { Item } from '../../assessment/items/entities/item.entity';

export async function seedReadinessItems(dataSource: DataSource): Promise<void> {
  const itemRepo = dataSource.getRepository(Item);

  const sjtItems = [
    {
      factor: 'problem_solving',
      stem: 'You are leading a project team that is falling behind on a critical milestone due to conflicting priorities among members. How do you handle this?',
      options: [
        'Schedule an urgent alignment meeting to re-negotiate roles, clarify milestones, and align on project priorities.',
        'Escalate the issue to executive management to make a top-down decision on priorities.',
        'Let the team work through it on their own to foster autonomy and self-organization.',
        'Instruct members to work overtime to ensure all deadlines are met regardless of conflicts.',
      ],
      scoringKey: { '0': 4, '1': 2, '2': 1, '3': 0 },
    },
    {
      factor: 'interpersonal',
      stem: 'A direct report who has historically been a high performer is showing signs of disengagement and missing deadlines. What is your first step?',
      options: [
        'Initiate a private, supportive 1-on-1 discussion to understand any professional or personal challenges they are facing.',
        'Issue a formal performance improvement plan (PIP) immediately to signal the seriousness of the issue.',
        'Wait and see if their performance improves naturally over the next few weeks.',
        'Reassign their complex projects to other team members to ease their workload without talking to them.',
      ],
      scoringKey: { '0': 4, '1': 1, '2': 2, '3': 0 },
    },
    {
      factor: 'change_leadership',
      stem: 'During a major organizational transition, your team expresses high levels of anxiety and resistance to the new processes. How do you manage this change?',
      options: [
        'Hold transparent Q&A sessions to explain the vision, acknowledge their concerns, and involve them in designing the transition.',
        'Tell the team that change is inevitable and they must adapt or seek opportunities elsewhere.',
        'Downplay the changes and assure them that nothing significant will actually change.',
        'Implement the changes gradually without telling the team to avoid causing unnecessary worry.',
      ],
      scoringKey: { '0': 4, '1': 1, '2': 0, '3': 2 },
    },
  ];

  for (const itemData of sjtItems) {
    const existing = await itemRepo.findOne({
      where: { stem: itemData.stem, module: 'sjt' },
    });
    if (!existing) {
      const item = itemRepo.create({
        itemType: 'sjt',
        module: 'sjt',
        factor: itemData.factor,
        stem: itemData.stem,
        options: itemData.options as any,
        scoringKey: itemData.scoringKey,
        isReverse: false,
        language: 'en',
        isActive: true,
        organisationId: null,
      });
      await itemRepo.save(item);
    }
  }

  const laItems = [
    {
      factor: 'mental_agility',
      stem: 'I enjoy analysing complex, ambiguous situations to find unique solutions.',
    },
    {
      factor: 'people_agility',
      stem: 'I easily adapt my style to build constructive relationships with diverse groups of people.',
    },
    {
      factor: 'change_agility',
      stem: 'I actively seek out new and experimental ways to get tasks done.',
    },
    {
      factor: 'results_agility',
      stem: 'I remain focused on achieving high-quality results even in the face of unexpected obstacles.',
    },
  ];

  for (const itemData of laItems) {
    const existing = await itemRepo.findOne({
      where: { stem: itemData.stem, module: 'learning_agility' },
    });
    if (!existing) {
      const item = itemRepo.create({
        itemType: 'likert',
        module: 'learning_agility',
        factor: itemData.factor,
        stem: itemData.stem,
        options: null,
        scoringKey: null,
        isReverse: false,
        language: 'en',
        isActive: true,
        organisationId: null,
      });
      await itemRepo.save(item);
    }
  }
}
