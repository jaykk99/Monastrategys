// Validation tests. Run with: npx tsx tests/run.ts
import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePassword,
  validateStrategy,
  validateSolanaAddress,
  validateSymbol,
} from '../src/lib/validation';

export function run() {
  assert.deepEqual(validateEmail('User@Example.com'), { ok: true }, 'valid email passes (normalized)');
  assert.equal(validateEmail('').ok, false, 'empty email fails');
  assert.equal(validateEmail('not-an-email').ok, false, 'bad email fails');
  assert.equal(validateEmail('a@b.c').ok, false, 'short TLD fails');
  assert.equal(validateEmail('x'.repeat(250) + '@e.com').ok, false, 'overlong email fails');

  assert.deepEqual(validatePassword('secret1'), { ok: true }, 'valid password passes');
  assert.equal(validatePassword('').ok, false, 'empty password fails');
  assert.equal(validatePassword('12345').ok, false, 'short password fails');

  assert.deepEqual(
    validateStrategy({
      title: 'Momentum Breakout',
      description: 'Simple momentum strategy',
      content: 'study("x"); // at least 20 chars long',
      timeframes: ['1H'],
    }),
    { ok: true },
    'valid strategy passes',
  );
  assert.equal(
    validateStrategy({ title: 'ab', description: '', content: 'x'.repeat(30), timeframes: ['1H'] }).ok,
    false,
    'short title fails',
  );
  assert.equal(
    validateStrategy({ title: 'Good title', description: '', content: 'x'.repeat(30), timeframes: [] }).ok,
    false,
    'no timeframes fails',
  );
  assert.equal(
    validateStrategy({ title: 'Good title', description: '', content: 'short', timeframes: ['1H'] }).ok,
    false,
    'short content fails',
  );

  assert.deepEqual(validateSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), { ok: true }, 'valid base58 address passes');
  assert.equal(validateSolanaAddress('').ok, false, 'empty address fails');
  assert.equal(validateSolanaAddress('too-short').ok, false, 'short address fails');
  assert.equal(validateSolanaAddress('0OIl-not-base58-xxxxxxxxxxxxxxxxxxxx').ok, false, 'non-base58 fails');

  assert.deepEqual(validateSymbol('btcusdt'), { ok: true }, 'valid symbol passes');
  assert.equal(validateSymbol('').ok, false, 'empty symbol fails');
  assert.equal(validateSymbol('btc usdt!').ok, false, 'symbol with spaces/punct fails');
  assert.equal(validateSymbol('a'.repeat(25)).ok, false, 'overlong symbol fails');
}
