import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

// Hierarchical, collapsible activity view:  Year → Month → Week → Day logs.
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const badgeCls = (s) => s >= 80 ? 'bg-green-100 text-green-700'
  : s >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

function getTaskData(activities, taskId) {
  const t = (activities || []).find(
    (d) => (d.activityId ? d.activityId : (d.id || '').split('_')[1] || '') === taskId
  );
  if (!t) return { attempts: 0, a1: null, a2: null };
  const arr = Array.isArray(t.attempts) ? t.attempts : [];
  const num = (x) => (typeof x === 'number' ? x : null);
  const a1 = typeof t.attempt1Score === 'number' ? t.attempt1Score : num(arr[0]?.score);
  const a2 = typeof t.attempt2Score === 'number' ? t.attempt2Score : num(arr[1]?.score);
  const attempts = typeof t.attemptCount === 'number' ? t.attemptCount : arr.length;
  return { attempts: Math.min(2, attempts), a1, a2 };
}

function dayScoreList(activities) {
  const s = [];
  for (const id of ['daily-1', 'daily-2', 'daily-3', 'daily-4']) {
    const t = getTaskData(activities, id);
    if (t.a1 != null) s.push(t.a1);
    if (t.a2 != null) s.push(t.a2);
  }
  return s;
}

function buildTree(dates) {
  const years = {};
  for (const g of dates || []) {
    const p = (g.dateKey || '').split('-');
    if (p.length < 3) continue;
    const [y, m, d] = p;
    const wk = Math.ceil(parseInt(d, 10) / 7); // week-of-month (1–5)
    if (!years[y]) years[y] = {};
    if (!years[y][m]) years[y][m] = {};
    if (!years[y][m][wk]) years[y][m][wk] = [];
    years[y][m][wk].push({
      dateKey: g.dateKey, day: parseInt(d, 10), activities: g.activities, scores: dayScoreList(g.activities),
    });
  }
  return Object.keys(years).sort((a, b) => b.localeCompare(a)).map((y) => {
    const months = Object.keys(years[y]).sort((a, b) => b.localeCompare(a)).map((m) => {
      const weeks = Object.keys(years[y][m]).sort((a, b) => b - a).map((w) => {
        const days = years[y][m][w].sort((a, b) => b.day - a.day);
        return { week: w, days, scores: days.flatMap((d) => d.scores), activeDays: days.length };
      });
      return {
        month: m, label: MONTHS[parseInt(m, 10) - 1] || m, weeks,
        scores: weeks.flatMap((w) => w.scores),
        activeDays: weeks.reduce((s, w) => s + w.activeDays, 0),
      };
    });
    return {
      year: y, months, scores: months.flatMap((mm) => mm.scores),
      activeDays: months.reduce((s, mm) => s + mm.activeDays, 0),
    };
  });
}

const Avg = ({ s }) => (s == null ? null
  : <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${badgeCls(s)}`}>avg {s}%</span>);

export default function UserActivityTree({ dates }) {
  const tree = buildTree(dates);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) => setOpen((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  if (tree.length === 0) return <div className="text-sm text-gray-400">No activity data yet.</div>;

  return (
    <div className="space-y-2">
      {tree.map((Y) => {
        const yOpen = open.has(Y.year);
        return (
          <div key={Y.year} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <button onClick={() => toggle(Y.year)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="flex items-center gap-2 font-bold text-gray-900">
                <ChevronRight className={`w-4 h-4 transition-transform ${yOpen ? 'rotate-90' : ''}`} /> {Y.year}
              </span>
              <span className="flex items-center gap-2 text-xs text-gray-500">{Y.activeDays} days <Avg s={avg(Y.scores)} /></span>
            </button>

            {yOpen && (
              <div className="p-2 space-y-1.5">
                {Y.months.map((M) => {
                  const mk = `${Y.year}-${M.month}`;
                  const mOpen = open.has(mk);
                  return (
                    <div key={mk} className="rounded-lg border border-gray-100">
                      <button onClick={() => toggle(mk)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 transition-colors">
                        <span className="flex items-center gap-2 font-medium text-gray-800 text-sm">
                          <ChevronRight className={`w-4 h-4 transition-transform ${mOpen ? 'rotate-90' : ''}`} /> {M.label}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-gray-400">{M.activeDays}d <Avg s={avg(M.scores)} /></span>
                      </button>

                      {mOpen && (
                        <div className="pl-3 sm:pl-4 pr-2 pb-2 space-y-1.5">
                          {M.weeks.map((W) => {
                            const wk = `${mk}-${W.week}`;
                            const wOpen = open.has(wk);
                            return (
                              <div key={wk} className="rounded-lg border border-gray-100">
                                <button onClick={() => toggle(wk)}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                                  <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${wOpen ? 'rotate-90' : ''}`} /> Week {W.week}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs text-gray-400">{W.activeDays}d <Avg s={avg(W.scores)} /></span>
                                </button>

                                {wOpen && (
                                  <div className="pl-3 sm:pl-4 pr-2 pb-2 space-y-2">
                                    {W.days.map((D) => (
                                      <div key={D.dateKey} className="rounded-lg bg-gray-50/70 border border-gray-100 p-2.5">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-medium text-gray-700">{D.dateKey}</span>
                                          <Avg s={avg(D.scores)} />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {['daily-1', 'daily-2', 'daily-3', 'daily-4'].map((id, i) => {
                                            const t = getTaskData(D.activities, id);
                                            return (
                                              <div key={id} className="flex items-center gap-1 rounded-md bg-white border border-gray-100 px-2 py-1">
                                                <span className="text-[11px] font-medium text-gray-400">D{i + 1}</span>
                                                {[t.a1, t.a2].map((s, k) => s != null ? (
                                                  <span key={k} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${badgeCls(s)}`}>{s}%</span>
                                                ) : <span key={k} className="text-gray-300 text-[11px]">—</span>)}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
