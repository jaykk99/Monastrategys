import { useState } from 'react';
import { PLANS, SOL_RECIPIENT, type PlanDef, type UserProfile } from '../lib/types';
import { validateSolanaAddress } from '../lib/validation';
import { useToast } from './Toast';

export type PaymentStatus = 'IDLE' | 'SUBMITTING' | 'SUBMITTED';

interface Props {
  profile: UserProfile | null;
  demoMode: boolean;
  selectedPlan: PlanDef | null;
  paymentStatus: PaymentStatus;
  walletAddress: string;
  manualAddress: string;
  showProModal: boolean;
  onRequireAuth: () => void;
  onSelectPlan: (plan: PlanDef) => void;
  onCancelPlan: () => void;
  onManualAddressChange: (v: string) => void;
  onPay: () => void;
  onVerify: () => void;
  onDemoSetPlan: (plan: PlanDef) => void;
  onDismissProModal: () => void;
}

function solAmountFor(price: string): string {
  return (parseFloat(price) / 150).toFixed(4);
}

export function PlansView(props: Props) {
  const { profile, demoMode, selectedPlan, paymentStatus } = props;
  const { notify } = useToast();
  const [showAbout, setShowAbout] = useState(false);
  const [addrError, setAddrError] = useState('');

  const currentPlan = profile?.plan ?? 'STARTER';

  const choosePlan = (plan: PlanDef) => {
    if (!props.profile) return props.onRequireAuth();
    if (demoMode) return props.onDemoSetPlan(plan);
    props.onSelectPlan(plan);
  };

  const onManualChange = (v: string) => {
    props.onManualAddressChange(v);
    if (v.trim()) {
      const r = validateSolanaAddress(v);
      setAddrError(r.ok ? '' : r.error!);
    } else {
      setAddrError('');
    }
  };

  return (
    <div className="absolute inset-0 bg-black p-6 md:p-10 flex flex-col items-center z-20 overflow-y-auto">
      <div className="max-w-4xl w-full pb-20">
        {demoMode && (
          <div className="mb-6 border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4 text-center">
            <div className="text-yellow-400 text-xs font-bold tracking-widest mb-1">DEMO MODE</div>
            <p className="text-zinc-400 text-xs normal-case tracking-normal">
              No Firebase backend configured. Plans and strategies are stored locally in this browser only.
            </p>
          </div>
        )}

        {!showAbout ? (
          <>
            <div className="text-center mb-10 border-b border-white/10 pb-8">
              <h2 className="text-3xl font-bold tracking-tight text-white mb-4">Subscription Plans</h2>
              {currentPlan === 'PRO' && profile && (
                <div className="bg-terminal-green/10 border border-terminal-green/20 rounded-lg p-4 mb-6 inline-block">
                  <div className="text-terminal-green font-bold text-sm">PRO STATUS ACTIVE</div>
                  <div className="text-zinc-500 text-[10px] mt-1 normal-case tracking-normal">
                    Full access to all strategies and automated trading.
                  </div>
                </div>
              )}
              {!profile && (
                <div className="flex items-center justify-center gap-4 text-sm">
                  <button onClick={props.onRequireAuth} className="text-zinc-400 hover:text-white transition-colors underline underline-offset-4">
                    Sign In
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button onClick={props.onRequireAuth} className="text-zinc-400 hover:text-white transition-colors underline underline-offset-4">
                    Register
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => {
                const isCurrent = currentPlan === plan.name.toUpperCase();
                return (
                  <div
                    key={plan.name}
                    className={`bg-zinc-950 border ${isCurrent ? 'border-terminal-green/60' : 'border-white/10'} p-8 rounded-xl flex flex-col relative hover:border-white/25 transition-all`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terminal-green text-black text-[10px] px-3 py-1 rounded-full font-bold tracking-widest">
                        CURRENT PLAN
                      </div>
                    )}
                    <div className="text-xl text-white font-bold mb-2">{plan.name}</div>
                    <div className="text-2xl font-light mb-6 text-white">
                      ${plan.price}
                      <span className="text-sm text-zinc-500">/mo</span>
                    </div>
                    <ul className="text-sm text-zinc-400 space-y-3 mb-10 flex-1 normal-case tracking-normal">
                      {plan.desc.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-terminal-green shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => choosePlan(plan)}
                      disabled={isCurrent}
                      className={`mt-auto py-3 rounded-md text-sm font-bold tracking-widest transition-all ${
                        isCurrent ? 'bg-zinc-900 text-zinc-600' : 'bg-white text-black hover:bg-zinc-200'
                      }`}
                    >
                      {isCurrent ? 'SELECTED' : plan.price === '0' ? 'SELECT' : 'BUY NOW'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setShowAbout(true)}
                className="text-zinc-500 hover:text-white text-sm font-medium transition-all flex items-center gap-2 border-b border-zinc-800 pb-1"
              >
                About the platform
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {selectedPlan && !demoMode && (
              <div className="bg-zinc-950 border border-white/10 p-6 md:p-8 rounded-xl mt-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-white">
                    {selectedPlan.price === '0' ? 'Switch to ' : 'Upgrade to '}{selectedPlan.name}
                  </h3>
                  <button onClick={props.onCancelPlan} className="text-zinc-500 hover:text-white text-sm transition-colors">
                    Cancel
                  </button>
                </div>

                {selectedPlan.price !== '0' && !selectedPlan.isTrial && (
                  <div className="bg-zinc-900 border border-white/5 p-6 rounded-lg mb-8">
                    <div className="text-xs text-zinc-500 tracking-widest mb-4 font-bold">PAYMENT DETAILS</div>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-zinc-400 text-xs">Recipient Address</span>
                        <span className="text-white text-[10px] font-mono bg-black px-4 py-2 rounded border border-white/5 select-all block leading-relaxed text-center w-full break-all">
                          {SOL_RECIPIENT}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-zinc-400 text-xs">Amount to Send</span>
                        <span className="text-white text-sm font-bold">{solAmountFor(selectedPlan.price)} SOL</span>
                        <span className="text-[10px] text-zinc-600">($150/SOL reference rate)</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <label className="text-[10px] text-zinc-500 font-bold mb-2 block tracking-widest">
                        VERIFY SENDER WALLET
                      </label>
                      <input
                        type="text"
                        value={props.manualAddress || props.walletAddress}
                        onChange={(e) => onManualChange(e.target.value)}
                        placeholder="Paste the wallet address you sent from..."
                        className={`w-full bg-black border ${addrError ? 'border-red-500/60' : 'border-white/10'} p-3 rounded-md text-xs text-white outline-none focus:border-terminal-green/60 transition-colors font-mono`}
                      />
                      {addrError ? (
                        <div className="mt-2 text-[10px] text-red-400 normal-case tracking-normal">{addrError}</div>
                      ) : (
                        <div className="mt-2 text-[10px] text-zinc-600 italic normal-case tracking-normal">
                          Enter the address you used to send the SOL.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedPlan.price === '0' ? (
                  <div className="text-center p-6 bg-zinc-900 rounded-lg mb-8 text-sm text-zinc-300 border border-white/5 normal-case tracking-normal">
                    Confirm switching to the Starter plan. Some features will be limited.
                  </div>
                ) : selectedPlan.isTrial ? (
                  <div className="text-center p-6 bg-zinc-900 rounded-lg mb-8 text-sm text-zinc-300 border border-white/5 normal-case tracking-normal">
                    You are eligible for a 24-hour trial of the Basic plan.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 mb-8">
                    <button
                      onClick={props.onPay}
                      disabled={paymentStatus !== 'IDLE'}
                      className="w-full bg-white text-black py-3 rounded-md font-bold text-sm tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {paymentStatus === 'SUBMITTING' ? 'PROCESSING...' : 'PAY WITH PHANTOM'}
                    </button>
                    <button
                      onClick={() => {
                        if (props.manualAddress.trim() && addrError) {
                          notify('Fix the wallet address before verifying.', 'error');
                          return;
                        }
                        props.onVerify();
                      }}
                      disabled={paymentStatus !== 'IDLE'}
                      className="w-full bg-zinc-800 text-white py-3 rounded-md font-bold text-sm tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
                    >
                      {paymentStatus === 'SUBMITTING' ? 'VERIFYING...' : 'VERIFY MANUAL PAYMENT'}
                    </button>
                  </div>
                )}

                {selectedPlan.price === '0' && (
                  <div className="flex flex-col gap-3 mb-8">
                    <button
                      onClick={props.onPay}
                      disabled={paymentStatus !== 'IDLE'}
                      className="w-full bg-white text-black py-3 rounded-md font-bold text-sm tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {paymentStatus === 'SUBMITTING' ? 'SWITCHING...' : 'CONFIRM SWITCH'}
                    </button>
                  </div>
                )}

                {paymentStatus === 'SUBMITTED' && (
                  <div className="mt-4 text-sm text-terminal-green text-center font-medium">
                    Plan updated successfully!
                  </div>
                )}

                {selectedPlan.price !== '0' && !selectedPlan.isTrial && (
                  <div className="mt-6 text-[10px] text-zinc-600 text-center leading-relaxed max-w-xs mx-auto normal-case tracking-normal">
                    Verification requires an exact match of the subscription amount and a valid sender
                    wallet address. Incorrect payments or missing wallet information will fail verification.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-bold text-white">About Monastrategys</h2>
              <button
                onClick={() => setShowAbout(false)}
                className="text-zinc-500 hover:text-white text-sm transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Back to Plans
              </button>
            </div>
            <p className="text-zinc-500 text-sm max-w-xl mx-auto text-center mb-12 normal-case tracking-normal">
              The hub for professional PineScript strategies, automated trading, and backtesting.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-zinc-400 leading-relaxed">
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-bold text-base mb-2">PineScript, ready to paste</h3>
                  <p className="text-sm normal-case tracking-normal">
                    Copy any strategy into TradingView's Pine Editor: open a chart, go to Pine Editor,
                    New Strategy, replace the boilerplate, paste, Save, Add to Chart.
                  </p>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base mb-2">Backtesting</h3>
                  <p className="text-sm normal-case tracking-normal">
                    The built-in backtest tab runs a deterministic simulated engine over each strategy
                    and shows equity curve, win rate, profit factor and drawdown. Illustrative only —
                    not trading advice.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-bold text-base mb-2">Pro auto-trading</h3>
                  <p className="text-sm normal-case tracking-normal">
                    Pro strategies include webhook-ready alerts: create one TradingView alert on the
                    strategy, enable the webhook URL, paste your bot endpoint (3Commas, etc.) — the
                    strategy fires, the bot executes.
                  </p>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base mb-2">Coverage</h3>
                  <p className="text-sm normal-case tracking-normal">
                    Crypto, stocks, forex, funds, commodities and indices — from 1-minute scalps to
                    weekly swing systems.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {props.showProModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="max-w-md w-full bg-zinc-950 border border-terminal-green/30 rounded-2xl p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-terminal-green to-terminal-green-dim rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
              <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Welcome to Pro</h3>
            <p className="text-zinc-400 text-sm mb-10 leading-relaxed normal-case tracking-normal">
              Your account has been upgraded to <span className="text-white font-bold">PRO</span>. Full
              access to every strategy and the automated trading infrastructure.
            </p>
            <button
              onClick={props.onDismissProModal}
              className="w-full bg-zinc-900 text-zinc-300 py-4 rounded-xl font-medium text-sm hover:bg-zinc-800 transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
