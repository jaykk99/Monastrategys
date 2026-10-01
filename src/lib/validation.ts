// Input validation. Every message here is shown in the UI.

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): ValidationResult {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: 'Email is required.' };
  if (clean.length > 254) return { ok: false, error: 'Email is too long.' };
  if (!EMAIL_RE.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { ok: false, error: 'Password is required.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  if (password.length > 128) return { ok: false, error: 'Password is too long.' };
  return { ok: true };
}

export function validateStrategy(input: {
  title: string;
  description: string;
  content: string;
  timeframes: string[];
}): ValidationResult {
  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: 'Title must be at least 3 characters.' };
  if (title.length > 120) return { ok: false, error: 'Title must be under 120 characters.' };
  if (input.description.trim().length > 500)
    return { ok: false, error: 'Description must be under 500 characters.' };
  if (input.timeframes.length === 0) return { ok: false, error: 'Select at least one timeframe.' };
  if (input.content.trim().length < 20)
    return { ok: false, error: 'Strategy code must be at least 20 characters.' };
  if (input.content.length > 200000)
    return { ok: false, error: 'Strategy code is too large (max ~200KB).' };
  return { ok: true };
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function validateSolanaAddress(address: string): ValidationResult {
  const clean = address.trim();
  if (!clean) return { ok: false, error: 'Wallet address is required.' };
  if (clean.length < 32 || clean.length > 44 || !BASE58_RE.test(clean))
    return { ok: false, error: 'That does not look like a Solana address.' };
  return { ok: true };
}

export function validateSymbol(symbol: string): ValidationResult {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Enter a symbol.' };
  if (!/^[A-Z0-9:.\-/]{1,24}$/.test(clean))
    return { ok: false, error: 'Symbol contains invalid characters.' };
  return { ok: true };
}
