import { useMemo, useState } from 'react';
import { BACKTEST_RULES, BACKTEST_RULE_LABELS } from '../lib/types';
import type { BacktestRule, Strategy } from '../lib/types';
import { formatPct, formatUsd, runAllRules } from '../lib/backtest';

interface Props {
  strategies: Strategy[];
}

type SortKey =
  | 'netProfit'
  | 'winRate'
  | 'profitFactor'
  | 'sharpe'
  | 'maxDrawdown'
  | 'expectancy'
  | 'trades'
  | 'recoveryFactor';

const COLUMNS: { key: SortKey; label: string; format: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { key: 'netProfit', label: 'NET P/L', format: formatUsd },
  { key: 'winRate', label: 'WIN RATE', format: (v) => formatPct(v) },
  { key: 'profitFactor', label: 'PROFIT FACTOR', format: (v) => v.toFixed(2) },
  { key: 'sharpe', label: 'SHARPE', format: (v) => v.toFixed(2) },
  { key: 'expectancy', label: 'EXPECTANCY', format: formatUsd },
  { key: 'maxDrawdown', label: 'MAX DD', format: (v) => formatPct(v), lowerIsBetter: true },
  { key: 'recoveryFactor', label: 'RECOVERY', format: (v) => v.toFixed(2) },
  { key: 'trades', label: 'TRADES', format: (v) => String(v) },
];

export function CompareView({ strategies }: Props) {
  const [rule, setRule] = useState<BacktestRule>('momentum');
  const [sortKey, setSortKey] = useState<SortKey>('netProfit');
  const [sortDesc, setSortDesc] = useState(true);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const ruleIdx = BACKTEST_RULES.indexOf(rule);
    const q = query.trim().toLowerCase();
    return strategies
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.assetCategory.toLowerCase().includes(q))
      .map((s) => {
        const stats = runAllRules(s.id)[ruleIdx];
        return { strategy: s, stats };
      });
  }, [strategies, rule, query]);

  const best = useMemo(() => {
    const out: Partial<Record<SortKey, number>> = {};
    for (const col of COLUMNS) {
      if (rows.length === 0) break;
      const vals = rows.map((r) => r.stats[col.key]);
      out[col.key] = col.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
    }
    return out;
  }, [rows]);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!;
    return [...rows].sort((a, b) => {
      const va = a.stats[sortKey];
      const vb = b.stats[sortKey];
      if (col.lowerIsBetter) return sortDesc ? va - vb : vb - va;
      return sortDesc ? vb - va : va - vb;
    });
  }, [rows, sortKey, sortDesc]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="absolute inset-0 bg-black p-6 md:p-10 flex flex-col items-center overflow-y-auto z-20">
      <div className="max-w-6xl w-full pb-20">
        <div className="flex items-end justify-between border-b border-white/10 pb-6 mb-8 flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Strategy Compare</h2>
            <p className="text-xs text-zinc-500 mt-2 tracking-widest">
              SIDE-BY-SIDE ON THE SAME SEEDED SIMULATED MARKET · NOT TRADING ADVICE
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter strategies..."
              className="bg-zinc-900 border border-white/10 px-3 py-2 text-sm text-white outline-none rounded-md focus:border-terminal-green/60 transition-colors normal-case w-44"
            />
            <div className="flex rounded-md border border-white/10 overflow-hidden">
              {BACKTEST_RULES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRule(r)}
                  title={BACKTEST_RULE_LABELS[r]}
                  className={`px-3 py-2 text-[11px] font-bold tracking-widest transition-colors ${
                    rule === r ? 'bg-terminal-green text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {r.toUpperCase().slice(0, 4)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-zinc-600 text-sm text-center py-16">No strategies match the filter.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="bg-zinc-900/70">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-widest text-zinc-500 sticky left-0 bg-zinc-900/70">
                    STRATEGY
                  </th>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="px-2 py-3">
                      <button
                        onClick={() => onSort(col.key)}
                        className={`text-[10px] font-bold tracking-widest transition-colors ${
                          sortKey === col.key ? 'text-terminal-green' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {col.label}
                        {sortKey === col.key && (sortDesc ? ' ↓' : ' ↑')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ strategy, stats }) => (
                  <tr key={strategy.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-black/80">
                      <div className="font-bold text-white truncate max-w-[220px]">{strategy.title}</div>
                      <div className="text-[10px] text-zinc-500 tracking-widest">
                        {strategy.assetCategory}
                        {strategy.isAutoTrade && <span className="text-yellow-400 font-bold"> · AUTOTRADE</span>}
                      </div>
                    </td>
                    {COLUMNS.map((col) => {
                      const v = stats[col.key];
                      const isBest = rows.length > 1 && best[col.key] === v;
                      const positive = col.key === 'maxDrawdown' ? false : v >= 0;
                      return (
                        <td key={col.key} className="px-2 py-3 text-center">
                          <span
                            className={`font-mono text-[13px] tabular-nums px-2 py-1 rounded ${
                              isBest
                                ? 'bg-terminal-green/15 text-terminal-green font-bold'
                                : positive
                                  ? 'text-zinc-200'
                                  : 'text-red-400'
                            }`}
                          >
                            {col.format(v)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-zinc-600 leading-relaxed mt-6 tracking-normal normal-case">
          Deterministic simulated engine: same strategy and rule always yield the same result. All strategies
          are evaluated on their own seeded market in the compare table above (each strategy gets its own
          seed, consistent across rules). Simulated only, not trading advice.
        </p>
      </div>
    </div>
  );
}
