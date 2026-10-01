import { useCallback, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as web3 from '@solana/web3.js';

import { ADMIN_EMAIL, ADMIN_LOGIN_CONFIGURED, ADMIN_PASS } from './lib/config';
import { paths, services } from './lib/firebase';
import { runBacktestEngine } from './lib/backtest';
import {
  clearDemoProfile,
  createDemoProfile,
  getDemoStrategies,
  loadDemoProfile,
  saveDemoProfile,
} from './lib/demo';
import {
  SOL_RECIPIENT,
  type BacktestRun,
  type PlanDef,
  type PlanName,
  type Strategy,
  type UserProfile,
} from './lib/types';
import { validateSolanaAddress, validateSymbol } from './lib/validation';

import { ErrorBoundary } from './components/ErrorBoundary';
import { TradingViewWidget } from './components/TradingViewWidget';
import { ToastProvider, useToast } from './components/Toast';
import { AuthModal } from './components/AuthModal';
import { PlansView, type PaymentStatus } from './components/PlansView';
import { StrategiesView } from './components/StrategiesView';
import { StrategyModal } from './components/StrategyModal';
import { BacktestView } from './components/BacktestView';
import { AdminView, StrategyForm, type StrategyFormData } from './components/AdminView';

declare global {
  interface Window {
    solana?: any;
  }
}

const DEMO_STRATS_KEY = 'monastrategys_demo_strategies_v1';
const DEMO_SESSION_KEY = 'monastrategys_demo_session_v1';

const googleProvider = services ? new GoogleAuthProvider() : null;
if (googleProvider) googleProvider.setCustomParameters({ prompt: 'select_account' });

type TabId = 'plan' | 'chart' | 'strategies' | 'backtest' | 'upload';

function loadDemoSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function formatAuthError(err: any): string {
  if (err?.code === 'auth/popup-blocked') return 'Popup blocked by browser. Please enable popups.';
  if (err?.code === 'auth/popup-closed-by-user') return 'Sign-in popup closed before finishing.';
  if (err?.code === 'auth/network-request-failed') return 'Network error. Check your connection.';
  if (err?.code === 'auth/unauthorized-domain')
    return 'This domain is not authorized in the Firebase console.';
  if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential')
    return 'Invalid email or password.';
  if (err?.code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (err?.code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  const msg = String(err?.message ?? err ?? 'Unknown error').replace('Firebase: ', '');
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

function isExpired(expiresAt: unknown): boolean {
  if (!expiresAt) return false;
  try {
    if (expiresAt instanceof Timestamp) return expiresAt.toDate() < new Date();
    const d = new Date(expiresAt as string);
    return !isNaN(d.getTime()) && d < new Date();
  } catch {
    return false;
  }
}

function InnerApp() {
  const { notify } = useToast();
  const demoMode = !services;

  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('plan');
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [searchQuery, setSearchQuery] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);

  // Payment state
  const [selectedPlan, setSelectedPlan] = useState<PlanDef | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('IDLE');
  const [manualAddress, setManualAddress] = useState('');
  const [showProModal, setShowProModal] = useState(false);

  // Strategy view state
  const [viewingStrat, setViewingStrat] = useState<Strategy | null>(null);
  const [editingStrat, setEditingStrat] = useState<Strategy | null>(null);
  const [stratToDelete, setStratToDelete] = useState<Strategy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Backtest state
  const [selectedStratId, setSelectedStratId] = useState('');
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Admin state
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUserStatus, setAdminUserStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS'>('IDLE');

  const plan: PlanName = profile?.plan ?? 'STARTER';
  const isAdmin = !!profile && profile.role === 'admin';

  // ---------- profile persistence (firebase or demo) ----------
  const persistProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!profile) return;
      const next = { ...profile, ...patch };
      if (services && fbUser) {
        try {
          await updateDoc(doc(services.db, ...paths.users, fbUser.uid), patch as any);
        } catch (err) {
          console.error('Profile update failed:', err);
          notify('Could not save your profile. Check your connection.', 'error');
          return;
        }
      } else {
        saveDemoProfile(next);
        try {
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
      }
      setProfile(next);
    },
    [profile, fbUser, notify],
  );

  // ---------- auth bootstrap ----------
  useEffect(() => {
    if (demoMode) {
      setProfile(loadDemoSession());
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(services!.auth, (u) => {
      setFbUser(u);
      if (u) setShowAuthOverlay(false);
      else {
        setProfile(null);
        setActiveTab('plan');
      }
      setLoading(false);
    });
    return unsub;
  }, [demoMode]);

  // ---------- strategies subscription ----------
  useEffect(() => {
    if (demoMode) {
      try {
        const raw = localStorage.getItem(DEMO_STRATS_KEY);
        setStrategies(raw ? (JSON.parse(raw) as Strategy[]) : getDemoStrategies());
      } catch {
        setStrategies(getDemoStrategies());
      }
      return;
    }
    if (!fbUser) {
      setStrategies([]);
      return;
    }
    const colRef = collection(services!.db, ...paths.strategies);
    return onSnapshot(
      colRef,
      (snap) => {
        setStrategies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Strategy));
        setDataError(null);
      },
      (err) => {
        console.error('Strategies listener error:', err);
        setDataError('Could not load strategies from the backend. Check your connection and Firestore rules.');
      },
    );
  }, [demoMode, fbUser]);

  // ---------- profile subscription (firebase mode) ----------
  useEffect(() => {
    if (demoMode || !fbUser) return;
    const ref = doc(services!.db, ...paths.users, fbUser.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const prof: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email,
            role: data.role === 'admin' ? 'admin' : 'user',
            plan: (['STARTER', 'BASIC', 'PRO'] as PlanName[]).includes(data.plan) ? data.plan : 'STARTER',
            unlockedStrats: Array.isArray(data.unlockedStrats) ? data.unlockedStrats : [],
            backtestCount: typeof data.backtestCount === 'number' ? data.backtestCount : 0,
            expiresAt: data.expiresAt ?? null,
            createdAt: data.createdAt ?? null,
          };
          if (isExpired(prof.expiresAt) && prof.plan !== 'STARTER') {
            updateDoc(ref, { plan: 'STARTER', expiresAt: null }).catch(() => undefined);
            prof.plan = 'STARTER';
            prof.expiresAt = null;
          }
          setProfile(prof);
        } else {
          const isAdminEmail = ADMIN_LOGIN_CONFIGURED && (fbUser.email ?? '').toLowerCase() === ADMIN_EMAIL;
          const fresh: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email,
            role: isAdminEmail ? 'admin' : 'user',
            plan: 'STARTER',
            unlockedStrats: [],
            backtestCount: 0,
          };
          setDoc(ref, { ...fresh, createdAt: serverTimestamp() }).catch((err) => {
            console.error('User doc creation failed:', err);
            setDataError('Signed in, but could not create your profile document.');
          });
          setProfile(fresh);
        }
      },
      (err) => {
        console.error('Profile listener error:', err);
        setDataError('Could not load your profile from the backend.');
      },
    );
  }, [demoMode, fbUser]);

  // ---------- demo session expiry check ----------
  useEffect(() => {
    if (!demoMode || !profile) return;
    if (isExpired((profile as any).expiresAt) && profile.plan !== 'STARTER') {
      persistProfile({ plan: 'STARTER', expiresAt: null } as Partial<UserProfile>);
      notify('Your plan trial expired — back to Starter.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, profile?.uid]);

  // ---------- auth actions ----------
  const handleEmailAuth = useCallback(
    async (email: string, password: string, isSignUp: boolean): Promise<string | void> => {
      const cleanEmail = email.trim().toLowerCase();
      if (ADMIN_LOGIN_CONFIGURED && cleanEmail === ADMIN_EMAIL) {
        if (password !== ADMIN_PASS) return 'Admin password is incorrect.';
      }

      if (demoMode) {
        const existing = loadDemoProfile(cleanEmail);
        if (isSignUp && existing) return 'An account with this email already exists. Sign in instead.';
        const prof = existing ?? createDemoProfile(
          cleanEmail,
          ADMIN_LOGIN_CONFIGURED && cleanEmail === ADMIN_EMAIL ? 'admin' : 'user',
        );
        saveDemoProfile(prof);
        try {
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(prof));
        } catch { /* ignore */ }
        setProfile(prof);
        setShowAuthOverlay(false);
        notify(`Signed in as ${cleanEmail} (demo mode).`, 'success');
        return;
      }

      try {
        if (isSignUp) {
          await createUserWithEmailAndPassword(services!.auth, cleanEmail, password);
        } else {
          try {
            await signInWithEmailAndPassword(services!.auth, cleanEmail, password);
          } catch (loginErr: any) {
            if (
              (loginErr?.code === 'auth/user-not-found' || loginErr?.code === 'auth/invalid-credential') &&
              cleanEmail !== ADMIN_EMAIL
            ) {
              await createUserWithEmailAndPassword(services!.auth, cleanEmail, password);
            } else {
              throw loginErr;
            }
          }
        }
        setShowAuthOverlay(false);
      } catch (err) {
        console.error('Email auth error:', err);
        return formatAuthError(err);
      }
    },
    [demoMode, notify],
  );

  const handleGoogleSignIn = useCallback(async (): Promise<string | void> => {
    if (!services || !googleProvider) return 'Google sign-in needs a Firebase backend.';
    try {
      await signInWithPopup(services.auth, googleProvider);
      setShowAuthOverlay(false);
    } catch (err) {
      console.error('Google auth error:', err);
      return formatAuthError(err);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (services) {
      await signOut(services.auth).catch((err) => {
        console.error('Sign out failed:', err);
        notify('Sign out failed.', 'error');
      });
    } else {
      clearDemoProfile();
      try {
        localStorage.removeItem(DEMO_SESSION_KEY);
      } catch { /* ignore */ }
      setProfile(null);
    }
    setActiveTab('plan');
    setRuns([]);
  }, [notify]);

  // ---------- strategy access ----------
  const unlockStrategy = useCallback(
    async (strat: Strategy) => {
      if (!profile) {
        setShowAuthOverlay(true);
        return;
      }
      if (strat.isAutoTrade && plan !== 'PRO' && !isAdmin) {
        notify('Auto-trade strategies are exclusive to Pro users.', 'error');
        return;
      }
      if (plan === 'PRO' || isAdmin || profile.unlockedStrats.includes(strat.id)) {
        setViewingStrat(strat);
        return;
      }
      if (plan === 'BASIC') {
        if (profile.unlockedStrats.length >= 3) {
          notify('Basic plan limit: 3 strategies reached.', 'error');
          return;
        }
        await persistProfile({ unlockedStrats: [...profile.unlockedStrats, strat.id] });
        setViewingStrat(strat);
        notify(`Unlocked: ${strat.title}`, 'success');
        return;
      }
      notify("Starter plan: use 'Unlock Random' to gain access.", 'info');
    },
    [profile, plan, isAdmin, persistProfile, notify],
  );

  const unlockRandomStrategy = useCallback(async () => {
    if (!profile || plan !== 'STARTER') return;
    if (profile.unlockedStrats.length >= 1) {
      notify('Starter limit: 1 random strategy reached.', 'error');
      return;
    }
    const available = strategies.filter((s) => !profile.unlockedStrats.includes(s.id));
    if (available.length === 0) {
      notify('No more strategies to unlock.', 'info');
      return;
    }
    const random = available[Math.floor(Math.random() * available.length)];
    await persistProfile({ unlockedStrats: [...profile.unlockedStrats, random.id] });
    setViewingStrat(random);
    notify(`Unlocked: ${random.title}`, 'success');
  }, [profile, plan, strategies, persistProfile, notify]);

  // ---------- wallet / payments ----------
  const connectWallet = useCallback(async (): Promise<boolean> => {
    if (window.solana?.isPhantom) {
      try {
        const resp = await window.solana.connect();
        setWalletAddress(resp.publicKey.toString());
        return true;
      } catch (err) {
        console.error('Wallet connect failed:', err);
        notify('Wallet connection was rejected.', 'error');
        return false;
      }
    }
    notify('Please install the Phantom wallet extension first.', 'error');
    return false;
  }, [notify]);

  const setPlanAfterPayment = useCallback(
    async (planDef: PlanDef, extra?: Record<string, unknown>) => {
      const name = planDef.name.toUpperCase() as PlanName;
      const patch: Partial<UserProfile> = { plan: name };
      if (planDef.name === 'Basic' && planDef.isTrial) {
        const exp = new Date();
        exp.setHours(exp.getHours() + 24);
        (patch as any).expiresAt = services ? Timestamp.fromDate(exp) : exp.toISOString();
      } else if (planDef.name !== 'Basic' || !planDef.isTrial) {
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        (patch as any).expiresAt = services ? Timestamp.fromDate(exp) : exp.toISOString();
      }
      if (planDef.name === 'Starter') (patch as any).expiresAt = null;
      Object.assign(patch, extra);
      await persistProfile(patch);
      setPaymentStatus('SUBMITTED');
      setSelectedPlan(null);
      if (planDef.name === 'Pro') setShowProModal(true);
    },
    [persistProfile],
  );

  const submitPayment = useCallback(async () => {
    if (!profile) {
      setShowAuthOverlay(true);
      return;
    }
    const planDef = selectedPlan;
    if (!planDef) return;
    setPaymentStatus('SUBMITTING');
    try {
      if (planDef.price === '0' || planDef.isTrial) {
        await new Promise((r) => setTimeout(r, 800));
        await setPlanAfterPayment(planDef);
        return;
      }
      if (demoMode) {
        await setPlanAfterPayment(planDef);
        notify('Demo mode: plan activated locally, no payment taken.', 'success');
        return;
      }
      if (!walletAddress) {
        const ok = await connectWallet();
        setPaymentStatus('IDLE');
        if (!ok) notify('Connect a wallet to pay.', 'error');
        return;
      }
      const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');
      const fromPubkey = new web3.PublicKey(walletAddress);
      const toPubkey = new web3.PublicKey(SOL_RECIPIENT);
      const solAmount = parseFloat(planDef.price) / 150;
      const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(solAmount * web3.LAMPORTS_PER_SOL),
        }),
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      if (!window.solana) {
        notify('Solana wallet not found. Please install Phantom.', 'error');
        setPaymentStatus('IDLE');
        return;
      }
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      await connection.confirmTransaction(signature);
      await addDoc(collection(services!.db, ...paths.paymentVerifications), {
        userId: fbUser!.uid,
        email: fbUser!.email,
        plan: planDef.name,
        amount: planDef.price,
        txHash: signature,
        currency: 'SOL',
        timestamp: serverTimestamp(),
        status: 'verified',
      });
      await setPlanAfterPayment(planDef, { lastPaymentSig: signature });
    } catch (err: any) {
      console.error('Payment failed:', err);
      setPaymentStatus('IDLE');
      notify(`Payment failed: ${formatAuthError(err)}`, 'error');
    }
  }, [profile, selectedPlan, demoMode, walletAddress, connectWallet, setPlanAfterPayment, fbUser, notify]);

  const verifyManualPayment = useCallback(async () => {
    const planDef = selectedPlan;
    if (!profile || !planDef || (!walletAddress && !manualAddress.trim())) {
      notify('Connect a wallet or enter an address to verify.', 'error');
      return;
    }
    const v = validateSolanaAddress(manualAddress || walletAddress);
    if (!v.ok) {
      notify(v.error!, 'error');
      return;
    }
    setPaymentStatus('SUBMITTING');
    try {
      const addressToVerify = manualAddress.trim() || walletAddress;
      const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');
      const recipientPubkey = new web3.PublicKey(SOL_RECIPIENT);
      const signatures = await connection.getSignaturesForAddress(recipientPubkey, { limit: 30 });
      const expectedLamports = Math.floor((parseFloat(planDef.price) / 150) * web3.LAMPORTS_PER_SOL);
      let verifiedSig: string | null = null;
      for (const sigInfo of signatures) {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta || tx.meta.err) continue;
        for (const inst of tx.transaction.message.instructions as any[]) {
          if ('parsed' in inst && inst.program === 'system' && inst.parsed?.type === 'transfer') {
            const info = inst.parsed.info;
            if (
              info.destination === SOL_RECIPIENT &&
              info.source === addressToVerify &&
              Math.abs(info.lamports - expectedLamports) < 2_000_000
            ) {
              verifiedSig = sigInfo.signature;
              break;
            }
          }
        }
        if (verifiedSig) break;
      }
      if (!verifiedSig) {
        notify('No matching transaction found. Check the amount and sender address.', 'error');
        setPaymentStatus('IDLE');
        return;
      }
      await addDoc(collection(services!.db, ...paths.paymentVerifications), {
        userId: fbUser!.uid,
        email: fbUser!.email,
        plan: planDef.name,
        amount: planDef.price,
        txHash: verifiedSig,
        sender: addressToVerify,
        timestamp: serverTimestamp(),
        status: 'verified_via_scan',
      });
      await setPlanAfterPayment(planDef, { lastPaymentSig: verifiedSig });
    } catch (err: any) {
      console.error('Verification error:', err);
      setPaymentStatus('IDLE');
      notify(`Verification failed: ${formatAuthError(err)}`, 'error');
    }
  }, [profile, selectedPlan, walletAddress, manualAddress, setPlanAfterPayment, fbUser, notify]);

  const demoSetPlan = useCallback(
    async (planDef: PlanDef) => {
      setSelectedPlan(planDef);
      setPaymentStatus('SUBMITTING');
      await new Promise((r) => setTimeout(r, 600));
      await setPlanAfterPayment(planDef);
      notify(`Demo mode: ${planDef.name} plan activated locally.`, 'success');
    },
    [setPlanAfterPayment, notify],
  );

  // ---------- strategy CRUD (admin) ----------
  const persistDemoStrategies = (list: Strategy[]) => {
    setStrategies(list);
    try {
      localStorage.setItem(DEMO_STRATS_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
  };

  const handleUpload = useCallback(
    async (data: StrategyFormData): Promise<string | void> => {
      if (!isAdmin) return 'Admin access required.';
      setAdminBusy(true);
      try {
        if (services && fbUser) {
          await addDoc(collection(services.db, ...paths.strategies), {
            title: data.title.trim(),
            description: data.description.trim(),
            assetCategory: data.assetCategory,
            timeframes: data.timeframes,
            content: data.content,
            isAutoTrade: data.isAutoTrade,
            author: fbUser.uid,
            timestamp: serverTimestamp(),
          });
        } else {
          persistDemoStrategies([
            ...strategies,
            {
              id: `demo-${Date.now()}`,
              title: data.title.trim(),
              description: data.description.trim(),
              assetCategory: data.assetCategory,
              timeframes: data.timeframes,
              content: data.content,
              isAutoTrade: data.isAutoTrade,
              author: profile?.uid,
            },
          ]);
        }
        notify('Strategy published.', 'success');
      } catch (err) {
        console.error('Upload failed:', err);
        return 'Publish failed. Check your connection and permissions.';
      } finally {
        setAdminBusy(false);
      }
    },
    [isAdmin, fbUser, strategies, profile, notify],
  );

  const handleEditSave = useCallback(
    async (data: StrategyFormData): Promise<string | void> => {
      if (!isAdmin || !editingStrat) return 'Admin access required.';
      setEditBusy(true);
      try {
        if (services) {
          await updateDoc(doc(services.db, ...paths.strategies, editingStrat.id), {
            title: data.title.trim(),
            description: data.description.trim(),
            content: data.content,
            assetCategory: data.assetCategory,
            timeframes: data.timeframes,
            isAutoTrade: data.isAutoTrade,
            updatedAt: serverTimestamp(),
          });
        } else {
          persistDemoStrategies(
            strategies.map((s) =>
              s.id === editingStrat.id
                ? {
                    ...s,
                    title: data.title.trim(),
                    description: data.description.trim(),
                    content: data.content,
                    assetCategory: data.assetCategory,
                    timeframes: data.timeframes,
                    isAutoTrade: data.isAutoTrade,
                  }
                : s,
            ),
          );
        }
        setEditingStrat(null);
        notify('Strategy updated.', 'success');
      } catch (err) {
        console.error('Update failed:', err);
        return 'Update failed. Check your connection and permissions.';
      } finally {
        setEditBusy(false);
      }
    },
    [isAdmin, editingStrat, strategies, notify],
  );

  const handleDelete = useCallback(async () => {
    if (!isAdmin || !stratToDelete) return;
    setIsDeleting(true);
    try {
      if (services) {
        await deleteDoc(doc(services.db, ...paths.strategies, stratToDelete.id));
      } else {
        persistDemoStrategies(strategies.filter((s) => s.id !== stratToDelete.id));
      }
      setStratToDelete(null);
      notify('Strategy deleted.', 'success');
    } catch (err) {
      console.error('Delete failed:', err);
      notify('Delete failed. Check your connection and permissions.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [isAdmin, stratToDelete, strategies, notify]);

  const handleUpgradeUser = useCallback(
    async (email: string): Promise<string | void> => {
      if (!isAdmin) return 'Admin access required.';
      setAdminUserStatus('LOADING');
      try {
        if (services) {
          const q = query(
            collection(services.db, ...paths.users),
            where('email', '==', email.toLowerCase()),
          );
          const snap = await getDocs(q);
          if (snap.empty) return 'User not found.';
          await updateDoc(doc(services.db, ...paths.users, snap.docs[0].id), {
            plan: 'PRO',
            expiresAt: null,
          });
        } else {
          const target = loadDemoProfile(email);
          if (!target) return 'User not found (demo profiles are per-browser).';
          saveDemoProfile({ ...target, plan: 'PRO' });
          if (profile?.email === email) await persistProfile({ plan: 'PRO' });
        }
        notify(`${email} upgraded to PRO.`, 'success');
        setAdminUserStatus('SUCCESS');
        setTimeout(() => setAdminUserStatus('IDLE'), 2500);
      } catch (err) {
        console.error('Upgrade failed:', err);
        setAdminUserStatus('IDLE');
        return 'Upgrade failed. Check your connection and permissions.';
      }
    },
    [isAdmin, profile, persistProfile, notify],
  );

  const handleDowngradeUser = useCallback(
    async (email: string): Promise<string | void> => {
      if (!isAdmin) return 'Admin access required.';
      setAdminUserStatus('LOADING');
      try {
        if (services) {
          const q = query(
            collection(services.db, ...paths.users),
            where('email', '==', email.toLowerCase()),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(services.db, ...paths.users, snap.docs[0].id), {
              plan: 'STARTER',
              expiresAt: null,
            });
          }
        } else {
          const target = loadDemoProfile(email);
          if (target) saveDemoProfile({ ...target, plan: 'STARTER' });
          if (profile?.email === email) await persistProfile({ plan: 'STARTER' });
        }
        notify(`${email} reset to Starter.`, 'success');
        setAdminUserStatus('SUCCESS');
        setTimeout(() => setAdminUserStatus('IDLE'), 2500);
      } catch (err) {
        console.error('Downgrade failed:', err);
        setAdminUserStatus('IDLE');
        return 'Operation failed. Check your connection and permissions.';
      } finally {
        if (adminUserStatus !== 'SUCCESS') setAdminUserStatus('IDLE');
      }
    },
    [isAdmin, profile, persistProfile, notify, adminUserStatus],
  );

  // ---------- backtest ----------
  const runBacktest = useCallback(async () => {
    if (!selectedStratId || !profile) return;
    if (plan === 'STARTER') {
      notify('Starter plan: backtests are not included. Please upgrade.', 'error');
      return;
    }
    if (plan === 'BASIC' && !isAdmin && profile.backtestCount >= 5) {
      notify('Basic plan limit: 5 backtests per month reached.', 'error');
      return;
    }
    const strat = strategies.find((s) => s.id === selectedStratId);
    if (!strat) {
      notify('Strategy not found.', 'error');
      return;
    }
    setIsTesting(true);
    if (!isAdmin) await persistProfile({ backtestCount: (profile.backtestCount || 0) + 1 });
    // Let the spinner paint before the (fast) deterministic compute.
    await new Promise((r) => setTimeout(r, 900));
    const stats = runBacktestEngine(strat.id);
    setRuns((prev) =>
      [
        {
          runId: `${strat.id}-${Date.now()}`,
          strategyId: strat.id,
          strategyTitle: strat.title,
          ranAt: Date.now(),
          stats,
        },
        ...prev,
      ].slice(0, 20),
    );
    setIsTesting(false);
  }, [selectedStratId, profile, plan, isAdmin, strategies, persistProfile, notify]);

  // ---------- chart tab ----------
  const loadSymbol = useCallback(() => {
    const v = validateSymbol(searchQuery);
    if (!v.ok) {
      notify(v.error!, 'error');
      return;
    }
    setSelectedAsset(searchQuery.trim().toUpperCase());
  }, [searchQuery, notify]);

  // ---------- render ----------
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-terminal-green rounded-full animate-spin" />
        <div className="text-xs text-zinc-500 tracking-[0.3em]">LOADING MONASTRATEGSYS</div>
      </div>
    );
  }

  const navItems: { id: TabId; label: string }[] = [];
  if (!profile) {
    navItems.push({ id: 'plan', label: 'Plans' });
  } else if (isAdmin) {
    navItems.push(
      { id: 'chart', label: 'Chart' },
      { id: 'strategies', label: 'Strategies' },
      { id: 'backtest', label: 'Backtest' },
      { id: 'upload', label: 'Admin' },
    );
  } else {
    navItems.push(
      { id: 'chart', label: 'Chart' },
      { id: 'strategies', label: 'Strategies' },
      { id: 'backtest', label: 'Backtest' },
      { id: 'plan', label: 'Upgrade' },
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden text-sm">
      <div className="scanline" aria-hidden />

      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-3 md:px-6 bg-black z-50 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-base md:text-lg font-bold tracking-tight">Monastrategys</div>
          {demoMode && (
            <span className="bg-yellow-500/15 text-yellow-400 text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-500/30 tracking-widest">
              DEMO
            </span>
          )}
          {profile && plan === 'PRO' && (
            <span className="bg-terminal-green/15 text-terminal-green text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded border border-terminal-green/30 tracking-widest">
              PRO
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {profile ? (
            <>
              <div className="text-right hidden sm:block">
                <div className={`text-[10px] md:text-xs font-medium ${isAdmin ? 'text-purple-400' : 'text-zinc-400'}`}>
                  {isAdmin ? 'Admin' : 'User'} · {plan}
                </div>
                <div className="text-[9px] md:text-[10px] text-zinc-500 truncate max-w-[180px] normal-case">
                  {profile.email}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-zinc-900 border border-white/10 px-2 md:px-3 py-1.5 rounded-md text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2"
                title="Log out"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden md:inline">Log Out</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuthOverlay(true)}
              className="text-xs font-bold text-zinc-400 hover:text-white transition-colors tracking-widest"
            >
              SIGN IN
            </button>
          )}
        </div>
      </header>

      {dataError && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2.5 flex items-center justify-between z-40 shrink-0">
          <span className="text-xs text-red-300 normal-case tracking-normal">{dataError}</span>
          <button onClick={() => setDataError(null)} className="text-red-300 hover:text-white text-xs font-bold ml-4">
            DISMISS
          </button>
        </div>
      )}

      <main className="flex-1 relative flex flex-col overflow-hidden pb-16">
        {/* CHART TAB */}
        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-white/5 bg-zinc-950 flex items-center px-4 py-2.5 justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 max-w-2xl">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && loadSymbol()}
                  placeholder="Symbol (e.g. BTCUSDT)..."
                  className="flex-1 bg-zinc-900 border border-white/10 px-4 py-2 text-sm text-white outline-none rounded-md focus:border-terminal-green/60 transition-colors normal-case"
                />
                <button
                  onClick={loadSymbol}
                  className="bg-white text-black text-sm font-bold px-6 py-2 rounded-md hover:bg-zinc-200 transition-all tracking-widest"
                >
                  LOAD
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 font-medium ml-4 hidden md:flex items-center gap-2 tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                LIVE FEED
              </div>
            </div>
            <div className="flex-1 p-2 min-h-0">
              <TradingViewWidget symbol={selectedAsset} />
            </div>
          </div>
        )}

        {/* AUTH */}
        {(showAuthOverlay || (!profile && activeTab !== 'plan')) && (
          <AuthModal
            allowClose={showAuthOverlay}
            googleEnabled={!demoMode}
            onClose={() => setShowAuthOverlay(false)}
            onEmailAuth={handleEmailAuth}
            onGoogleSignIn={handleGoogleSignIn}
          />
        )}

        {/* PLANS */}
        {activeTab === 'plan' && (
          <PlansView
            profile={profile}
            demoMode={demoMode}
            selectedPlan={selectedPlan}
            paymentStatus={paymentStatus}
            walletAddress={walletAddress}
            manualAddress={manualAddress}
            showProModal={showProModal}
            onRequireAuth={() => setShowAuthOverlay(true)}
            onSelectPlan={(p) => {
              setSelectedPlan(p);
              setPaymentStatus('IDLE');
            }}
            onCancelPlan={() => {
              setSelectedPlan(null);
              setPaymentStatus('IDLE');
            }}
            onManualAddressChange={setManualAddress}
            onPay={submitPayment}
            onVerify={verifyManualPayment}
            onDemoSetPlan={demoSetPlan}
            onDismissProModal={() => setShowProModal(false)}
          />
        )}

        {/* STRATEGIES */}
        {profile && activeTab === 'strategies' && (
          <StrategiesView
            strategies={strategies}
            plan={plan}
            isAdmin={isAdmin}
            unlockedStrats={profile.unlockedStrats}
            starterLeft={Math.max(0, 1 - profile.unlockedStrats.length)}
            onOpen={unlockStrategy}
            onEdit={(s) => setEditingStrat(s)}
            onDelete={(s) => setStratToDelete(s)}
            onUnlockRandom={unlockRandomStrategy}
          />
        )}

        {/* BACKTEST */}
        {profile && activeTab === 'backtest' && (
          <BacktestView
            strategies={strategies}
            plan={plan}
            backtestCount={profile.backtestCount}
            isAdmin={isAdmin}
            selectedStratId={selectedStratId}
            isTesting={isTesting}
            runs={runs}
            onSelectStrategy={setSelectedStratId}
            onRun={runBacktest}
          />
        )}

        {/* ADMIN */}
        {profile && isAdmin && activeTab === 'upload' && (
          <AdminView
            busy={adminBusy}
            userOp={adminUserStatus}
            onUpload={handleUpload}
            onUpgradeUser={handleUpgradeUser}
            onDowngradeUser={handleDowngradeUser}
          />
        )}
      </main>

      {/* EDIT MODAL */}
      {editingStrat && (
        <div className="fixed inset-0 bg-black/95 z-[90] flex flex-col p-4 md:p-10 overflow-hidden backdrop-blur-sm">
          <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-h-0">
            <div className="flex justify-between items-center border-b border-white/10 p-5 md:p-6 bg-zinc-900/50 shrink-0">
              <h2 className="text-lg font-bold text-white">Edit Strategy</h2>
              <button
                onClick={() => setEditingStrat(null)}
                className="text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-md hover:bg-white/5 text-xs font-bold tracking-widest border border-white/10"
              >
                CANCEL
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 md:p-6 min-h-0">
              <StrategyForm
                initial={{
                  title: editingStrat.title,
                  description: editingStrat.description ?? '',
                  assetCategory: editingStrat.assetCategory,
                  timeframes: editingStrat.timeframes ?? [],
                  content: editingStrat.content,
                  isAutoTrade: !!editingStrat.isAutoTrade,
                }}
                busy={editBusy}
                submitLabel="SAVE CHANGES"
                onSubmit={handleEditSave}
                onCancel={() => setEditingStrat(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingStrat && (
        <StrategyModal strategy={viewingStrat} onClose={() => setViewingStrat(null)} />
      )}

      {/* DELETE CONFIRM */}
      {stratToDelete && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed normal-case tracking-normal">
              Delete <span className="text-white font-bold">"{stratToDelete.title}"</span>? This cannot
              be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setStratToDelete(null)}
                disabled={isDeleting}
                className="flex-1 bg-zinc-900 text-white py-3 rounded-md text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white py-3 rounded-md text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Strategy'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER NAV */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-white/10 flex items-center justify-center px-4 z-[60]">
        <nav className="flex gap-1 w-full max-w-2xl">
          {navItems.map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id)}
              className={`flex-1 text-xs font-bold tracking-widest py-3 border-t-2 transition-all ${
                activeTab === nav.id
                  ? 'text-terminal-green border-terminal-green bg-terminal-green/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {nav.label.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error || event.message);
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <InnerApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}
