import { useState, type FormEvent } from 'react';
import { validateEmail, validatePassword } from '../lib/validation';

interface Props {
  allowClose: boolean;
  googleEnabled: boolean;
  onClose: () => void;
  onEmailAuth: (email: string, password: string, isSignUp: boolean) => Promise<string | void>;
  onGoogleSignIn: () => Promise<string | void>;
}

export function AuthModal({ allowClose, googleEnabled, onClose, onEmailAuth, onGoogleSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const em = validateEmail(email);
    if (!em.ok) return setError(em.error!);
    const pw = validatePassword(password);
    if (!pw.ok) return setError(pw.error!);
    setProcessing(true);
    try {
      const errMsg = await onEmailAuth(email.trim().toLowerCase(), password, isSignUp);
      if (errMsg) setError(errMsg);
    } finally {
      setProcessing(false);
    }
  };

  const google = async () => {
    setError('');
    setProcessing(true);
    try {
      const errMsg = await onGoogleSignIn();
      if (errMsg) setError(errMsg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 z-[100] backdrop-blur-sm">
      <div className="max-w-sm w-full border border-white/10 bg-zinc-950 p-8 rounded-xl shadow-2xl relative">
        {allowClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
          <div className="text-sm text-zinc-500 normal-case tracking-normal">
            {isSignUp ? 'Join Monastrategys today' : 'Access your strategies and plans'}
          </div>
        </div>

        {googleEnabled && (
          <>
            <button
              onClick={google}
              disabled={processing}
              className="w-full bg-white text-black py-3 rounded-md font-medium text-sm hover:bg-zinc-200 transition-all mb-6 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-black rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>
            <div className="relative flex items-center py-2 mb-4">
              <div className="flex-grow border-t border-white/10" />
              <span className="flex-shrink mx-4 text-zinc-500 text-xs">or</span>
              <div className="flex-grow border-t border-white/10" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm outline-none focus:border-terminal-green/60 text-white placeholder:text-zinc-500 transition-colors normal-case"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm outline-none focus:border-terminal-green/60 text-white placeholder:text-zinc-500 transition-colors"
          />
          <button
            disabled={processing}
            type="submit"
            className="w-full bg-zinc-800 text-white py-3 rounded-md font-medium text-sm hover:bg-zinc-700 transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
            {processing ? (isSignUp ? 'Creating...' : 'Signing in...') : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          {error && (
            <div className="text-xs text-red-400 text-center mt-2 border border-red-500/30 bg-red-500/5 rounded-md p-3 normal-case tracking-normal">
              {error}
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-xs text-zinc-500 hover:text-white transition-colors">
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
