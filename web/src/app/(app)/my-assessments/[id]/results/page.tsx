'use client';

import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { PageSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';
import { useAuthStore } from '@/store/auth.store';
import { AssessmentDto, AssessmentType } from '@leaderprism/shared';

// ── Shared types ──────────────────────────────────────────────────────────────

interface AssessmentParticipant { id: string; userId: string; status: string; }

// ── Personality types & constants ─────────────────────────────────────────────

interface FactorScore {
  factor: string; rawScore: number; tScore: number; percentile: number; narrative: string;
}

const FACTOR_META: Record<string, { label: string; description: string; color: string }> = {
  openness: { label: 'Openness', description: 'Curiosity, creativity, and openness to new experiences.', color: 'bg-purple-100 text-purple-800' },
  conscientiousness: { label: 'Conscientiousness', description: 'Organisation, dependability, and self-discipline.', color: 'bg-blue-100 text-blue-800' },
  extraversion: { label: 'Extraversion', description: 'Sociability, assertiveness, and positive emotionality.', color: 'bg-yellow-100 text-yellow-800' },
  agreeableness: { label: 'Agreeableness', description: 'Cooperation, trust, and empathy toward others.', color: 'bg-green-100 text-green-800' },
  emotional_stability: { label: 'Emotional Stability', description: 'Calmness, resilience, and emotional regulation.', color: 'bg-orange-100 text-orange-800' },
};
const FACTOR_ORDER = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotional_stability'];

function bandVariant(t: number): 'success' | 'warning' | 'info' {
  if (t >= 60) return 'success';
  if (t < 40) return 'info';
  return 'warning';
}
function bandLabel(t: number) { return t >= 60 ? 'High' : t < 40 ? 'Low' : 'Moderate'; }
function scoresToRadarAxes(scores: FactorScore[]): RadarAxis[] {
  return FACTOR_ORDER.map((key) => {
    const s = scores.find((x) => x.factor === key);
    return { key, label: FACTOR_META[key]?.label ?? key, value: s ? Math.round(s.percentile) : 0 };
  });
}

// ── Competency types & constants ──────────────────────────────────────────────

interface CompetencyProfileResult {
  domainId: string; domainName: string; domainColour: string;
  averageSelfRating: number | null;
  competencies: Array<{ competencyId: string; name: string; selfRating: number | null; }>;
}

const PROFICIENCY = ['Emerging', 'Developing', 'Proficient', 'Mastery'];
const PROFICIENCY_VARIANTS: Array<'neutral' | 'warning' | 'info' | 'success'> = ['neutral', 'warning', 'info', 'success'];

// ── Personality Results View ───────────────────────────────────────────────────

function PersonalityResultsView({
  assessmentId, participantId, assessmentTitle,
}: { assessmentId: string; participantId: string; assessmentTitle: string }) {
  const { data: scores, isLoading } = useApi<FactorScore[]>(
    `/assessments/${assessmentId}/personality/scores/${participantId}`,
  );

  if (isLoading) return <PageSpinner />;

  if (!scores || scores.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        Results are not yet available. Please complete the assessment first.
      </div>
    );
  }

  const radarAxes = scoresToRadarAxes(scores);
  const orderedScores = FACTOR_ORDER.map((key) => scores.find((s) => s.factor === key)).filter(Boolean) as FactorScore[];

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Big Five Personality Profile</h2>
            <p className="text-xs text-gray-500 mt-0.5">Percentile scores relative to the normative population</p>
          </div>
          <Badge variant="success">Completed</Badge>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="shrink-0"><RadarChart axes={radarAxes} size={280} /></div>
          <div className="flex-1 space-y-2.5 w-full">
            {radarAxes.map((axis) => (
              <div key={axis.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 shrink-0 font-medium">{axis.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${axis.value}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-10 text-right">{axis.value}th</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Factor Breakdown</h2>
        {orderedScores.map((score) => {
          const meta = FACTOR_META[score.factor];
          return (
            <div key={score.factor} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{meta?.label ?? score.factor}</h3>
                  {meta?.description && <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>}
                </div>
                <Badge variant={bandVariant(score.tScore)}>{bandLabel(score.tScore)}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">T-Score</p>
                  <p className="text-base font-bold text-gray-900">{score.tScore.toFixed(1)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Percentile</p>
                  <p className="text-base font-bold text-blue-600">{Math.round(score.percentile)}th</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Raw Score</p>
                  <p className="text-base font-bold text-gray-900">{score.rawScore.toFixed(0)}</p>
                </div>
              </div>
              {score.narrative && (
                <p className="text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3">{score.narrative}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        T-scores are standardised (mean 50, SD 10). Percentiles are relative to the Sri Lanka general population norm.
      </p>
    </>
  );
}

// ── Competency Results View ────────────────────────────────────────────────────

function CompetencyResultsView({
  assessmentId, participantId,
}: { assessmentId: string; participantId: string }) {
  const { data: profile, isLoading } = useApi<CompetencyProfileResult[]>(
    `/assessments/${assessmentId}/competency/profile/${participantId}`,
  );

  if (isLoading) return <PageSpinner />;

  if (!profile || profile.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        Results are not yet available. Please complete the assessment first.
      </div>
    );
  }

  const radarAxes: RadarAxis[] = profile.map(domain => ({
    key: domain.domainId,
    label: domain.domainName,
    value: domain.averageSelfRating !== null ? Math.round((domain.averageSelfRating / 4) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      {radarAxes.length >= 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Competency Profile Radar</h2>
              <p className="text-xs text-gray-500 mt-0.5">Average self-ratings across domains</p>
            </div>
            <Badge variant="success">Completed</Badge>
          </div>
          <div className="flex justify-center">
            <RadarChart axes={radarAxes} size={320} />
          </div>
        </div>
      )}

      {profile.map((domain) => (
        <div key={domain.domainId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: domain.domainColour }}
              />
              <h3 className="text-sm font-semibold text-gray-900">{domain.domainName}</h3>
            </div>
            {domain.averageSelfRating !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Avg</span>
                <Badge variant={PROFICIENCY_VARIANTS[Math.round(domain.averageSelfRating) - 1] ?? 'neutral'}>
                  {PROFICIENCY[Math.round(domain.averageSelfRating) - 1] ?? '—'}
                </Badge>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {domain.competencies.map((comp) => {
              const level = comp.selfRating ?? 0;
              const pct = Math.round((level / 4) * 100);
              return (
                <div key={comp.competencyId} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{comp.name}</p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: domain.domainColour }}
                      />
                    </div>
                  </div>
                  <Badge variant={PROFICIENCY_VARIANTS[level - 1] ?? 'neutral'}>
                    {level > 0 ? PROFICIENCY[level - 1] : 'Not rated'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssessmentResultsPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;
  const currentUser = useAuthStore((s) => s.user);

  const { data: assessment, isLoading: loadingAssessment } =
    useApi<AssessmentDto>(`/assessments/${assessmentId}`);

  const { data: participants, isLoading: loadingParticipants } =
    useApi<AssessmentParticipant[]>(assessment ? `/assessments/${assessmentId}/participants` : null);

  const myRecord = participants?.find((p) => p.userId === currentUser?.id);

  const loading = loadingAssessment || loadingParticipants;

  if (loading) return <PageSpinner />;

  if (!assessment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">Assessment not found.</div>
      </div>
    );
  }

  if (!myRecord) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          You are not enrolled as a participant in this assessment.
        </div>
      </div>
    );
  }

  const typeLabel = {
    [AssessmentType.FEEDBACK_360]: '360° Feedback',
    [AssessmentType.COMPETENCY]: 'Competency',
    [AssessmentType.PERSONALITY]: 'Personality',
    [AssessmentType.READINESS]: 'Readiness',
  }[assessment.assessmentType] ?? assessment.assessmentType;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-6">
        <button
          onClick={() => router.push('/my-assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My Assessments
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{assessment.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{typeLabel} Assessment — Your Results</p>
      </div>

      {(assessment.assessmentType === AssessmentType.COMPETENCY ||
        assessment.assessmentType === AssessmentType.FEEDBACK_360) && (
        <CompetencyResultsView assessmentId={assessmentId} participantId={myRecord.id} />
      )}

      {assessment.assessmentType === AssessmentType.PERSONALITY && (
        <PersonalityResultsView
          assessmentId={assessmentId}
          participantId={myRecord.id}
          assessmentTitle={assessment.title}
        />
      )}

      {assessment.assessmentType === AssessmentType.READINESS && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
          Readiness results are reviewed by your HR team and will be shared with you once available.
        </div>
      )}
    </div>
  );
}
