// CSV export for backtest trade logs. Pure functions, no DOM side effects
// except the caller-supplied blob downloader.

import type { BacktestTrade } from './types';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string for a backtest's trade log. Deterministic — the same
 * trade log always yields the same CSV text.
 */
export function tradesToCsv(trades: BacktestTrade[]): string {
  const header = ['trade', 'rule', 'direction', 'entry_bar', 'exit_bar', 'pnl_usd', 'equity_after_usd'];
  const rows = trades.map((t, i) =>
    [
      i + 1,
      t.rule,
      t.direction === 1 ? 'LONG' : 'SHORT',
      t.entryBar,
      t.exitBar,
      t.pnl.toFixed(2),
      t.equityAfter.toFixed(2),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}

/** Trigger a client-side download of a text file. */
export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
