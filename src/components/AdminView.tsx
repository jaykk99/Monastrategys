import { useState } from 'react';
import { ASSET_CATEGORIES, TIMEFRAMES } from '../lib/types';
import { validateEmail, validateStrategy } from '../lib/validation';

export interface StrategyFormData {
  title: string;
  description: string;
  assetCategory: string;
  timeframes: string[];
  content: string;
  isAutoTrade: boolean;
}

interface FormProps {
  initial: StrategyFormData;
  busy: boolean;
  submitLabel: string;
  onSubmit: (data: StrategyFormData) => Promise<string | void>;
  onCancel?: () => void;
}

export function StrategyForm({ initial, busy, submitLabel, onSubmit, onCancel }: FormProps) {
  const [data, setData] = useState<StrategyFormData>(initial);
  const [error, setError] = useState('');

  const toggleTf = (tf: string) =>
    setData((d) => ({
      ...d,
      timeframes: d.timeframes.includes(tf)
        ? d.timeframes.filter((t) => t !== tf)
        : [...d.timeframes, tf],
    }));

  const submit = async () => {
    setError('');
    const v = validateStrategy(data);
    if (!v.ok) return setError(v.error!);
    const errMsg = await onSubmit(data);
    if (errMsg) setError(errMsg);
    else if (!onCancel) {
      // create mode: reset
      setData({ ...initial, timeframes: [] });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 tracking-widest">TITLE</label>
          <input
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            maxLength={120}
            className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-terminal-green/60 transition-colors normal-case"
            placeholder="Strategy title"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 tracking-widest">CATEGORY</label>
          <select
            value={data.assetCategory}
            onChange={(e) => setData({ ...data, assetCategory: e.target.value })}
            className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-terminal-green/60 transition-colors"
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-400 tracking-widest">TIMEFRAMES</label>
        <div className="grid grid-cols-4 gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => toggleTf(tf)}
              className={`p-2.5 rounded-md border text-xs font-bold transition-all ${
                data.timeframes.includes(tf)
                  ? 'bg-terminal-green text-black border-terminal-green'
                  : 'bg-zinc-900 text-zinc-500 border-white/10 hover:border-zinc-500'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-400 tracking-widest">DESCRIPTION</label>
        <input
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          maxLength={500}
          className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-terminal-green/60 transition-colors normal-case"
          placeholder="Brief description"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-400 tracking-widest">PINE SCRIPT SOURCE</label>
        <textarea
          value={data.content}
          onChange={(e) => setData({ ...data, content: e.target.value })}
          className="w-full bg-zinc-900 border border-white/10 p-4 rounded-md font-mono text-xs text-zinc-300 h-72 outline-none focus:border-terminal-green/60 transition-colors normal-case"
          placeholder="Paste Pine Script code here..."
          spellCheck={false}
        />
      </div>

      <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-md border border-white/5">
        <div>
          <div className="text-sm font-medium text-white">Auto Trade Strategy</div>
          <div className="text-[10px] text-zinc-500 normal-case tracking-normal">Pro users get webhook-ready execution</div>
        </div>
        <button
          type="button"
          onClick={() => setData({ ...data, isAutoTrade: !data.isAutoTrade })}
          className={`px-5 py-2 rounded-md text-xs font-bold tracking-widest transition-all ${
            data.isAutoTrade ? 'bg-terminal-green text-black' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {data.isAutoTrade ? 'ON' : 'OFF'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/5 rounded-md p-3 normal-case tracking-normal">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 bg-zinc-900 text-zinc-300 py-3.5 rounded-md font-bold text-sm tracking-widest hover:bg-zinc-800 transition-all"
          >
            CANCEL
          </button>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 bg-white text-black py-3.5 rounded-md font-bold text-sm tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
        >
          {busy ? 'WORKING...' : submitLabel}
        </button>
      </div>
    </div>
  );
}

interface AdminProps {
  busy: boolean;
  userOp: 'IDLE' | 'LOADING' | 'SUCCESS';
  onUpload: (data: StrategyFormData) => Promise<string | void>;
  onUpgradeUser: (email: string) => Promise<string | void>;
  onDowngradeUser: (email: string) => Promise<string | void>;
}

export function AdminView({ busy, userOp, onUpload, onUpgradeUser, onDowngradeUser }: AdminProps) {
  const [targetEmail, setTargetEmail] = useState('');
  const [userError, setUserError] = useState('');

  const runUserOp = async (op: (email: string) => Promise<string | void>) => {
    setUserError('');
    const v = validateEmail(targetEmail);
    if (!v.ok) return setUserError(v.error!);
    const errMsg = await op(targetEmail.trim().toLowerCase());
    if (errMsg) setUserError(errMsg);
    else setTargetEmail('');
  };

  return (
    <div className="absolute inset-0 bg-black p-6 md:p-10 flex flex-col items-center z-20 overflow-y-auto">
      <div className="max-w-4xl w-full pb-20">
        <h2 className="text-3xl font-bold tracking-tight mb-8 border-b border-white/10 pb-6 text-white">
          Admin Dashboard
        </h2>

        <div className="mb-8 space-y-5 bg-zinc-950 p-6 md:p-8 rounded-xl border border-white/10">
          <h3 className="text-base font-bold text-white">User Management</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-terminal-green/60 transition-colors normal-case"
                placeholder="user@example.com"
                type="email"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runUserOp(onUpgradeUser)}
                disabled={userOp === 'LOADING' || !targetEmail}
                className="bg-terminal-green text-black px-6 py-3 rounded-md font-bold text-xs tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
              >
                {userOp === 'LOADING' ? 'WORKING...' : 'GRANT PRO'}
              </button>
              <button
                onClick={() => runUserOp(onDowngradeUser)}
                disabled={userOp === 'LOADING' || !targetEmail}
                className="bg-zinc-800 text-zinc-300 px-5 py-3 rounded-md font-bold text-xs tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
              >
                RESET TO STARTER
              </button>
            </div>
          </div>
          {userError && (
            <div className="text-xs text-red-400 normal-case tracking-normal">{userError}</div>
          )}
          {userOp === 'SUCCESS' && (
            <div className="text-xs text-terminal-green normal-case tracking-normal">Done.</div>
          )}
          <p className="text-[10px] text-zinc-600 italic normal-case tracking-normal">
            Granting PRO gives permanent access to all strategies and auto-trading features.
          </p>
        </div>

        <div className="space-y-5 bg-zinc-950 p-6 md:p-8 rounded-xl border border-white/10">
          <h3 className="text-base font-bold text-white">Publish Strategy</h3>
          <StrategyForm
            initial={{
              title: '',
              description: '',
              assetCategory: 'CRYPTO',
              timeframes: [],
              content: '',
              isAutoTrade: false,
            }}
            busy={busy}
            submitLabel="PUBLISH STRATEGY"
            onSubmit={onUpload}
          />
        </div>
      </div>
    </div>
  );
}
