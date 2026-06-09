'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { AssessmentDto, AssessmentStatus } from '@leaderprism/shared';

export default function EditAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: assessment, isLoading, error } = useApi<AssessmentDto>(`/assessments/${id}`);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (assessment) {
      setTitle(assessment.title ?? '');
      setStartDate(assessment.startDate ? assessment.startDate.slice(0, 10) : '');
      setEndDate(assessment.endDate ? assessment.endDate.slice(0, 10) : '');
    }
  }, [assessment]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/assessments/${id}`, {
        title: title.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
      });
      router.push(`/assessments/${id}`);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error?.message ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageSpinner />;
  if (error || !assessment) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error ? 'Failed to load assessment.' : 'Assessment not found.'}
      </div>
    );
  }

  const isDraft = assessment.status === AssessmentStatus.DRAFT;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/assessments/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Assessment
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Edit Assessment</h1>
      </div>

      {!isDraft && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800">
          This assessment is <span className="font-semibold">{assessment.status}</span>. Only the title and dates can be changed.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assessment Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            />
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-red-600">{saveError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.push(`/assessments/${id}`)}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
