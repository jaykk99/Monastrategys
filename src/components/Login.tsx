import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase';
import { Terminal, ShieldAlert } from 'lucide-react';

const Login = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "AUTHENTICATION_FAILED");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-terminal-bg)] relative overflow-hidden">
      <div className="scanline"></div>
      
      <div className="border border-[var(--color-terminal-green)] p-8 max-w-md w-full bg-black/80 backdrop-blur-sm z-10 relative">
        <div className="flex flex-col items-center mb-8">
          <Terminal size={48} className="text-[var(--color-terminal-green)] mb-4" />
          <h1 className="text-3xl font-bold tracking-widest glitch-effect" data-text="MONACO_V7">MONACO_V7</h1>
          <div className="text-xs text-[var(--color-terminal-green-dim)] mt-2">SECURE_TRADING_TERMINAL</div>
        </div>

        <div className="mb-8 text-sm border-l-2 border-[var(--color-terminal-green-dim)] pl-4 py-2">
          <p className="mb-1">&gt; INITIALIZING_CONNECTION...</p>
          <p className="mb-1">&gt; AWAITING_AUTHORIZATION...</p>
          <p className="animate-pulse">&gt; PLEASE_AUTHENTICATE_TO_CONTINUE</p>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-red-900 bg-red-900/20 text-red-500 text-sm flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <span>ERR: {error}</span>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full border border-[var(--color-terminal-green)] py-3 hover:bg-[var(--color-terminal-green)] hover:text-black transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'AUTHENTICATING...' : 'INITIATE_OAUTH_HANDSHAKE'}
        </button>
      </div>
    </div>
  );
};

export default Login;
