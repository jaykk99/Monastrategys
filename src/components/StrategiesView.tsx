import { useMemo, useState } from 'react';
import { runBacktestEngine } from '../lib/backtest';
import { ASSET_CATEGORIES, TIMEFRAMES, type PlanName, type Strategy } from '../lib/types';
import { StrategyCard } from './StrategyCard';

interface Props {
  strategies: Strategy[];
  plan: PlanName;
  isAdmin: boolean;
  unlockedStrats: string[];
  starterLeft: number;
  onOpen: (s: Strategy) => void;
  onEdit: (s: Strategy) => void;
  onDelete: (s: Strategy) => void;
  onUnlockRandom: () => void;
}

type SortKey = 'newest' | 'winrate' | 'profitfactor';

export function StrategiesView({
  strategies,
  plan,
  isAdmin,
  unlockedStrats,
  starterLeft,
  onOpen,
  onEdit,
  onDelete,
  onUnlockRandom,
}: Props) {
  const [search, setSearch] = useState('');
  const [filterAsset, setFilterAsset] = useState('ALL');
  const [filterTimeframe, setFilterTimeframe] = useState('ALL');
  const [filterAuto, setFilterAuto] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('newest');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // stats needed for stat sorts — computed lazily via engine inside card; here
    // we keep a light deterministic ordering by id hash for "top" sorts only when
    // the user asks. To avoid recompute, sort by id hash is stable enough.
    const list = strategies
      .filter((s) => filterAsset === 'ALL' || s.assetCategory === filterAsset)
      .filter((s) => filterTimeframe === 'ALL' || (s.timeframes ?? []).includes(filterTimeframe))
      .filter((s) => {
        if (filterAuto === 'ALL') return true;
        if (filterAuto === 'AUTO') return s.isAutoTrade;
        return !s.isAutoTrade;
      })
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      );
    if (sort === 'newest') return list;
    // Deterministic "performance" ordering from the simulated engine stats.
    const scored = list.map((s) => ({ s, stats: runBacktestEngine(s.id) }));
    scored.sort((a, b) =>
      sort === 'winrate'
        ? b.stats.winRate - a.stats.winRate
        : b.stats.profitFactor - a.stats.profitFactor,
    );
    return scored.map((x) => x.s);
  }, [strategies, search, filterAsset, filterTimeframe, filterAuto, sort]);

  const selectCls =
    'bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-terminal-green/60 transition-colors';

  return (
    <div className="absolute inset-0 bg-black p-6 flex flex-col z-20 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/10 pb-4 mb-5 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">Strategies</h2>
          <span className="text-[10px] text-zinc-500 tracking-widest border border-white/10 rounded-full px-3 py-1">
            {filtered.length} LIVE
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search strategies..."
            className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-terminal-green/60 transition-colors w-full sm:w-52 normal-case"
          />
          <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)} className={selectCls}>
            <option value="ALL">ALL ASSETS</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filterTimeframe} onChange={(e) => setFilterTimeframe(e.target.value)} className={selectCls}>
            <option value="ALL">ALL TIMEFRAMES</option>
            {TIMEFRAMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filterAuto} onChange={(e) => setFilterAuto(e.target.value)} className={selectCls}>
            <option value="ALL">ALL TYPES</option>
            <option value="AUTO">AUTO TRADE (PRO)</option>
            <option value="MANUAL">MANUAL ONLY</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
            <option value="newest">SORT: NEWEST</option>
            <option value="winrate">SORT: WIN RATE</option>
            <option value="profitfactor">SORT: PROFIT FACTOR</option>
          </select>
          {plan === 'STARTER' && !isAdmin && (
            <button
              onClick={onUnlockRandom}
              className="bg-terminal-green text-black px-4 py-2 rounded-md text-[11px] font-bold tracking-widest hover:brightness-110 transition-all"
            >
              UNLOCK RANDOM ({starterLeft} LEFT)
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-20 content-start">
        {filtered.map((strat) => (
          <StrategyCard
            key={strat.id}
            strategy={strat}
            plan={plan}
            isAdmin={isAdmin}
            unlocked={unlockedStrats.includes(strat.id)}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="text-zinc-500 text-sm mb-2">No strategies match your filters.</div>
            <button
              onClick={() => {
                setSearch('');
                setFilterAsset('ALL');
                setFilterTimeframe('ALL');
                setFilterAuto('ALL');
              }}
              className="text-terminal-green text-xs font-bold tracking-widest hover:underline"
            >
              CLEAR FILTERS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
