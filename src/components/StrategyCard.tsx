import { useMemo } from 'react';
import { equitySparkPath, runBacktestEngine } from '../lib/backtest';
import type { PlanName, Strategy } from '../lib/types';

interface Props {
  strategy: Strategy;
  plan: PlanName;
  isAdmin: boolean;
  unlocked: boolean;
  onOpen: (s: Strategy) => void;
  onEdit: (s: Strategy) => void;
  onDelete: (s: Strategy) => void;
}

export function StrategyCard({ strategy, plan, isAdmin, unlocked, onOpen, onEdit, onDelete }: Props) {
  const stats = useMemo(() => runBacktestEngine(strategy.id), [strategy.id]);
  const spark = useMemo(
    () => equitySparkPath(stats.equity, 220, 56),
    [stats],
  );
  const positive = stats.netProfit >= 0;

  const canView = plan === 'PRO' || isAdmin || unlocked;
  const autoLocked = strategy.isAutoTrade && plan !== 'PRO' && !isAdmin;

  return (
    <div className="group relative bg-zinc-950 border border-white/10 rounded-xl p-5 flex flex-col hover:border-terminal-green/40 hover:shadow-[0_0_24px_rgba(0,255,65,0.06)] transition-all">
      {strategy.isAutoTrade && (
        <div
          className="absolute -top-2.5 -right-2.5 w-9 h-9 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border-2 border-black z-10"
          title="Pro AutoTrade Strategy"
        >
          <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      )}

      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(strategy); }}
            className="p-1.5 text-zinc-500 hover:text-blue-400 bg-black/70 rounded-full border border-white/10"
            title="Edit strategy"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(strategy); }}
            className="p-1.5 text-zinc-500 hover:text-red-400 bg-black/70 rounded-full border border-white/10"
            title="Delete strategy"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] text-zinc-400 font-bold px-2 py-1 bg-zinc-900 rounded border border-white/5 tracking-wider">
          {strategy.assetCategory}
        </span>
        <span className="text-[10px] text-zinc-500 tracking-wider">
          {(strategy.timeframes ?? []).join(' · ') || 'N/A'}
        </span>
        {unlocked && !isAdmin && (
          <span className="text-[10px] text-terminal-green font-bold tracking-widest ml-auto">UNLOCKED</span>
        )}
      </div>

      <h3 className="text-base font-bold text-white leading-snug mb-1 pr-8">{strategy.title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2 normal-case tracking-normal">
        {strategy.description}
      </p>

      {/* Performance sparkline (simulated engine) */}
      <div className="mb-4 rounded-lg bg-black/60 border border-white/5 p-2">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[9px] text-zinc-600 tracking-widest font-bold">SIM EQUITY</span>
          <span className={`text-[10px] font-bold ${positive ? 'text-terminal-green' : 'text-red-400'}`}>
            {positive ? '+' : ''}{stats.winRate.toFixed(1)}% WR
          </span>
        </div>
        <svg viewBox="0 0 220 56" className="w-full h-14" preserveAspectRatio="none" aria-hidden>
          <path
            d={spark}
            fill="none"
            stroke={positive ? '#00ff41' : '#f87171'}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex justify-between px-1 mt-1 text-[9px] text-zinc-600">
          <span>PF {stats.profitFactor.toFixed(2)}</span>
          <span>MAX DD {stats.maxDrawdown.toFixed(1)}%</span>
          <span>{stats.trades} TRADES</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={() => onOpen(strategy)}
          className={`w-full py-2.5 rounded-md text-xs font-bold tracking-widest transition-all ${
            canView
              ? 'bg-zinc-900 text-white hover:bg-zinc-800 border border-white/10'
              : 'bg-terminal-green text-black hover:brightness-110'
          }`}
        >
          {canView ? 'VIEW SOURCE' : autoLocked ? 'PRO ONLY' : 'UNLOCK'}
        </button>
      </div>
    </div>
  );
}
