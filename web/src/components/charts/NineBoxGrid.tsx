'use client';

import { cn } from '@/lib/utils';

interface Candidate {
  name: string;
  performance: 'high' | 'medium' | 'low';
  potential: 'high' | 'medium' | 'low';
  readinessRating?: string;
}

interface NineBoxGridProps {
  candidates: Candidate[];
}

const PERFORMANCE_COLS = ['low', 'medium', 'high'] as const;
const POTENTIAL_ROWS = ['high', 'medium', 'low'] as const;

function getCellColor(performance: string, potential: string): string {
  if (performance === 'high' && potential === 'high') return 'bg-green-100 border-green-300';
  if (performance === 'high' && potential === 'medium') return 'bg-green-50 border-green-200';
  if (performance === 'medium' && potential === 'high') return 'bg-green-50 border-green-200';
  if (performance === 'medium' && potential === 'medium') return 'bg-yellow-50 border-yellow-200';
  if (performance === 'low' && potential === 'high') return 'bg-yellow-50 border-yellow-200';
  if (performance === 'high' && potential === 'low') return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function getCellLabel(performance: string, potential: string): string {
  if (performance === 'high' && potential === 'high') return 'Star';
  if (performance === 'high' && potential === 'medium') return 'High Performer';
  if (performance === 'medium' && potential === 'high') return 'Future Star';
  if (performance === 'medium' && potential === 'medium') return 'Core Player';
  if (performance === 'low' && potential === 'high') return 'Enigma';
  if (performance === 'high' && potential === 'low') return 'Solid Contributor';
  if (performance === 'low' && potential === 'medium') return 'Inconsistent';
  if (performance === 'medium' && potential === 'low') return 'Effective';
  return 'Risk';
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0"
      title={name}
    >
      {initials}
    </div>
  );
}

export function NineBoxGrid({ candidates }: NineBoxGridProps) {
  function getCandidatesForCell(perf: string, pot: string) {
    return candidates.filter((c) => c.performance === perf && c.potential === pot);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        {/* Y-axis label */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-16 shrink-0" />
          <div className="flex-1 grid grid-cols-3 gap-1">
            {PERFORMANCE_COLS.map((p) => (
              <div key={p} className="text-center text-xs font-medium text-gray-500 capitalize">
                {p} Performance
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Potential axis */}
          <div className="flex flex-col justify-around w-16 shrink-0">
            {POTENTIAL_ROWS.map((pot) => (
              <div
                key={pot}
                className="text-xs font-medium text-gray-500 capitalize text-right pr-2 leading-tight"
              >
                {pot}
                <br />
                Potential
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 grid grid-rows-3 gap-1">
            {POTENTIAL_ROWS.map((pot) => (
              <div key={pot} className="grid grid-cols-3 gap-1">
                {PERFORMANCE_COLS.map((perf) => {
                  const cellCandidates = getCandidatesForCell(perf, pot);
                  const colorClass = getCellColor(perf, pot);
                  const label = getCellLabel(perf, pot);
                  return (
                    <div
                      key={`${perf}-${pot}`}
                      className={cn(
                        'rounded-lg border p-2 min-h-[90px] flex flex-col',
                        colorClass,
                      )}
                    >
                      <p className="text-[10px] font-semibold text-gray-500 mb-1.5">{label}</p>
                      <div className="flex flex-wrap gap-1">
                        {cellCandidates.map((c) => (
                          <div key={c.name} className="flex flex-col items-center gap-0.5">
                            <Avatar name={c.name} />
                            <span className="text-[9px] text-gray-600 text-center leading-tight max-w-[36px] truncate">
                              {c.name.split(' ')[0]}
                            </span>
                          </div>
                        ))}
                        {cellCandidates.length === 0 && (
                          <p className="text-[10px] text-gray-400 italic">Empty</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
