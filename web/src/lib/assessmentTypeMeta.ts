import { Users, Target, Brain, Rocket, type LucideIcon } from 'lucide-react';
import { AssessmentType } from '@leaderprism/shared';

export interface TypeMeta {
  label: string;
  tagline: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  ring: string;
  chip: string;
  soft: string;
}

export const TYPE_META: Record<AssessmentType, TypeMeta> = {
  [AssessmentType.FEEDBACK_360]: {
    label: '360° Feedback',
    tagline: 'Multi-rater feedback from peers, managers & reports',
    icon: Users,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    glow: 'rgba(168,85,247,0.28)',
    ring: '#a855f7',
    chip: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    soft: 'bg-purple-50/70 dark:bg-purple-950/20',
  },
  [AssessmentType.COMPETENCY]: {
    label: 'Competency',
    tagline: 'Skill & behavioural proficiency evaluation',
    icon: Target,
    gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)',
    glow: 'rgba(70,95,255,0.28)',
    ring: '#465fff',
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    soft: 'bg-blue-50/70 dark:bg-blue-950/20',
  },
  [AssessmentType.PERSONALITY]: {
    label: 'Personality',
    tagline: 'Big Five personality profiling',
    icon: Brain,
    gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    glow: 'rgba(236,72,153,0.28)',
    ring: '#ec4899',
    chip: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/60',
    soft: 'bg-pink-50/70 dark:bg-pink-950/20',
  },
  [AssessmentType.READINESS]: {
    label: 'Readiness',
    tagline: 'Leadership potential & promotion readiness',
    icon: Rocket,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    glow: 'rgba(245,158,11,0.28)',
    ring: '#f59e0b',
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    soft: 'bg-amber-50/70 dark:bg-amber-950/20',
  },
};

export const ALL_ASSESSMENT_TYPES = Object.keys(TYPE_META) as AssessmentType[];

export const QUESTION_TYPE_META: Record<string, { label: string; chip: string }> = {
  SINGLE_CHOICE: { label: 'Single Choice', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300' },
  MULTIPLE_CHOICE: { label: 'Multiple Choice', chip: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' },
  TRUE_FALSE: { label: 'True / False', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  SHORT_ANSWER: { label: 'Short Answer', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' },
  TABLE: { label: 'Table', chip: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300' },
};
