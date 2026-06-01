'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

// ── Standalone page — no auth, no app shell ───────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const raterApi = axios.create({ baseURL: BASE });

type Screen = 'loading' | 'error' | 'landing' | 'feedback' | 'overall' | 'thankyou';

interface RaterLanding {
  participantName: string;
  assessmentTitle: string;
  completionMinutes: number;
  language: string;
}

interface BehaviourItem {
  id: string;
  statement: string;
  displayOrder: number;
}

interface CompetencyCluster {
  id: string;
  name: string;
  description?: string;
  behaviours: BehaviourItem[];
}

interface ClusterState {
  competencyId: string;
  ratings: Record<string, number>;
  comment: string;
}

const SCALE = [
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Occasionally' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Consistently' },
];

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Scale Button ──────────────────────────────────────────────────────────────
function ScaleButton({
  value,
  label,
  selected,
  onClick,
}: {
  value: number;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
        selected
          ? 'bg-blue-600 border-blue-600 text-white shadow-md'
          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <span className="text-base font-bold">{value}</span>
      <span className="text-[9px] text-center leading-tight px-0.5">{label}</span>
    </button>
  );
}

// ── Main Rater Page ───────────────────────────────────────────────────────────
export default function RaterPage() {
  const params = useParams();
  const token = params.token as string;

  const [screen, setScreen] = useState<Screen>('loading');
  const [landing, setLanding] = useState<RaterLanding | null>(null);
  const [clusters, setClusters] = useState<CompetencyCluster[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [clusterIndex, setClusterIndex] = useState(0);
  const [clusterStates, setClusterStates] = useState<ClusterState[]>([]);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [developmentComment, setDevelopmentComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load landing info and clusters on mount
  useEffect(() => {
    async function init() {
      try {
        const [landingRes, clustersRes] = await Promise.all([
          raterApi.get<{ data: RaterLanding }>(`/rater/${token}`),
          raterApi.get<{ data: CompetencyCluster[] }>(`/rater/${token}/competencies`),
        ]);
        setLanding(landingRes.data.data);
        const loadedClusters = clustersRes.data.data;
        setClusters(loadedClusters);
        setClusterStates(
          loadedClusters.map((c) => ({ competencyId: c.id, ratings: {}, comment: '' })),
        );
        setScreen('landing');
      } catch (err: unknown) {
        const code = (err as any)?.response?.data?.error?.code ?? '';
        if (code === 'RATER_TOKEN_INVALID') {
          setErrorMsg('This feedback link is invalid or has already been used.');
        } else if (code === 'RATER_TOKEN_EXPIRED') {
          setErrorMsg('This feedback link has expired. Contact the assessment administrator.');
        } else {
          setErrorMsg(
            (err as any)?.response?.data?.error?.message ??
              'This feedback link could not be loaded. It may be invalid or expired.',
          );
        }
        setScreen('error');
      }
    }
    init();
  }, [token]);

  const currentCluster = clusters[clusterIndex];
  const currentState = clusterStates[clusterIndex];
  const totalClusters = clusters.length;

  // Auto-save via debounce
  const debouncedRatings = useDebounce(currentState?.ratings ?? {}, 500);
  const prevRatingsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!currentCluster || !currentState) return;
    const hasChanged = JSON.stringify(debouncedRatings) !== JSON.stringify(prevRatingsRef.current);
    if (!hasChanged || Object.keys(debouncedRatings).length === 0) return;
    prevRatingsRef.current = debouncedRatings;

    const autoSave = async () => {
      setSaving(true);
      try {
        await raterApi.post(`/rater/${token}/responses`, {
          competencyId: currentCluster.id,
          ratings: Object.entries(debouncedRatings).map(([behaviourId, score]) => ({
            behaviourId,
            score,
          })),
          comment: currentState.comment,
        });
      } catch {
        // silent auto-save failure
      } finally {
        setSaving(false);
      }
    };
    autoSave();
  }, [debouncedRatings, currentCluster, currentState, token]);

  function setRating(behaviourId: string, score: number) {
    setClusterStates((prev) =>
      prev.map((s, i) =>
        i === clusterIndex
          ? { ...s, ratings: { ...s.ratings, [behaviourId]: score } }
          : s,
      ),
    );
  }

  function setComment(text: string) {
    setClusterStates((prev) =>
      prev.map((s, i) => (i === clusterIndex ? { ...s, comment: text } : s)),
    );
  }

  async function saveAndContinue() {
    if (!currentCluster || !currentState) return;
    setSaving(true);
    try {
      await raterApi.post(`/rater/${token}/responses`, {
        competencyId: currentCluster.id,
        ratings: Object.entries(currentState.ratings).map(([behaviourId, score]) => ({
          behaviourId,
          score,
        })),
        comment: currentState.comment,
      });
    } catch {
      // If auto-save already saved this, that's fine
    } finally {
      setSaving(false);
    }

    if (clusterIndex < totalClusters - 1) {
      setClusterIndex((i) => i + 1);
    } else {
      setScreen('overall');
    }
  }

  async function submitOverall() {
    setSubmitting(true);
    try {
      await raterApi.post(`/rater/${token}/overall`, {
        overallRating,
        developmentComment: developmentComment || undefined,
      });
      setScreen('thankyou');
    } catch (err: unknown) {
      alert(
        (err as any)?.response?.data?.error?.message ?? 'Failed to submit. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (screen === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Thank You ──────────────────────────────────────────────────────────────
  if (screen === 'thankyou') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-md p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thank you for your feedback</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your responses have been recorded anonymously. They will only be shared as part of a
            group summary to protect your identity.
          </p>
        </div>
      </div>
    );
  }

  // ── Landing ────────────────────────────────────────────────────────────────
  if (screen === 'landing' && landing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">You have been invited to provide feedback</h1>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">For</span>
              <span className="font-semibold text-gray-900">{landing.participantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Assessment</span>
              <span className="font-semibold text-gray-900 text-right max-w-[200px] leading-snug">
                {landing.assessmentTitle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time required</span>
              <span className="font-semibold text-gray-900">~{landing.completionMinutes} minutes</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd" />
            </svg>
            <p className="text-xs text-blue-700 leading-relaxed">
              Your responses are completely anonymous. Results will only be shared when a minimum
              of 3 raters have responded from each group.
            </p>
          </div>

          <button
            onClick={() => setScreen('feedback')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3.5 text-base transition-colors"
          >
            Begin Feedback
          </button>
        </div>
      </div>
    );
  }

  // ── Feedback Screen ────────────────────────────────────────────────────────
  if (screen === 'feedback' && currentCluster && currentState) {
    const sortedBehaviours = [...currentCluster.behaviours].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const allRated = sortedBehaviours.every(
      (b) => (currentState.ratings[b.id] ?? 0) > 0,
    );
    const pct = totalClusters > 0 ? Math.round((clusterIndex / totalClusters) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky progress header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Competency {clusterIndex + 1} of {totalClusters}</span>
              <span className="flex items-center gap-1.5">
                {saving && (
                  <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {pct}% complete
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{currentCluster.name}</h2>
          {currentCluster.description && (
            <p className="text-sm text-gray-500 mb-1">{currentCluster.description}</p>
          )}
          <p className="text-sm text-gray-500 mb-6">
            Rate how frequently this leader demonstrates each behaviour.
          </p>

          {/* Scale legend */}
          <div className="flex gap-1 mb-5 text-center">
            {SCALE.map((s) => (
              <div key={s.value} className="flex-1">
                <div className="text-xs font-semibold text-gray-600 mb-0.5">{s.value}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            {sortedBehaviours.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-800 mb-3 font-medium leading-relaxed">{b.statement}</p>
                <div className="flex gap-2">
                  {SCALE.map((s) => (
                    <ScaleButton
                      key={s.value}
                      value={s.value}
                      label={s.label}
                      selected={currentState.ratings[b.id] === s.value}
                      onClick={() => setRating(b.id, s.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Optional: Add a comment about this competency area
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional comment…"
              value={currentState.comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-6">
            {clusterIndex > 0 && (
              <button
                onClick={() => setClusterIndex((c) => c - 1)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={saveAndContinue}
              disabled={!allRated || saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {clusterIndex < totalClusters - 1 ? 'Save & Continue' : 'Continue to Final Step'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Overall Screen ─────────────────────────────────────────────────────────
  if (screen === 'overall') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Final step</span>
              <span>95% complete</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '95%' }} />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Overall Assessment</h2>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Overall Leadership Effectiveness
            </label>
            <p className="text-xs text-gray-400 mb-4">
              1 = Needs significant development &nbsp;·&nbsp; 10 = Exceptional
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setOverallRating(n)}
                  className={`h-11 rounded-lg border-2 text-sm font-semibold transition-all ${
                    overallRating === n
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Poor</span>
              <span>Average</span>
              <span>Excellent</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What is the one thing this leader should focus on developing?
            </label>
            <textarea
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional but valuable…"
              value={developmentComment}
              onChange={(e) => setDevelopmentComment(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setScreen('feedback'); setClusterIndex(totalClusters - 1); }}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={submitOverall}
              disabled={submitting || overallRating === null}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
