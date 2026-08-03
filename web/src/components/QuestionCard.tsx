'use client';

import { cn } from '@/lib/utils';
import { Answer, FormQuestion } from '@leaderprism/shared';

export function isAnswered(q: FormQuestion, answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) return !q.required;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === 'object') {
    return q.required ? Object.keys(answer).length === q.tableRows.length : true;
  }
  return true;
}

export function getAnswerLabel(q: FormQuestion, ans: Answer): string {
  if (q.type === 'SINGLE_CHOICE') {
    return q.options.find((o) => o.id === ans)?.text ?? String(ans);
  }
  if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(ans)) {
    return ans.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(', ') || '—';
  }
  if (q.type === 'TRUE_FALSE') return ans === 'true' ? 'True' : 'False';
  if (q.type === 'TABLE' && typeof ans === 'object' && !Array.isArray(ans)) {
    const entries = Object.entries(ans as Record<string, string>);
    return entries.map(([ri, ci]) => `${q.tableRows[Number(ri)]}: ${q.tableColumns[Number(ci)]}`).join('; ') || '—';
  }
  return String(ans);
}

export function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: FormQuestion;
  answer: Answer | undefined;
  onChange: (val: Answer) => void;
}) {
  const { type, options, tableRows, tableColumns } = question;

  if (type === 'SINGLE_CHOICE') {
    return (
      <div className="space-y-2.5">
        {options.map((opt) => {
          const selected = answer === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
              )}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-gray-800">{opt.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (type === 'MULTIPLE_CHOICE') {
    const selected = Array.isArray(answer) ? answer : [];
    return (
      <div className="space-y-2.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => {
                const next = checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id];
                onChange(next);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                checked ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
              )}>
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-800">{opt.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (type === 'TRUE_FALSE') {
    return (
      <div className="flex gap-4">
        {(['true', 'false'] as const).map((val) => (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={cn(
              'flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-all',
              answer === val ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50',
            )}
          >
            {val === 'true' ? 'True' : 'False'}
          </button>
        ))}
      </div>
    );
  }

  if (type === 'SHORT_ANSWER') {
    return (
      <textarea
        rows={4}
        value={(answer as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer here…"
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    );
  }

  if (type === 'TABLE') {
    const tableAnswer = (typeof answer === 'object' && !Array.isArray(answer) ? answer : {}) as Record<string, string>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-gray-500 font-medium min-w-[140px]" />
              {tableColumns.map((col, ci) => (
                <th key={ci} className="text-center px-2 py-2 text-xs text-gray-600 font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className="border-t border-gray-100">
                <td className="py-3 pr-4 text-gray-800 font-medium text-sm">{row}</td>
                {tableColumns.map((_, ci) => {
                  const colKey = String(ci);
                  const selected = tableAnswer[String(ri)] === colKey;
                  return (
                    <td key={ci} className="text-center px-2 py-3">
                      <button
                        onClick={() => onChange({ ...tableAnswer, [String(ri)]: colKey })}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all',
                          selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 hover:border-blue-400',
                        )}
                      >
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
