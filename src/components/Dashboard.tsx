import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { logout } from '../firebase';
import TradingViewWidget from './TradingViewWidget';
import { Terminal, Lock, Unlock, ShieldAlert, Cpu, Activity, LogOut, CheckCircle } from 'lucide-react';
import { collection, onSnapshot, query, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Strategy {
  id: string;
  name: string;
  description: string;
  tier: 'STARTER' | 'BASIC' | 'PRO';
  code: string;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeTab, setActiveTab] = useState<'CHART' | 'STRATEGIES' | 'UPGRADE' | 'ADMIN'>('CHART');

  const handleSeedStrategies = async () => {
    const seedData: Strategy[] = [
      { id: 'strat_1', name: 'MOMENTUM_SCALPER', description: 'High-frequency momentum scalping algorithm.', tier: 'STARTER', code: '...' },
      { id: 'strat_2', name: 'MEAN_REVERSION_V2', description: 'Statistical arbitrage using Bollinger Bands.', tier: 'BASIC', code: '...' },
      { id: 'strat_3', name: 'ORDER_BLOCK_SNIPER', description: 'Institutional order block detection.', tier: 'BASIC', code: '...' },
      { id: 'strat_4', name: 'LIQUIDITY_SWEEP', description: 'Hunts stop losses at major swing points.', tier: 'PRO', code: '...' },
      { id: 'strat_5', name: 'NEURAL_NET_PREDICT', description: 'LSTM based price prediction model.', tier: 'PRO', code: '...' }
    ];

    try {
      for (const strat of seedData) {
        await addDoc(collection(db, 'strategies'), {
          ...strat,
          createdAt: new Date().toISOString()
        });
      }
      alert('STRATEGIES_SEEDED_SUCCESSFULLY');
    } catch (err) {
      console.error(err);
      alert('ERROR_SEEDING_STRATEGIES');
    }
  };
  const [txHash, setTxHash] = useState('');
  const [upgradePlan, setUpgradePlan] = useState<'BASIC' | 'PRO'>('BASIC');
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'strategies'));
    const unsub = onSnapshot(q, (snapshot) => {
      const strats: Strategy[] = [];
      snapshot.forEach((doc) => {
        strats.push({ id: doc.id, ...doc.data() } as Strategy);
      });
      setStrategies(strats);
    });
    return () => unsub();
  }, []);

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !txHash) return;
    
    setSubmitStatus('VERIFYING_ON_CHAIN');
    
    try {
      const response = await fetch('/api/verify-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          userId: profile.uid,
          planRequested: upgradePlan
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSubmitStatus('VERIFIED_AND_UPGRADED');
        setTxHash('');
      } else {
        setSubmitStatus('ERROR: ' + (data.error || 'INVALID_TRANSACTION'));
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      setSubmitStatus('ERROR_SUBMITTING');
    }
  };

  const isUnlocked = useCallback((stratId: string, stratTier: string) => {
    if (profile?.role === 'admin') return true;
    if (profile?.unlockedStrats.includes(stratId)) return true;
    if (profile?.plan === 'PRO') return true;
    if (profile?.plan === 'BASIC' && stratTier === 'STARTER') return true;
    return false;
  }, [profile]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-terminal-green-dim)] p-4 flex justify-between items-center bg-[var(--color-terminal-bg)] z-10">
        <div className="flex items-center gap-3">
          <Terminal className="text-[var(--color-terminal-green)]" />
          <h1 className="text-xl font-bold tracking-widest glitch-effect" data-text="MONACO_V7">MONACO_V7</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Activity size={16} className="animate-pulse" />
            <span>SYS_ONLINE</span>
          </div>
          <div className="flex items-center gap-2 border border-[var(--color-terminal-green-dim)] px-3 py-1">
            <Cpu size={16} />
            <span>PLAN: {profile?.plan}</span>
          </div>
          <button onClick={logout} className="hover:text-white transition-colors flex items-center gap-2">
            <LogOut size={16} />
            <span>DISCONNECT</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[var(--color-terminal-green-dim)] p-4 flex flex-col gap-4 bg-[var(--color-terminal-bg)] z-10">
          <div className="text-xs text-[var(--color-terminal-green-dim)] mb-4">
            &gt; SELECT_MODULE
          </div>
          <button 
            onClick={() => setActiveTab('CHART')}
            className={`text-left px-4 py-2 border ${activeTab === 'CHART' ? 'border-[var(--color-terminal-green)] bg-[var(--color-terminal-green-glow)]' : 'border-transparent hover:border-[var(--color-terminal-green-dim)]'}`}
          >
            [01] TERMINAL
          </button>
          <button 
            onClick={() => setActiveTab('STRATEGIES')}
            className={`text-left px-4 py-2 border ${activeTab === 'STRATEGIES' ? 'border-[var(--color-terminal-green)] bg-[var(--color-terminal-green-glow)]' : 'border-transparent hover:border-[var(--color-terminal-green-dim)]'}`}
          >
            [02] STRATEGIES
          </button>
          <button 
            onClick={() => setActiveTab('UPGRADE')}
            className={`text-left px-4 py-2 border ${activeTab === 'UPGRADE' ? 'border-[var(--color-terminal-green)] bg-[var(--color-terminal-green-glow)]' : 'border-transparent hover:border-[var(--color-terminal-green-dim)]'}`}
          >
            [03] UPGRADE_NODE
          </button>
          
          {profile?.role === 'admin' && (
            <div className="mt-auto pt-4 border-t border-[var(--color-terminal-green-dim)]">
              <div className="text-xs text-red-500 mb-2 flex items-center gap-2">
                <ShieldAlert size={14} /> ADMIN_ACCESS
              </div>
              <button 
                onClick={() => setActiveTab('ADMIN')}
                className={`w-full text-left px-4 py-2 border ${activeTab === 'ADMIN' ? 'border-red-500 bg-red-900/20 text-red-500' : 'border-red-900 text-red-500 hover:bg-red-900/20'}`}
              >
                SYS_OVERRIDE
              </button>
            </div>
          )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 relative bg-[var(--color-terminal-bg)]">
          <div className="scanline"></div>
          
          {activeTab === 'CHART' && (
            <div className="h-full w-full p-1">
              <TradingViewWidget />
            </div>
          )}

          {activeTab === 'STRATEGIES' && (
            <div className="p-8 h-full overflow-y-auto z-10 relative">
              <h2 className="text-2xl mb-6 border-b border-[var(--color-terminal-green-dim)] pb-2">&gt; DECRYPTED_STRATEGIES</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map(strat => {
                  const unlocked = isUnlocked(strat.id, strat.tier);
                  return (
                    <div key={strat.id} className={`border p-4 flex flex-col ${unlocked ? 'border-[var(--color-terminal-green)]' : 'border-[var(--color-terminal-gray)] opacity-70'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold">{strat.name}</h3>
                        {unlocked ? <Unlock size={18} /> : <Lock size={18} className="text-[var(--color-terminal-gray)]" />}
                      </div>
                      <div className="text-xs mb-2 text-[var(--color-terminal-green-dim)]">TIER: {strat.tier}</div>
                      <p className="text-sm flex-1 mb-4">{strat.description}</p>
                      
                      {unlocked ? (
                        <button className="mt-auto bg-[var(--color-terminal-green-glow)] border border-[var(--color-terminal-green)] py-2 text-sm hover:bg-[var(--color-terminal-green)] hover:text-black transition-colors">
                          EXECUTE_PROTOCOL
                        </button>
                      ) : (
                        <button disabled className="mt-auto border border-[var(--color-terminal-gray)] text-[var(--color-terminal-gray)] py-2 text-sm cursor-not-allowed">
                          ACCESS_DENIED
                        </button>
                      )}
                    </div>
                  );
                })}
                {strategies.length === 0 && (
                  <div className="col-span-full text-center text-[var(--color-terminal-green-dim)] py-10">
                    NO_STRATEGIES_FOUND_IN_DATABASE
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'UPGRADE' && (
            <div className="p-8 h-full overflow-y-auto z-10 relative flex justify-center items-center">
              <div className="max-w-md w-full border border-[var(--color-terminal-green)] p-6 bg-black/50 backdrop-blur-sm">
                <h2 className="text-xl mb-6 flex items-center gap-2">
                  <ShieldAlert /> ELEVATE_PRIVILEGES
                </h2>
                
                <div className="mb-6 text-sm text-[var(--color-terminal-green-dim)]">
                  <p className="mb-2">&gt; CURRENT_PLAN: {profile?.plan}</p>
                  <p>&gt; TO UPGRADE, SEND SOL TO THE PROTOCOL ADDRESS AND SUBMIT THE TX_HASH FOR VERIFICATION.</p>
                </div>

                <form onSubmit={handleUpgradeSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs mb-1">TARGET_TIER</label>
                    <select 
                      value={upgradePlan} 
                      onChange={(e) => setUpgradePlan(e.target.value as 'BASIC' | 'PRO')}
                      className="w-full bg-transparent border border-[var(--color-terminal-green-dim)] p-2 text-[var(--color-terminal-green)] outline-none focus:border-[var(--color-terminal-green)]"
                    >
                      <option value="BASIC" className="bg-black">BASIC (3 STRATS)</option>
                      <option value="PRO" className="bg-black">PRO (UNLIMITED)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs mb-1">TX_HASH (SOLANA)</label>
                    <input 
                      type="text" 
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="Enter transaction signature..."
                      className="w-full bg-transparent border border-[var(--color-terminal-green-dim)] p-2 text-[var(--color-terminal-green)] outline-none focus:border-[var(--color-terminal-green)] placeholder:text-[var(--color-terminal-gray)]"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="mt-4 border border-[var(--color-terminal-green)] py-3 hover:bg-[var(--color-terminal-green)] hover:text-black transition-colors font-bold"
                  >
                    SUBMIT_FOR_VERIFICATION
                  </button>

                  {submitStatus === 'VERIFYING_ON_CHAIN' && (
                    <div className="mt-4 text-sm flex items-center gap-2 text-yellow-500">
                      <Activity size={16} className="animate-pulse" /> VERIFYING_ON_CHAIN...
                    </div>
                  )}
                  {submitStatus === 'VERIFIED_AND_UPGRADED' && (
                    <div className="mt-4 text-sm flex items-center gap-2 text-[var(--color-terminal-green)]">
                      <CheckCircle size={16} /> VERIFICATION_SUCCESSFUL. PLAN_UPGRADED.
                    </div>
                  )}
                  {submitStatus?.startsWith('ERROR') && (
                    <div className="mt-4 text-sm flex items-center gap-2 text-red-500">
                      <ShieldAlert size={16} /> {submitStatus}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
          {activeTab === 'ADMIN' && profile?.role === 'admin' && (
            <div className="p-8 h-full overflow-y-auto z-10 relative">
              <h2 className="text-2xl mb-6 border-b border-red-900 pb-2 text-red-500 flex items-center gap-2">
                <ShieldAlert /> SYS_OVERRIDE_PANEL
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-red-900 p-6 bg-red-900/10">
                  <h3 className="text-lg font-bold text-red-500 mb-4">DATABASE_OPERATIONS</h3>
                  <p className="text-sm text-[var(--color-terminal-gray)] mb-4">
                    &gt; SEED_INITIAL_STRATEGIES_INTO_FIRESTORE
                  </p>
                  <button 
                    onClick={handleSeedStrategies}
                    className="border border-red-500 text-red-500 py-2 px-4 hover:bg-red-500 hover:text-black transition-colors"
                  >
                    EXECUTE_SEED
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
