'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { AssessmentChatbot, type GeneratedQuestion } from '@/components/AssessmentChatbot';
import {
  AssessmentType,
  CompetencyDto,
  UserDto,
} from '@leaderprism/shared';

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'TABLE';
type RaterRelationship = 'SUPERVISOR' | 'PEER' | 'DIRECT_REPORT';

interface QuestionOption {
  id: string;
  text: string;
}

interface FormQuestion {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: QuestionOption[];
  tableRows: string[];
  tableColumns: string[];
}

interface RaterEntry {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  relationship: RaterRelationship;
}

interface Participant360 {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  raters: RaterEntry[];
}

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  type: AssessmentType | null;
  title: string;
  startDate: string;
  endDate: string;
  isRatingMandatory: boolean;
  competencyIds: string[];
  participantIds: string[];
  participants360: Participant360[];
  questions: FormQuestion[];
  selectedCategories: string[];
  competencyQuestions: Record<string, FormQuestion[]>;
  personalityTraits: string[];
  personalityQuestions: Record<string, FormQuestion[]>;
  readinessDimensions: string[];
  readinessQuestions: Record<string, FormQuestion[]>;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const TypeIcon360 = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
  </svg>
);
const TypeIconCompetency = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);
const TypeIconPersonality = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);
const TypeIconReadiness = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);

const TYPE_ICONS: Record<string, () => React.JSX.Element> = {
  [AssessmentType.FEEDBACK_360]: TypeIcon360,
  [AssessmentType.COMPETENCY]: TypeIconCompetency,
  [AssessmentType.PERSONALITY]: TypeIconPersonality,
  [AssessmentType.READINESS]: TypeIconReadiness,
};

const TYPE_OPTIONS = [
  {
    type: AssessmentType.FEEDBACK_360,
    label: '360° Feedback',
    description: 'Gather multi-rater feedback from supervisors, peers and direct reports.',
  },
  {
    type: AssessmentType.COMPETENCY,
    label: 'Competency Assessment',
    description: 'Evaluate proficiency levels across defined competency frameworks.',
  },
  {
    type: AssessmentType.PERSONALITY,
    label: 'Personality Assessment',
    description: 'Measure personality traits using validated psychometric questionnaires.',
  },
  {
    type: AssessmentType.READINESS,
    label: 'Readiness Assessment',
    description: 'Assess readiness for leadership roles using SJT and learning agility.',
  },
];

const STEPS_DEFAULT = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Competencies' },
  { n: 4, label: 'Participants' },
  { n: 5, label: 'Review' },
];

const STEPS_360 = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Participants' },
  { n: 4, label: 'Questions' },
  { n: 5, label: 'Review' },
];

const STEPS_COMPETENCY = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Categories' },
  { n: 4, label: 'Questions' },
  { n: 5, label: 'Participants' },
  { n: 6, label: 'Review' },
];

const STEPS_PERSONALITY = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Traits' },
  { n: 4, label: 'Questions' },
  { n: 5, label: 'Participants' },
  { n: 6, label: 'Review' },
];

const STEPS_READINESS = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Dimensions' },
  { n: 4, label: 'Questions' },
  { n: 5, label: 'Participants' },
  { n: 6, label: 'Review' },
];

const COMPETENCY_CATEGORIES = [
  { id: 'communication', name: 'Communication', description: 'Convey ideas clearly, listen actively, and adapt messaging to different audiences.', iconPath: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 .794-.4 48.8 48.8 0 0 0 5.606-.367 2.25 2.25 0 0 0 1.973-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v4.5', color: 'blue' },
  { id: 'decision_making', name: 'Decision-making', description: 'Evaluate options, assess risks, and make timely, sound, and well-reasoned decisions.', iconPath: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.97Z', color: 'violet' },
  { id: 'strategic_thinking', name: 'Strategic Thinking', description: 'Develop long-term vision, anticipate trends, and align actions with organisational goals.', iconPath: 'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18', color: 'amber' },
  { id: 'team_management', name: 'Team Management', description: 'Build cohesive teams, delegate effectively, and foster collaboration and accountability.', iconPath: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z', color: 'cyan' },
  { id: 'problem_solving', name: 'Problem-solving', description: 'Identify root causes, generate creative solutions, and implement effective resolutions.', iconPath: 'M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z', color: 'emerald' },
  { id: 'emotional_intelligence', name: 'Emotional Intelligence', description: 'Recognise, understand, and manage emotions and empathise effectively with others.', iconPath: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z', color: 'pink' },
  { id: 'conflict_resolution', name: 'Conflict Resolution', description: 'Navigate disagreements constructively and facilitate mutually beneficial outcomes.', iconPath: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5', color: 'orange' },
  { id: 'accountability', name: 'Accountability', description: 'Take ownership of outcomes, follow through on commitments, and lead by example.', iconPath: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z', color: 'teal' },
  { id: 'adaptability', name: 'Adaptability', description: 'Embrace change, pivot strategies, and thrive in dynamic and uncertain environments.', iconPath: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182', color: 'sky' },
  { id: 'coaching_mentoring', name: 'Coaching & Mentoring', description: 'Develop talent, provide growth-focused feedback, and empower others to reach their potential.', iconPath: 'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5', color: 'rose' },
];

const PERSONALITY_TRAITS = [
  {
    id: 'openness',
    name: 'Openness',
    description: 'Curiosity, creativity, and openness to new ideas, experiences, and perspectives.',
    iconPath: 'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    color: 'violet',
  },
  {
    id: 'conscientiousness',
    name: 'Conscientiousness',
    description: 'Organisation, dependability, and self-discipline in goal-directed behaviour.',
    iconPath: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    color: 'blue',
  },
  {
    id: 'extraversion',
    name: 'Extraversion',
    description: 'Sociability, assertiveness, and positive energy in social interactions and group settings.',
    iconPath: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    color: 'amber',
  },
  {
    id: 'agreeableness',
    name: 'Agreeableness',
    description: 'Compassion, cooperativeness, and trust in interpersonal relationships.',
    iconPath: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
    color: 'emerald',
  },
  {
    id: 'emotional_stability',
    name: 'Emotional Stability',
    description: 'Resilience under stress and ability to regulate emotions — inverse of Neuroticism.',
    iconPath: 'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605',
    color: 'rose',
  },
];

const READINESS_DIMENSIONS = [
  {
    id: 'strategic_vision',
    name: 'Strategic Vision',
    description: 'Ability to think long-term, anticipate trends, and align organisational direction.',
    iconPath: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    color: 'blue',
  },
  {
    id: 'learning_agility',
    name: 'Learning Agility',
    description: 'Speed and flexibility in acquiring new skills and adapting to unfamiliar challenges.',
    iconPath: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182',
    color: 'violet',
  },
  {
    id: 'execution_drive',
    name: 'Execution Drive',
    description: 'Relentless focus on delivery, removing obstacles, and achieving measurable outcomes.',
    iconPath: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
    color: 'amber',
  },
  {
    id: 'people_leadership',
    name: 'People Leadership',
    description: 'Inspiring, developing, and retaining high-performing teams through servant leadership.',
    iconPath: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
    color: 'cyan',
  },
  {
    id: 'change_adaptability',
    name: 'Change Adaptability',
    description: 'Navigating ambiguity and leading others through organisational transformation.',
    iconPath: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    color: 'emerald',
  },
  {
    id: 'decision_making_pressure',
    name: 'Decision-making Under Pressure',
    description: 'Sound judgment and decisive action when stakes are high and information is incomplete.',
    iconPath: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.97Zm-12.75 0-.89-.315m0 0-1.378-4.978m1.378 4.978 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.589-1.202L6 4.97Z',
    color: 'orange',
  },
  {
    id: 'stakeholder_influence',
    name: 'Stakeholder Influence',
    description: 'Building credibility and aligning diverse stakeholders to shared goals.',
    iconPath: 'M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z',
    color: 'teal',
  },
];

type CategoryItem = { id: string; name: string; description: string; iconPath: string; color: string };

const CAT_COLOR_CLASSES: Record<string, { iconBg: string; iconText: string; selectedBorder: string; selectedBg: string }> = {
  blue:    { iconBg: 'bg-blue-100',    iconText: 'text-blue-600',    selectedBorder: 'border-blue-500',    selectedBg: 'bg-blue-50'    },
  violet:  { iconBg: 'bg-violet-100',  iconText: 'text-violet-600',  selectedBorder: 'border-violet-500',  selectedBg: 'bg-violet-50'  },
  amber:   { iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   selectedBorder: 'border-amber-500',   selectedBg: 'bg-amber-50'   },
  cyan:    { iconBg: 'bg-cyan-100',    iconText: 'text-cyan-600',    selectedBorder: 'border-cyan-500',    selectedBg: 'bg-cyan-50'    },
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', selectedBorder: 'border-emerald-500', selectedBg: 'bg-emerald-50' },
  pink:    { iconBg: 'bg-pink-100',    iconText: 'text-pink-600',    selectedBorder: 'border-pink-500',    selectedBg: 'bg-pink-50'    },
  orange:  { iconBg: 'bg-orange-100',  iconText: 'text-orange-600',  selectedBorder: 'border-orange-500',  selectedBg: 'bg-orange-50'  },
  teal:    { iconBg: 'bg-teal-100',    iconText: 'text-teal-600',    selectedBorder: 'border-teal-500',    selectedBg: 'bg-teal-50'    },
  sky:     { iconBg: 'bg-sky-100',     iconText: 'text-sky-600',     selectedBorder: 'border-sky-500',     selectedBg: 'bg-sky-50'     },
  rose:    { iconBg: 'bg-rose-100',    iconText: 'text-rose-600',    selectedBorder: 'border-rose-500',    selectedBg: 'bg-rose-50'    },
};

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ current, steps }: { current: number; steps: typeof STEPS_DEFAULT }) {
  return (
    <div className="mb-8">
      <div className="hidden sm:flex items-center justify-between w-full mx-auto relative z-10 max-w-lg">
        {steps.map((step, idx) => (
          <div key={step.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  current > step.n
                    ? 'bg-blue-600 text-white'
                    : current === step.n
                    ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-50'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {current > step.n ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap absolute mt-10 transition-colors duration-300',
                  current === step.n ? 'text-gray-900 font-semibold' : current > step.n ? 'text-gray-600' : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-[2px] mx-4 rounded-full transition-all duration-300',
                  current > step.n ? 'bg-blue-600' : 'bg-gray-100',
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="hidden sm:block h-6" />
      <div className="flex sm:hidden flex-col items-center gap-3">
        <div className="flex items-center gap-2 w-full max-w-xs">
          {steps.map((step) => (
            <div
              key={step.n}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-300',
                current >= step.n ? 'bg-blue-600' : 'bg-gray-100',
              )}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-gray-500">
          Step {current} of {steps.length}
          <span className="text-gray-900 ml-1.5 font-semibold">{steps[current - 1].label}</span>
        </p>
      </div>
    </div>
  );
}

// ── Step 1: Type ───────────────────────────────────────────────────────────────
function StepType({ selected, onSelect }: { selected: AssessmentType | null; onSelect: (t: AssessmentType) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Assessment Type</h2>
      <p className="text-sm text-gray-500 mb-6">Choose the type of assessment you want to create.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className={cn(
              'text-left rounded-xl border-2 p-5 transition-all hover:shadow-md',
              selected === opt.type ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
              selected === opt.type ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500',
            )}>
              {TYPE_ICONS[opt.type]()}
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{opt.label}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DatePicker ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Select date',
}: {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getMonth();
    return new Date().getMonth();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const minDate = min ? new Date(min + 'T00:00:00') : null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }

  function isDayDisabled(day: number) {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const m = new Date(minDate);
    m.setHours(0, 0, 0, 0);
    return d < m;
  }

  function isDaySelected(day: number) {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === day;
  }

  function isDayToday(day: number) {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
  }

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg border transition-all text-left',
          open
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300',
          displayLabel ? 'text-gray-700' : 'text-gray-400',
        )}
      >
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="flex-1 truncate">{displayLabel || placeholder}</span>
        {displayLabel && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 select-none">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_ABBRS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1 select-none">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) =>
              day === null ? (
                <div key={`e-${idx}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDayDisabled(day) && selectDay(day)}
                  disabled={isDayDisabled(day)}
                  className={cn(
                    'w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all select-none',
                    isDaySelected(day)
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : isDayDisabled(day)
                      ? 'text-gray-300 cursor-not-allowed'
                      : isDayToday(day)
                      ? 'text-blue-600 font-semibold hover:bg-blue-50 ring-1 ring-blue-200'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Details ────────────────────────────────────────────────────────────
function StepDetails({
  assessmentType,
  title,
  startDate,
  endDate,
  isRatingMandatory,
  onChange,
  onToggleMandatory,
}: {
  assessmentType: AssessmentType | null;
  title: string;
  startDate: string;
  endDate: string;
  isRatingMandatory: boolean;
  onChange: (field: 'title' | 'startDate' | 'endDate', value: string) => void;
  onToggleMandatory: (val: boolean) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Assessment Details</h2>
      <p className="text-sm text-gray-500 mb-6">Provide a title and schedule for the assessment.</p>
      <div className="space-y-5 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assessment Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="e.g. Mid-Year 360 Feedback 2025"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <DatePicker
              value={startDate}
              onChange={(val) => onChange('startDate', val)}
              placeholder="Pick start date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <DatePicker
              value={endDate}
              onChange={(val) => onChange('endDate', val)}
              min={startDate || undefined}
              placeholder="Pick end date"
            />
          </div>
        </div>
        {assessmentType === AssessmentType.PERSONALITY && (
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Questionnaire Completion</p>
            <div className="flex flex-col gap-2">
              {[true, false].map((mandatory) => (
                <label
                  key={String(mandatory)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                    isRatingMandatory === mandatory ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <input type="radio" checked={isRatingMandatory === mandatory} onChange={() => onToggleMandatory(mandatory)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{mandatory ? 'Mandatory' : 'Optional'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {mandatory
                        ? 'Participants must complete all questionnaire items before results are generated.'
                        : 'After completing the questionnaire, participants are immediately shown their personality results in radar charts.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3a: Competencies (non-360 types) ─────────────────────────────────────
function StepCompetencies({
  assessmentType,
  selected,
  onToggle,
}: {
  assessmentType: AssessmentType | null;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { data: competencies, isLoading } = useApi<CompetencyDto[]>('/items/competencies');
  const needsCompetencies =
    assessmentType === AssessmentType.COMPETENCY;

  if (!needsCompetencies) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Competencies</h2>
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-blue-700 font-medium">
            {assessmentType === AssessmentType.PERSONALITY
              ? 'Personality assessments use a built-in psychometric questionnaire — no competencies required.'
              : 'Readiness assessments use SJTs and learning agility scales — no competencies required.'}
          </p>
          <p className="text-xs text-blue-600 mt-2">Click Next to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Competencies</h2>
      <p className="text-sm text-gray-500 mb-6">Choose competencies to include ({selected.length} selected).</p>
      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Spinner />
          <span className="text-sm text-gray-500">Loading competencies…</span>
        </div>
      )}
      {!isLoading && competencies && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {competencies.map((comp) => (
            <label
              key={comp.id}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all',
                selected.includes(comp.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(comp.id)}
                onChange={() => onToggle(comp.id)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{comp.name}</p>
                {comp.description && <p className="text-xs text-gray-500 mt-0.5">{comp.description}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
      {!isLoading && (!competencies || competencies.length === 0) && (
        <p className="text-sm text-gray-500 py-8 text-center">No competencies found in library.</p>
      )}
    </div>
  );
}

// ── Step 3b: Category Selector (competency / personality / readiness) ─────────
function StepCompetencyCategories({
  items = COMPETENCY_CATEGORIES,
  title = 'Select Competency Areas',
  subtitle,
  selected,
  onToggle,
}: {
  items?: CategoryItem[];
  title?: string;
  subtitle?: string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const defaultSubtitle = `Choose the areas to assess (${selected.length} selected). You will build questions for each area in the next step.`;
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-5">{subtitle ?? defaultSubtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[30rem] overflow-y-auto pr-1">
        {items.map((cat) => {
          const isSelected = selected.includes(cat.id);
          const colors = CAT_COLOR_CLASSES[cat.color];
          return (
            <button
              key={cat.id}
              onClick={() => onToggle(cat.id)}
              className={cn(
                'text-left rounded-xl border-2 p-4 transition-all hover:shadow-sm',
                isSelected ? `${colors.selectedBorder} ${colors.selectedBg}` : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', isSelected ? colors.iconBg : 'bg-gray-100')}>
                  <svg className={cn('w-5 h-5', isSelected ? colors.iconText : 'text-gray-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                    {isSelected && (
                      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0', colors.iconBg)}>
                        <svg className={cn('w-3 h-3', colors.iconText)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{cat.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Select at least one area to continue.
        </p>
      )}
    </div>
  );
}

// ── Step 3c: Participants & Raters (360° only) ────────────────────────────────
function StepParticipants360({
  participants360,
  onAddParticipant,
  onRemoveParticipant,
  onAddRater,
  onRemoveRater,
}: {
  participants360: Participant360[];
  onAddParticipant: (user: UserDto) => void;
  onRemoveParticipant: (userId: string) => void;
  onAddRater: (participantUserId: string, rater: RaterEntry) => void;
  onRemoveRater: (participantUserId: string, raterUserId: string) => void;
}) {
  const { data: users } = useApi<UserDto[]>('/organisations/me/users');
  const [participantSearch, setParticipantSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [raterSearches, setRaterSearches] = useState<Record<string, string>>({});
  const [raterRelationships, setRaterRelationships] = useState<Record<string, RaterRelationship>>({});

  const selectedIds = participants360.map((p) => p.userId);

  const filteredForParticipant =
    users?.filter(
      (u) =>
        !selectedIds.includes(u.id) &&
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(participantSearch.toLowerCase()),
    ) ?? [];

  function getFilteredRaters(participantId: string, participant: Participant360) {
    const search = (raterSearches[participantId] ?? '').toLowerCase();
    const existingRaterIds = participant.raters.map((r) => r.userId);
    return (
      users?.filter(
        (u) =>
          u.id !== participantId &&
          !existingRaterIds.includes(u.id) &&
          `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search),
      ) ?? []
    );
  }

  const RELATIONSHIP_LABELS: Record<RaterRelationship, string> = {
    SUPERVISOR: 'Supervisor',
    PEER: 'Peer',
    DIRECT_REPORT: 'Direct Report',
  };

  const RELATIONSHIP_COLORS: Record<RaterRelationship, string> = {
    SUPERVISOR: 'bg-purple-100 text-purple-700',
    PEER: 'bg-blue-100 text-blue-700',
    DIRECT_REPORT: 'bg-orange-100 text-orange-700',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Participants & Feedback Givers</h2>
      <p className="text-sm text-gray-500 mb-5">
        Add participants to be assessed, then assign who will give them feedback.
      </p>

      {/* Add participant search */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Add Participant
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search users by name or email…"
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
          />
          {participantSearch && filteredForParticipant.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl shadow-lg bg-white overflow-hidden max-h-52 overflow-y-auto">
              {filteredForParticipant.slice(0, 8).map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onAddParticipant(user);
                    setParticipantSearch('');
                    setExpandedId(user.id);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {participantSearch && filteredForParticipant.length === 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl shadow-lg bg-white px-3 py-3">
              <p className="text-sm text-gray-400">No matching users found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected participants */}
      {participants360.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">No participants added yet. Search above to add.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Participants ({participants360.length})
          </p>
          {participants360.map((participant) => {
            const isExpanded = expandedId === participant.userId;
            const raterSearch = raterSearches[participant.userId] ?? '';
            const relationship = raterRelationships[participant.userId] ?? 'PEER';
            const filteredRaters = getFilteredRaters(participant.userId, participant);

            return (
              <div key={participant.userId} className="border border-gray-200 rounded-xl overflow-visible">
                {/* Header row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-xl"
                  onClick={() => setExpandedId(isExpanded ? null : participant.userId)}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                    {participant.firstName[0]}{participant.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{participant.firstName} {participant.lastName}</p>
                    <p className="text-xs text-gray-400">
                      {participant.raters.length === 0
                        ? 'No feedback givers assigned'
                        : `${participant.raters.length} feedback giver${participant.raters.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveParticipant(participant.userId); }}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg
                      className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', isExpanded && 'rotate-180')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded rater panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 rounded-b-xl space-y-3">
                    {/* Existing raters */}
                    {participant.raters.length > 0 && (
                      <div className="space-y-1.5">
                        {participant.raters.map((rater) => (
                          <div key={rater.userId} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                              {rater.firstName[0]}{rater.lastName[0]}
                            </div>
                            <span className="flex-1 text-sm text-gray-800 truncate">
                              {rater.firstName} {rater.lastName}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', RELATIONSHIP_COLORS[rater.relationship])}>
                              {RELATIONSHIP_LABELS[rater.relationship]}
                            </span>
                            <button
                              onClick={() => onRemoveRater(participant.userId, rater.userId)}
                              className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add rater row */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Add Feedback Giver</p>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search by name or email…"
                            value={raterSearch}
                            onChange={(e) => setRaterSearches((prev) => ({ ...prev, [participant.userId]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                          {raterSearch && filteredRaters.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg shadow-md bg-white overflow-hidden max-h-40 overflow-y-auto">
                              {filteredRaters.slice(0, 6).map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    onAddRater(participant.userId, {
                                      userId: user.id,
                                      firstName: user.firstName,
                                      lastName: user.lastName,
                                      email: user.email,
                                      relationship,
                                    });
                                    setRaterSearches((prev) => ({ ...prev, [participant.userId]: '' }));
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-100 last:border-0"
                                >
                                  <span className="text-sm text-gray-900">{user.firstName} {user.lastName}</span>
                                  <span className="text-xs text-gray-400 truncate">{user.email}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <select
                          value={relationship}
                          onChange={(e) =>
                            setRaterRelationships((prev) => ({
                              ...prev,
                              [participant.userId]: e.target.value as RaterRelationship,
                            }))
                          }
                          className="bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 shrink-0"
                        >
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="PEER">Peer</option>
                          <option value="DIRECT_REPORT">Direct Report</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step 4a: Participants (non-360 types) ─────────────────────────────────────
function StepParticipants({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { data: users, isLoading } = useApi<UserDto[]>('/organisations/me/users');
  const [search, setSearch] = useState('');

  const filtered =
    users?.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Participants</h2>
      <p className="text-sm text-gray-500 mb-4">Search and select users to include ({selected.length} selected).</p>
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700 mb-4"
      />
      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Spinner />
          <span className="text-sm text-gray-500">Loading users…</span>
        </div>
      )}
      {!isLoading && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((user) => (
            <label
              key={user.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                selected.includes(user.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={() => onToggle(user.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <span className="text-xs text-gray-400 capitalize">{user.role.replace('_', ' ')}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 4b: Question Builder (360° only) ─────────────────────────────────────
const QUESTION_TYPE_META: { type: QuestionType; label: string }[] = [
  { type: 'SINGLE_CHOICE', label: 'Single Choice' },
  { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { type: 'TRUE_FALSE', label: 'True / False' },
  { type: 'SHORT_ANSWER', label: 'Short Answer' },
  { type: 'TABLE', label: 'Table' },
];

function QuestionCard({
  question,
  index,
  onUpdate,
  onRemove,
}: {
  question: FormQuestion;
  index: number;
  onUpdate: (patch: Partial<FormQuestion>) => void;
  onRemove: () => void;
}) {
  function updateOption(optId: string, text: string) {
    onUpdate({ options: question.options.map((o) => (o.id === optId ? { ...o, text } : o)) });
  }

  function addOption() {
    onUpdate({ options: [...question.options, { id: crypto.randomUUID(), text: '' }] });
  }

  function removeOption(optId: string) {
    if (question.options.length <= 2) return;
    onUpdate({ options: question.options.filter((o) => o.id !== optId) });
  }

  function updateRow(idx: number, value: string) {
    const rows = [...question.tableRows];
    rows[idx] = value;
    onUpdate({ tableRows: rows });
  }

  function updateColumn(idx: number, value: string) {
    const cols = [...question.tableColumns];
    cols[idx] = value;
    onUpdate({ tableColumns: cols });
  }

  function handleTypeChange(newType: QuestionType) {
    const patch: Partial<FormQuestion> = { type: newType };
    if (newType === 'SINGLE_CHOICE' || newType === 'MULTIPLE_CHOICE') {
      if (question.options.length < 2) {
        patch.options = [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ];
      }
    } else if (newType === 'TRUE_FALSE') {
      patch.options = [
        { id: 'opt-true', text: 'True' },
        { id: 'opt-false', text: 'False' },
      ];
    } else if (newType === 'TABLE') {
      if (question.tableRows.length === 0) patch.tableRows = ['Row 1', 'Row 2'];
      if (question.tableColumns.length === 0) patch.tableColumns = ['Column 1', 'Column 2'];
    }
    onUpdate(patch);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Question header */}
      <div className="flex items-start gap-3 p-4">
        <span className="text-xs font-bold text-gray-400 mt-2.5 w-6 shrink-0 text-center">Q{index + 1}</span>
        <div className="flex-1 space-y-3">
          <input
            type="text"
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter your question here…"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 font-medium"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={question.type}
              onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {QUESTION_TYPE_META.map((qt) => (
                <option key={qt.type} value={qt.type}>{qt.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Required</span>
            </label>
            <button
              onClick={onRemove}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Choice options */}
      {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
          {question.options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-gray-300 text-sm shrink-0 w-4 text-center">
                {question.type === 'SINGLE_CHOICE' ? '○' : '□'}
              </span>
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOption(opt.id, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={() => removeOption(opt.id)}
                disabled={question.options.length <= 2}
                className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors pl-6 mt-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add option
          </button>
        </div>
      )}

      {/* True/False preview */}
      {question.type === 'TRUE_FALSE' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="flex gap-6">
            {['True', 'False'].map((opt) => (
              <div key={opt} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                {opt}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Respondents choose one of the two options.</p>
        </div>
      )}

      {/* Short answer preview */}
      {question.type === 'SHORT_ANSWER' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="w-full h-14 bg-white border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-400 italic">Respondent types their answer here</span>
          </div>
        </div>
      )}

      {/* Table builder */}
      {question.type === 'TABLE' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Columns</p>
              <div className="space-y-1.5">
                {question.tableColumns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={col}
                      onChange={(e) => updateColumn(idx, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                    />
                    {question.tableColumns.length > 1 && (
                      <button
                        onClick={() => onUpdate({ tableColumns: question.tableColumns.filter((_, i) => i !== idx) })}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ tableColumns: [...question.tableColumns, `Column ${question.tableColumns.length + 1}`] })}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add column
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Rows</p>
              <div className="space-y-1.5">
                {question.tableRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={row}
                      onChange={(e) => updateRow(idx, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                    />
                    {question.tableRows.length > 1 && (
                      <button
                        onClick={() => onUpdate({ tableRows: question.tableRows.filter((_, i) => i !== idx) })}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ tableRows: [...question.tableRows, `Row ${question.tableRows.length + 1}`] })}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add row
                </button>
              </div>
            </div>
          </div>

          {/* Table preview */}
          {question.tableColumns.length > 0 && question.tableRows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Preview</p>
              <table className="text-xs border-collapse bg-white rounded-lg overflow-hidden border border-gray-200">
                <thead>
                  <tr>
                    <th className="border border-gray-200 px-3 py-1.5 bg-gray-100 min-w-[80px]" />
                    {question.tableColumns.map((col, i) => (
                      <th key={i} className="border border-gray-200 px-3 py-1.5 bg-gray-100 text-gray-700 font-medium text-left min-w-[90px]">
                        {col || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {question.tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 px-3 py-1.5 bg-gray-50 font-medium text-gray-600">
                        {row || `Row ${i + 1}`}
                      </td>
                      {question.tableColumns.map((_, j) => (
                        <td key={j} className="border border-gray-200 px-3 py-1.5 text-gray-300 italic">
                          —
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepQuestions({
  questions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  questions: FormQuestion[];
  onAdd: (type: QuestionType) => void;
  onUpdate: (id: string, patch: Partial<FormQuestion>) => void;
  onRemove: (id: string) => void;
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Build Questionnaire</h2>
      <p className="text-sm text-gray-500 mb-5">
        Create questions that feedback givers will answer for each participant.
      </p>

      <div className="space-y-3 mb-4">
        {questions.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">No questions yet. Add your first question below.</p>
          </div>
        )}
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx}
            onUpdate={(patch) => onUpdate(q.id, patch)}
            onRemove={() => onRemove(q.id)}
          />
        ))}
      </div>

      {/* Add question button with dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowTypeMenu((v) => !v)}
          className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-400 rounded-xl px-4 py-3 w-full transition-all hover:bg-blue-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Question
        </button>
        {showTypeMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 border border-gray-200 rounded-xl shadow-xl bg-white overflow-hidden z-10">
            {QUESTION_TYPE_META.map((qt) => (
              <button
                key={qt.type}
                onClick={() => { onAdd(qt.type); setShowTypeMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-700">{qt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Question type icon paths ───────────────────────────────────────────────────
const QTYPE_ICONS: Record<QuestionType, string> = {
  SINGLE_CHOICE:   'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  MULTIPLE_CHOICE: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  TRUE_FALSE:      'M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5',
  SHORT_ANSWER:    'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125',
  TABLE:           'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125',
};

// ── Step 4b: Category Question Builder (competency / personality / readiness) ──
function StepCompetencyQuestions({
  categories = COMPETENCY_CATEGORIES,
  headerTitle = 'Build Questions',
  tabLabel = 'competency tab',
  selectedCategories,
  questions,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  activeCategory,
  onActiveCategoryChange,
}: {
  categories?: CategoryItem[];
  headerTitle?: string;
  tabLabel?: string;
  selectedCategories: string[];
  questions: Record<string, FormQuestion[]>;
  onAddQuestion: (catId: string, type: QuestionType) => void;
  onUpdateQuestion: (catId: string, id: string, patch: Partial<FormQuestion>) => void;
  onRemoveQuestion: (catId: string, id: string) => void;
  activeCategory: string;
  onActiveCategoryChange: (catId: string) => void;
}) {
  const activeCat = categories.find((c) => c.id === activeCategory);
  const activeQuestions = questions[activeCategory] ?? [];
  const colors = activeCat ? CAT_COLOR_CLASSES[activeCat.color] : CAT_COLOR_CLASSES['blue'];
  const totalQuestions = Object.values(questions).reduce((s, qs) => s + qs.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
        {totalQuestions > 0 && (
          <span className="text-xs text-gray-500 font-medium">
            {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} total
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Click a {tabLabel}, then add questions manually or generate them with AI.
      </p>

      {/* ── Horizontal category tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5">
        {selectedCategories.map((catId) => {
          const cat = categories.find((c) => c.id === catId);
          if (!cat) return null;
          const qCount = (questions[catId] ?? []).length;
          const isActive = activeCategory === catId;
          const cc = CAT_COLOR_CLASSES[cat.color];
          return (
            <button
              key={catId}
              onClick={() => onActiveCategoryChange(catId)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 border-2',
                isActive
                  ? `${cc.selectedBg} ${cc.selectedBorder} ${cc.iconText}`
                  : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
              )}
            >
              <svg
                className={cn('w-3.5 h-3.5 shrink-0', isActive ? cc.iconText : 'text-gray-400')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
              </svg>
              <span>{cat.name}</span>
              {qCount > 0 && (
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none',
                  isActive ? `${cc.iconBg} ${cc.iconText}` : 'bg-white text-gray-500',
                )}>
                  {qCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeCat ? (
        <>
          {/* ── Active category banner ── */}
          <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border', colors.selectedBg, colors.selectedBorder)}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', colors.iconBg)}>
              <svg className={cn('w-5 h-5', colors.iconText)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={activeCat.iconPath} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{activeCat.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug truncate">{activeCat.description}</p>
            </div>
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full shrink-0', colors.iconBg, colors.iconText)}>
              {activeQuestions.length} Q
            </span>
          </div>

          {/* ── Question list ── */}
          <div className="space-y-3 mb-5">
            {activeQuestions.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl py-10 flex flex-col items-center gap-3">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colors.iconBg)}>
                  <svg className={cn('w-6 h-6', colors.iconText)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={activeCat.iconPath} />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">No questions yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">Pick a type below or ask the AI assistant</p>
                </div>
              </div>
            ) : (
              activeQuestions.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  onUpdate={(patch) => onUpdateQuestion(activeCategory, q.id, patch)}
                  onRemove={() => onRemoveQuestion(activeCategory, q.id)}
                />
              ))
            )}
          </div>

          {/* ── Add question — type picker ── */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add a question</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUESTION_TYPE_META.map((qt) => (
                <button
                  key={qt.type}
                  onClick={() => onAddQuestion(activeCategory, qt.type)}
                  className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs font-medium px-3 py-2.5 rounded-xl transition-all text-left group"
                >
                  <span className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                    <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={QTYPE_ICONS[qt.type]} />
                    </svg>
                  </span>
                  {qt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── AI hint ── */}
          <div className="mt-3 flex items-center gap-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-xs text-blue-700 flex-1">
              <span className="font-semibold">AI Assistant</span> — use the chat bubble (bottom-right) to auto-generate questions for{' '}
              <span className="font-semibold">{activeCat.name}</span>.
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-sm text-gray-400">Select a tab above to begin.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review ─────────────────────────────────────────────────────────────
function StepReview({
  state,
  onSaveDraft,
  onSubmit,
  isSubmitting,
}: {
  state: WizardState;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const is360 = state.type === AssessmentType.FEEDBACK_360;
  const isCompetency = state.type === AssessmentType.COMPETENCY;
  const isPersonality = state.type === AssessmentType.PERSONALITY;
  const isReadiness = state.type === AssessmentType.READINESS;
  const typeLabelMap: Record<string, string> = {
    [AssessmentType.FEEDBACK_360]: '360° Feedback',
    [AssessmentType.COMPETENCY]: 'Competency',
    [AssessmentType.PERSONALITY]: 'Personality',
    [AssessmentType.READINESS]: 'Readiness',
  };

  const totalRaters = state.participants360.reduce((sum, p) => sum + p.raters.length, 0);
  const totalPersonalityQ = Object.values(state.personalityQuestions).reduce((s, qs) => s + qs.length, 0);
  const totalReadinessQ = Object.values(state.readinessQuestions).reduce((s, qs) => s + qs.length, 0);

  function CategorySummaryList({ ids, qMap, lookup }: { ids: string[]; qMap: Record<string, FormQuestion[]>; lookup: CategoryItem[] }) {
    if (ids.length === 0) return null;
    return (
      <div className="mb-5 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</p>
        {ids.map((id) => {
          const cat = lookup.find((c) => c.id === id);
          const qCount = (qMap[id] ?? []).length;
          const colors = cat ? CAT_COLOR_CLASSES[cat.color] : CAT_COLOR_CLASSES['blue'];
          return (
            <div key={id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', colors.iconBg)}>
                  {cat && (
                    <svg className={cn('w-3.5 h-3.5', colors.iconText)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900">{cat?.name ?? id}</span>
              </div>
              <span className="text-xs text-gray-500">{qCount} question{qCount !== 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h2>
      <p className="text-sm text-gray-500 mb-6">Review your assessment before saving or submitting.</p>

      <div className="space-y-3 bg-gray-50 rounded-xl p-5 border border-gray-200 mb-5">
        <Row label="Type" value={state.type ? typeLabelMap[state.type] : '—'} />
        <Row label="Title" value={state.title || '—'} />
        <Row
          label="Dates"
          value={
            state.startDate && state.endDate
              ? `${state.startDate} → ${state.endDate}`
              : state.startDate || state.endDate || 'Not set'
          }
        />
        {is360 ? (
          <>
            <Row label="Participants" value={`${state.participants360.length}`} />
            <Row label="Feedback givers" value={`${totalRaters} total`} />
            <Row label="Questions" value={`${state.questions.length}`} />
          </>
        ) : isCompetency ? (
          <>
            <Row label="Categories" value={state.selectedCategories.length > 0 ? `${state.selectedCategories.length} selected` : 'None selected'} />
            <Row label="Total Questions" value={String(Object.values(state.competencyQuestions).reduce((sum, qs) => sum + qs.length, 0))} />
            <Row label="Participants" value={state.participantIds.length > 0 ? `${state.participantIds.length} selected` : 'None selected'} />
          </>
        ) : isPersonality ? (
          <>
            <Row label="Traits" value={state.personalityTraits.length > 0 ? `${state.personalityTraits.length} selected` : 'None selected'} />
            <Row label="Total Questions" value={String(totalPersonalityQ)} />
            <Row label="Questionnaire" value={state.isRatingMandatory ? 'Mandatory' : 'Optional — results shown after completion'} />
            <Row label="Participants" value={state.participantIds.length > 0 ? `${state.participantIds.length} selected` : 'None selected'} />
          </>
        ) : isReadiness ? (
          <>
            <Row label="Dimensions" value={state.readinessDimensions.length > 0 ? `${state.readinessDimensions.length} selected` : 'None selected'} />
            <Row label="Total Questions" value={String(totalReadinessQ)} />
            <Row label="Participants" value={state.participantIds.length > 0 ? `${state.participantIds.length} selected` : 'None selected'} />
          </>
        ) : null}
      </div>

      {/* 360° participant summary */}
      {is360 && state.participants360.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Participant Summary</p>
          {state.participants360.map((p) => (
            <div key={p.userId} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                  {p.firstName[0]}{p.lastName[0]}
                </div>
                <span className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</span>
              </div>
              <span className="text-xs text-gray-500">
                {p.raters.length} feedback giver{p.raters.length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {isCompetency && <CategorySummaryList ids={state.selectedCategories} qMap={state.competencyQuestions} lookup={COMPETENCY_CATEGORIES} />}
      {isPersonality && <CategorySummaryList ids={state.personalityTraits} qMap={state.personalityQuestions} lookup={PERSONALITY_TRAITS} />}
      {isReadiness && <CategorySummaryList ids={state.readinessDimensions} qMap={state.readinessQuestions} lookup={READINESS_DIMENSIONS} />}

      {/* Warnings */}
      {is360 && state.participants360.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No participants selected. You can add them after creation.
        </div>
      )}
      {is360 && state.questions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No questions added. Feedback givers will see a blank form.
        </div>
      )}
      {isCompetency && state.selectedCategories.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No competency areas selected.
        </div>
      )}
      {isPersonality && state.personalityTraits.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No personality traits selected.
        </div>
      )}
      {isReadiness && state.readinessDimensions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No readiness dimensions selected.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="border-white border-t-transparent" />
              Submitting…
            </>
          ) : is360 ? (
            'Submit Assessment'
          ) : (
            'Launch Assessment'
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

// ── Submit Overlay (loading / success / error) ─────────────────────────────────
function SubmitOverlay({
  phase,
  step,
  error,
  wasDraft,
  onDismissError,
  onGoToAssessments,
}: {
  phase: 'idle' | 'submitting' | 'success' | 'error';
  step: string;
  error: string;
  wasDraft: boolean;
  onDismissError: () => void;
  onGoToAssessments: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || phase === 'idle') return null;

  return createPortal(
    <>
      {/* ── Loading ── */}
      {phase === 'submitting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs mx-4 flex flex-col items-center gap-5">
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">Please wait…</p>
              <p className="text-sm text-gray-500 mt-1">{step}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Success ── */}
      {phase === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-gray-900">
                {wasDraft ? 'Draft Saved!' : 'Assessment Created!'}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {wasDraft
                  ? 'Your assessment has been saved as a draft. You can launch it at any time.'
                  : 'Your assessment has been successfully submitted.'}
              </p>
            </div>
            <button
              onClick={onGoToAssessments}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
            >
              Go to Assessments
            </button>
          </div>
        </div>
      )}

      {/* ── Error toast ── */}
      {phase === 'error' && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center px-4 z-50 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Submission Failed</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={onDismissError}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────
export default function NewAssessmentPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({
    step: 1,
    type: null,
    title: '',
    startDate: '',
    endDate: '',
    isRatingMandatory: true,
    competencyIds: [],
    participantIds: [],
    participants360: [],
    questions: [],
    selectedCategories: [],
    competencyQuestions: {},
    personalityTraits: [],
    personalityQuestions: {},
    readinessDimensions: [],
    readinessQuestions: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submittingStep, setSubmittingStep] = useState('');
  const [wasDraft, setWasDraft] = useState(false);

  const is360 = state.type === AssessmentType.FEEDBACK_360;
  const isCompetency = state.type === AssessmentType.COMPETENCY;
  const isPersonality = state.type === AssessmentType.PERSONALITY;
  const isReadiness = state.type === AssessmentType.READINESS;
  const steps = is360 ? STEPS_360 : isCompetency ? STEPS_COMPETENCY : isPersonality ? STEPS_PERSONALITY : isReadiness ? STEPS_READINESS : STEPS_DEFAULT;
  const maxStep = is360 ? 5 : 6;
  const [activeCatForChat, setActiveCatForChat] = useState<string>('');
  const [activeCatForPersonality, setActiveCatForPersonality] = useState<string>('');
  const [activeCatForReadiness, setActiveCatForReadiness] = useState<string>('');

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  function canProceed(): boolean {
    switch (state.step) {
      case 1: return state.type !== null;
      case 2: return state.title.trim().length > 0;
      case 3:
        if (isCompetency) return state.selectedCategories.length > 0;
        if (isPersonality) return state.personalityTraits.length > 0;
        if (isReadiness) return state.readinessDimensions.length > 0;
        return true;
      default: return true;
    }
  }

  function next() {
    if (state.step < maxStep) update({ step: (state.step + 1) as WizardState['step'] });
  }

  function prev() {
    if (state.step > 1) update({ step: (state.step - 1) as WizardState['step'] });
  }

  function toggleId(list: 'competencyIds' | 'participantIds', id: string) {
    setState((prev) => {
      const arr = prev[list];
      return { ...prev, [list]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
    });
  }

  // 360° participant management
  function addParticipant360(user: UserDto) {
    setState((prev) => {
      if (prev.participants360.some((p) => p.userId === user.id)) return prev;
      return {
        ...prev,
        participants360: [
          ...prev.participants360,
          { userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, raters: [] },
        ],
      };
    });
  }

  function removeParticipant360(userId: string) {
    setState((prev) => ({ ...prev, participants360: prev.participants360.filter((p) => p.userId !== userId) }));
  }

  function addRater(participantUserId: string, rater: RaterEntry) {
    setState((prev) => ({
      ...prev,
      participants360: prev.participants360.map((p) =>
        p.userId === participantUserId ? { ...p, raters: [...p.raters, rater] } : p,
      ),
    }));
  }

  function removeRater(participantUserId: string, raterUserId: string) {
    setState((prev) => ({
      ...prev,
      participants360: prev.participants360.map((p) =>
        p.userId === participantUserId ? { ...p, raters: p.raters.filter((r) => r.userId !== raterUserId) } : p,
      ),
    }));
  }

  // Question management
  function addQuestion(type: QuestionType) {
    const defaultOptions =
      type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
        ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]
        : type === 'TRUE_FALSE'
        ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
        : [];
    const newQ: FormQuestion = {
      id: crypto.randomUUID(),
      type,
      title: '',
      required: false,
      options: defaultOptions,
      tableRows: type === 'TABLE' ? ['Row 1', 'Row 2'] : [],
      tableColumns: type === 'TABLE' ? ['Column 1', 'Column 2'] : [],
    };
    setState((prev) => ({ ...prev, questions: [...prev.questions, newQ] }));
  }

  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    setState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function removeQuestion(id: string) {
    setState((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
  }

  function insertGeneratedQuestions(generated: GeneratedQuestion[]) {
    const newQuestions: FormQuestion[] = generated.map((gq) => ({
      id: crypto.randomUUID(),
      type: gq.type,
      title: gq.title,
      required: gq.required ?? false,
      options:
        gq.type === 'TRUE_FALSE'
          ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
          : (gq.options ?? []).map((text) => ({ id: crypto.randomUUID(), text })),
      tableRows: gq.tableRows ?? [],
      tableColumns: gq.tableColumns ?? [],
    }));
    setState((prev) => ({ ...prev, questions: [...prev.questions, ...newQuestions] }));
  }

  function addCompetencyQuestion(catId: string, type: QuestionType) {
    const defaultOptions =
      type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
        ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]
        : type === 'TRUE_FALSE'
        ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
        : [];
    const newQ: FormQuestion = {
      id: crypto.randomUUID(),
      type,
      title: '',
      required: false,
      options: defaultOptions,
      tableRows: type === 'TABLE' ? ['Row 1', 'Row 2'] : [],
      tableColumns: type === 'TABLE' ? ['Column 1', 'Column 2'] : [],
    };
    setState((prev) => ({
      ...prev,
      competencyQuestions: {
        ...prev.competencyQuestions,
        [catId]: [...(prev.competencyQuestions[catId] ?? []), newQ],
      },
    }));
  }

  function updateCompetencyQuestion(catId: string, id: string, patch: Partial<FormQuestion>) {
    setState((prev) => ({
      ...prev,
      competencyQuestions: {
        ...prev.competencyQuestions,
        [catId]: (prev.competencyQuestions[catId] ?? []).map((q) => (q.id === id ? { ...q, ...patch } : q)),
      },
    }));
  }

  function removeCompetencyQuestion(catId: string, id: string) {
    setState((prev) => ({
      ...prev,
      competencyQuestions: {
        ...prev.competencyQuestions,
        [catId]: (prev.competencyQuestions[catId] ?? []).filter((q) => q.id !== id),
      },
    }));
  }

  function insertGeneratedQuestionsToCategory(catId: string, generated: GeneratedQuestion[]) {
    const newQuestions: FormQuestion[] = generated.map((gq) => ({
      id: crypto.randomUUID(),
      type: gq.type,
      title: gq.title,
      required: gq.required ?? false,
      options:
        gq.type === 'TRUE_FALSE'
          ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
          : (gq.options ?? []).map((text) => ({ id: crypto.randomUUID(), text })),
      tableRows: gq.tableRows ?? [],
      tableColumns: gq.tableColumns ?? [],
    }));
    setState((prev) => ({
      ...prev,
      competencyQuestions: {
        ...prev.competencyQuestions,
        [catId]: [...(prev.competencyQuestions[catId] ?? []), ...newQuestions],
      },
    }));
  }

  // ── Personality question management ──────────────────────────────────────────
  function makeCategoryQHandlers(stateKey: 'personalityQuestions' | 'readinessQuestions') {
    function add(catId: string, type: QuestionType) {
      const defaultOptions =
        type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
          ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]
          : type === 'TRUE_FALSE'
          ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
          : [];
      const newQ: FormQuestion = {
        id: crypto.randomUUID(), type, title: '', required: false,
        options: defaultOptions,
        tableRows: type === 'TABLE' ? ['Row 1', 'Row 2'] : [],
        tableColumns: type === 'TABLE' ? ['Column 1', 'Column 2'] : [],
      };
      setState((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [catId]: [...(prev[stateKey][catId] ?? []), newQ] } }));
    }
    function update(catId: string, id: string, patch: Partial<FormQuestion>) {
      setState((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [catId]: (prev[stateKey][catId] ?? []).map((q) => (q.id === id ? { ...q, ...patch } : q)) } }));
    }
    function remove(catId: string, id: string) {
      setState((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [catId]: (prev[stateKey][catId] ?? []).filter((q) => q.id !== id) } }));
    }
    function insertGenerated(catId: string, generated: GeneratedQuestion[]) {
      const newQs: FormQuestion[] = generated.map((gq) => ({
        id: crypto.randomUUID(), type: gq.type, title: gq.title, required: gq.required ?? false,
        options: gq.type === 'TRUE_FALSE' ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }] : (gq.options ?? []).map((text) => ({ id: crypto.randomUUID(), text })),
        tableRows: gq.tableRows ?? [], tableColumns: gq.tableColumns ?? [],
      }));
      setState((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [catId]: [...(prev[stateKey][catId] ?? []), ...newQs] } }));
    }
    return { add, update, remove, insertGenerated };
  }

  const personalityQ = makeCategoryQHandlers('personalityQuestions');
  const readinessQ = makeCategoryQHandlers('readinessQuestions');

  async function submit(launch: boolean) {
    setIsSubmitting(true);
    setSubmitPhase('submitting');
    setWasDraft(!launch);

    try {
      if (isCompetency) {
        setSubmittingStep('Creating competency assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: AssessmentType.COMPETENCY,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: {
            categories: state.selectedCategories,
            questions: Object.values(state.competencyQuestions).flat().map((q) => ({ ...q, options: q.options.map((o) => o.text) })),
          },
        });
        const assessmentId = res.data.data.id;
        if (state.participantIds.length > 0) {
          setSubmittingStep('Adding participants…');
          await Promise.all(state.participantIds.map((pid) => api.post(`/assessments/${assessmentId}/participants`, { userId: pid })));
        }
        if (launch) { setSubmittingStep('Launching assessment…'); await api.post(`/assessments/${assessmentId}/launch`); }
        setSubmitPhase('success');
        return;
      }

      if (is360) {
        setSubmittingStep('Creating assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: AssessmentType.FEEDBACK_360,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: { questions: state.questions },
        });
        const assessmentId = res.data.data.id;

        setSubmittingStep('Adding participants…');
        for (const participant of state.participants360) {
          const pRes = await api.post<{ data: { id: string } }>(
            `/assessments/${assessmentId}/participants`,
            { userId: participant.userId },
          );
          const participantId = pRes.data.data.id;

          if (participant.raters.length > 0) {
            setSubmittingStep('Sending nominations…');
            await api.post(`/assessments/${assessmentId}/360/nominations`, {
              participantId,
              raters: participant.raters.map((rater) => ({
                raterEmail: rater.email,
                raterName: `${rater.firstName} ${rater.lastName}`,
                relationship: rater.relationship,
              })),
            });
          }
        }

        if (launch) {
          setSubmittingStep('Launching assessment…');
          await api.post(`/assessments/${assessmentId}/launch`);
        }
        setSubmitPhase('success');
      } else if (isPersonality) {
        setSubmittingStep('Creating personality assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: AssessmentType.PERSONALITY,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: {
            isRatingMandatory: state.isRatingMandatory,
            traits: state.personalityTraits,
            questions: Object.values(state.personalityQuestions).flat().map((q) => ({ ...q, options: q.options.map((o) => o.text) })),
          },
        });
        const assessmentId = res.data.data.id;
        if (state.participantIds.length > 0) {
          setSubmittingStep('Adding participants…');
          await Promise.all(state.participantIds.map((pid) => api.post(`/assessments/${assessmentId}/participants`, { userId: pid })));
        }
        if (launch) { setSubmittingStep('Launching assessment…'); await api.post(`/assessments/${assessmentId}/launch`); }
        setSubmitPhase('success');
      } else if (isReadiness) {
        setSubmittingStep('Creating readiness assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: AssessmentType.READINESS,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: {
            dimensions: state.readinessDimensions,
            questions: Object.values(state.readinessQuestions).flat().map((q) => ({ ...q, options: q.options.map((o) => o.text) })),
          },
        });
        const assessmentId = res.data.data.id;
        if (state.participantIds.length > 0) {
          setSubmittingStep('Adding participants…');
          await Promise.all(state.participantIds.map((pid) => api.post(`/assessments/${assessmentId}/participants`, { userId: pid })));
        }
        if (launch) { setSubmittingStep('Launching assessment…'); await api.post(`/assessments/${assessmentId}/launch`); }
        setSubmitPhase('success');
      } else {
        setSubmittingStep('Creating assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: state.type,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: { competencyIds: state.competencyIds.length ? state.competencyIds : undefined },
        });
        const assessmentId = res.data.data.id;
        if (launch) { setSubmittingStep('Launching assessment…'); await api.post(`/assessments/${assessmentId}/launch`); }
        setSubmitPhase('success');
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message ?? 'Failed to create assessment.';
      setSubmitError(msg);
      setSubmitPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => (state.step > 1 ? prev() : router.back())}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {state.step > 1 ? `Back to ${steps[state.step - 2].label}` : 'Back'}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">New Assessment</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <Stepper current={state.step} steps={steps} />

        {state.step === 1 && (
          <StepType selected={state.type} onSelect={(t) => update({ type: t })} />
        )}
        {state.step === 2 && (
          <StepDetails
            assessmentType={state.type}
            title={state.title}
            startDate={state.startDate}
            endDate={state.endDate}
            isRatingMandatory={state.isRatingMandatory}
            onChange={(field, value) => update({ [field]: value })}
            onToggleMandatory={(val) => update({ isRatingMandatory: val })}
          />
        )}
        {state.step === 3 && (
          is360 ? (
            <StepParticipants360
              participants360={state.participants360}
              onAddParticipant={addParticipant360}
              onRemoveParticipant={removeParticipant360}
              onAddRater={addRater}
              onRemoveRater={removeRater}
            />
          ) : isCompetency ? (
            <StepCompetencyCategories
              selected={state.selectedCategories}
              onToggle={(id) =>
                setState((prev) => ({
                  ...prev,
                  selectedCategories: prev.selectedCategories.includes(id)
                    ? prev.selectedCategories.filter((c) => c !== id)
                    : [...prev.selectedCategories, id],
                }))
              }
            />
          ) : isPersonality ? (
            <StepCompetencyCategories
              items={PERSONALITY_TRAITS}
              title="Select Personality Traits"
              subtitle={`Choose the Big Five (OCEAN) traits to assess (${state.personalityTraits.length} selected). You will build questions for each trait in the next step.`}
              selected={state.personalityTraits}
              onToggle={(id) =>
                setState((prev) => ({
                  ...prev,
                  personalityTraits: prev.personalityTraits.includes(id)
                    ? prev.personalityTraits.filter((t) => t !== id)
                    : [...prev.personalityTraits, id],
                }))
              }
            />
          ) : isReadiness ? (
            <StepCompetencyCategories
              items={READINESS_DIMENSIONS}
              title="Select Readiness Dimensions"
              subtitle={`Choose the leadership readiness dimensions to assess (${state.readinessDimensions.length} selected). You will build questions for each dimension in the next step.`}
              selected={state.readinessDimensions}
              onToggle={(id) =>
                setState((prev) => ({
                  ...prev,
                  readinessDimensions: prev.readinessDimensions.includes(id)
                    ? prev.readinessDimensions.filter((d) => d !== id)
                    : [...prev.readinessDimensions, id],
                }))
              }
            />
          ) : (
            <StepCompetencies
              assessmentType={state.type}
              selected={state.competencyIds}
              onToggle={(id) => toggleId('competencyIds', id)}
            />
          )
        )}
        {state.step === 4 && (
          is360 ? (
            <StepQuestions
              questions={state.questions}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
            />
          ) : isCompetency ? (
            <StepCompetencyQuestions
              selectedCategories={state.selectedCategories}
              questions={state.competencyQuestions}
              onAddQuestion={addCompetencyQuestion}
              onUpdateQuestion={updateCompetencyQuestion}
              onRemoveQuestion={removeCompetencyQuestion}
              activeCategory={activeCatForChat || state.selectedCategories[0] || ''}
              onActiveCategoryChange={setActiveCatForChat}
            />
          ) : isPersonality ? (
            <StepCompetencyQuestions
              categories={PERSONALITY_TRAITS}
              headerTitle="Build Personality Questions"
              tabLabel="trait tab"
              selectedCategories={state.personalityTraits}
              questions={state.personalityQuestions}
              onAddQuestion={personalityQ.add}
              onUpdateQuestion={personalityQ.update}
              onRemoveQuestion={personalityQ.remove}
              activeCategory={activeCatForPersonality || state.personalityTraits[0] || ''}
              onActiveCategoryChange={setActiveCatForPersonality}
            />
          ) : isReadiness ? (
            <StepCompetencyQuestions
              categories={READINESS_DIMENSIONS}
              headerTitle="Build Readiness Questions"
              tabLabel="dimension tab"
              selectedCategories={state.readinessDimensions}
              questions={state.readinessQuestions}
              onAddQuestion={readinessQ.add}
              onUpdateQuestion={readinessQ.update}
              onRemoveQuestion={readinessQ.remove}
              activeCategory={activeCatForReadiness || state.readinessDimensions[0] || ''}
              onActiveCategoryChange={setActiveCatForReadiness}
            />
          ) : (
            <StepParticipants
              selected={state.participantIds}
              onToggle={(id) => toggleId('participantIds', id)}
            />
          )
        )}
        {state.step === 5 && !is360 && (
          <StepParticipants
            selected={state.participantIds}
            onToggle={(id) => toggleId('participantIds', id)}
          />
        )}
        {state.step === maxStep && (
          <StepReview
            state={state}
            onSaveDraft={() => submit(false)}
            onSubmit={() => submit(true)}
            isSubmitting={isSubmitting}
          />
        )}

        {state.step < maxStep && (
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={prev}
              disabled={state.step === 1}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={next}
              disabled={!canProceed()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>

    {is360 && state.step === 4 && (
      <AssessmentChatbot
        context="360° Feedback Assessment — Questions Builder. Help the user design effective questionnaire questions."
        onInsertQuestions={insertGeneratedQuestions}
      />
    )}
    {isCompetency && state.step === 4 && (() => {
      const activeCatId = activeCatForChat || state.selectedCategories[0] || '';
      const activeCatName = COMPETENCY_CATEGORIES.find((c) => c.id === activeCatId)?.name ?? 'this competency';
      return (
        <AssessmentChatbot
          key={activeCatId}
          context={`Competency Assessment — building questions for: ${activeCatName}. Suggest targeted behavioral assessment questions for this leadership area.`}
          onInsertQuestions={(qs) => insertGeneratedQuestionsToCategory(activeCatId, qs)}
          quickPrompts={[
            `Generate 5 questions for ${activeCatName}`,
            `Create a rating scale for ${activeCatName}`,
            `Suggest behavioral indicators for ${activeCatName}`,
            `What are best practices for assessing ${activeCatName}?`,
          ]}
        />
      );
    })()}
    {isPersonality && state.step === 4 && (() => {
      const activeId = activeCatForPersonality || state.personalityTraits[0] || '';
      const activeName = PERSONALITY_TRAITS.find((t) => t.id === activeId)?.name ?? 'this trait';
      return (
        <AssessmentChatbot
          key={activeId}
          context={`Personality Assessment (Big Five / OCEAN) — building questions for the "${activeName}" trait. Suggest Likert-scale statements and psychometric items that measure this personality dimension.`}
          onInsertQuestions={(qs) => personalityQ.insertGenerated(activeId, qs)}
          quickPrompts={[
            `Generate 5 Likert items for ${activeName}`,
            `Create agree/disagree statements for ${activeName}`,
            `Suggest reverse-scored items for ${activeName}`,
            `What are best practices for measuring ${activeName}?`,
          ]}
        />
      );
    })()}
    {isReadiness && state.step === 4 && (() => {
      const activeId = activeCatForReadiness || state.readinessDimensions[0] || '';
      const activeName = READINESS_DIMENSIONS.find((d) => d.id === activeId)?.name ?? 'this dimension';
      return (
        <AssessmentChatbot
          key={activeId}
          context={`Leadership Readiness Assessment — building questions for the "${activeName}" dimension. Suggest situational judgment items, behavioural indicators, and scenario-based questions that assess readiness for senior leadership roles.`}
          onInsertQuestions={(qs) => readinessQ.insertGenerated(activeId, qs)}
          quickPrompts={[
            `Generate 5 SJT scenarios for ${activeName}`,
            `Create behavioural indicator questions for ${activeName}`,
            `Suggest scenario-based questions for ${activeName}`,
            `What competencies underpin ${activeName}?`,
          ]}
        />
      );
    })()}

    <SubmitOverlay
      phase={submitPhase}
      step={submittingStep}
      error={submitError}
      wasDraft={wasDraft}
      onDismissError={() => setSubmitPhase('idle')}
      onGoToAssessments={() => router.push('/assessments')}
    />
    </>
  );
}
