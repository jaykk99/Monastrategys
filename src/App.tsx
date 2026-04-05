import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  GoogleGenAI 
} from "@google/genai";
import * as web3 from '@solana/web3.js';

declare global {
  interface Window {
    solana: any;
  }
}

import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

import firebaseConfigData from '../firebase-applet-config.json';

// --- SYSTEM CONSTANTS & FIREBASE CONFIG ---
const APP_ID = 'monaco-trading-ecosystem';

const app = initializeApp(firebaseConfigData);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const ADMIN_EMAIL = "jayomer1234@gmail.com";
const ADMIN_PASS = "Jayisthegoat09";

// ONLY SOL Address as requested
const WALLET_ADDRESSES = {
  SOL: "4M6VH8S8H5F9Z3Y1G8M7N2B5V4C3X2Z1A0S9D8F7G6H" 
};

const ASSET_CATEGORIES = ["CRYPTO", "STOCKS", "FOREX", "FUNDS", "COMMODITIES", "INDICES"];
const TIMEFRAMES = ["1M", "5M", "15M", "30M", "1H", "4H", "1D", "1W"];

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<any, any> {
  public state: any = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-10 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <p className="text-zinc-500 mb-8 max-w-md">
            The application encountered an unexpected error. Please try refreshing the page.
          </p>
          <pre className="bg-zinc-900 p-4 rounded text-xs text-red-400 overflow-auto max-w-full mb-8">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-2 rounded-md font-medium hover:bg-zinc-200 transition-all"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const TradingViewWidget = ({ symbol }) => {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 11)}`);

  useEffect(() => {
    const initWidget = () => {
      if ((window as any).TradingView && document.getElementById(containerId.current)) {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": (symbol.includes("USDT") || symbol.includes("BTC") ? "BINANCE:" + symbol : "AMEX:" + symbol),
          "interval": "15",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "enable_publishing": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": containerId.current,
          "calendar": false,
          "support_host": "https://www.tradingview.com"
        });
      }
    };

    const timeoutId = setTimeout(initWidget, 200);
    return () => clearTimeout(timeoutId);
  }, [symbol]);

  return <div id={containerId.current} className="tradingview-widget-container h-full w-full border border-white/5"></div>;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const App = () => {
  useEffect(() => {
    // Global error handler to catch "Script error." and other silent failures
    const handleGlobalError = (event) => {
      console.error("Global Error Caught:", event.error || event.message);
      if (event.message === "Script error.") {
        console.warn("A cross-origin script failed to load or had an error. This is often due to TradingView or other external widgets in an iframe environment.");
      }
    };

    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  const [user, setUser] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [activeTab, setActiveTab] = useState('plan');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState("BTCUSDT");
  const [searchQuery, setSearchQuery] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [showAboutInPlan, setShowAboutInPlan] = useState(false);

  const [manualAddress, setManualAddress] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // User Profile States
  const [currentPlanName, setCurrentPlanName] = useState("STARTER");
  const [unlockedStrats, setUnlockedStrats] = useState([]); 
  const [backtestCount, setBacktestCount] = useState(0);

  // Payment States
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("IDLE");
  const [showProSuccessModal, setShowProSuccessModal] = useState(false);

  // Strategy View States
  const [filterAsset, setFilterAsset] = useState("ALL");
  const [filterTimeframe, setFilterTimeframe] = useState("ALL");
  const [filterAutoTrade, setFilterAutoTrade] = useState("ALL");
  const [stratSearch, setStratSearch] = useState("");
  const [viewingStrat, setViewingStrat] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingStrat, setEditingStrat] = useState(null);
  const [stratToDelete, setStratToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Backtest States
  const [selectedStratId, setSelectedStratId] = useState("");
  const [btResults, setBtResults] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Upload States
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadAssetCat, setUploadAssetCat] = useState("CRYPTO");
  const [uploadTimeframes, setUploadTimeframes] = useState([]);
  const [adminUserEmail, setAdminUserEmail] = useState("jayo87825@gmail.com");
  const [adminUserStatus, setAdminUserStatus] = useState("IDLE");
  const [uploadCode, setUploadCode] = useState("");
  const [uploadIsAutoTrade, setUploadIsAutoTrade] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset payment state when plan changes
  useEffect(() => {
    setPaymentStatus("IDLE");
    setTxHash("");
  }, [selectedPlan]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      if (u) {
        setShowAuthOverlay(false);
      } else {
        setActiveTab('plan');
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setStrategies([]);
      return;
    }
    // Load Global Strategies
    const qStrats = collection(db, 'artifacts', APP_ID, 'public', 'data', 'global_strategies');
    return onSnapshot(qStrats, (snapshot) => {
      const strats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStrategies(strats);
    }, (err) => {
      console.error("Strategies Listener Error:", err);
      handleFirestoreError(err, OperationType.LIST, 'global_strategies');
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
    return onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check for plan expiration
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
          updateDoc(userDocRef, { plan: "STARTER", expiresAt: null });
          setCurrentPlanName("STARTER");
        } else {
          // AUTO-UPGRADE MIGRATION FOR USER
          if (user.email?.toLowerCase() === "jayo87825@gmail.com" && data.plan !== "PRO") {
            updateDoc(userDocRef, { plan: "PRO" });
            setCurrentPlanName("PRO");
          } else {
            setCurrentPlanName(data.plan || "STARTER");
          }
        }
        
        setUnlockedStrats(data.unlockedStrats || []);
        setBacktestCount(data.backtestCount || 0);
      } else {
        setDoc(userDocRef, { 
          uid: user.uid,
          email: user.email, 
          role: user.email === ADMIN_EMAIL ? "admin" : "user",
          plan: user.email?.toLowerCase() === "jayo87825@gmail.com" ? "PRO" : "STARTER", 
          unlockedStrats: [],
          createdAt: serverTimestamp()
        }).catch(err => {
          console.error("User Doc Creation Error:", err);
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        });
      }
    }, (err) => {
      console.error("User Doc Listener Error:", err);
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
  }, [user]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const formatAuthError = (err) => {
    let msg = err.message.replace('Firebase: ', '').toUpperCase();
    if (err.code === 'auth/popup-blocked') return "POPUP BLOCKED BY BROWSER. PLEASE ENABLE POPUPS.";
    if (err.code === 'auth/popup-closed-by-user') return "SIGN-IN POPUP CLOSED. PLEASE KEEP THE WINDOW OPEN UNTIL FINISHED. IF IT CLOSES AUTOMATICALLY, CHECK IF THIS DOMAIN IS AUTHORIZED IN FIREBASE.";
    if (err.code === 'auth/network-request-failed') return "NETWORK ERROR. CHECK YOUR CONNECTION.";
    if (err.code === 'auth/unauthorized-domain') return "UNAUTHORIZED DOMAIN. PLEASE ADD THIS DOMAIN TO FIREBASE CONSOLE.";
    if (err.code === 'auth/internal-error') return "INTERNAL AUTH ERROR. PLEASE REFRESH AND TRY AGAIN.";
    if (err.code === 'auth/cancelled-popup-request') return "SIGN-IN CANCELLED. PLEASE TRY AGAIN.";
    return msg;
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsProcessing(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthOverlay(false);
    } catch (err) {
      console.error("Google Auth Error:", err);
      setAuthError(formatAuthError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      if (cleanEmail === ADMIN_EMAIL && password !== ADMIN_PASS) {
        throw new Error("ADMIN_PASS_INVALID: PLEASE USE THE CORRECT ADMIN PASSWORD.");
      }
      
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        } catch (loginErr) {
          if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
            // Fallback to sign up if user not found, but only if not admin
            if (cleanEmail !== ADMIN_EMAIL) {
              await createUserWithEmailAndPassword(auth, cleanEmail, password);
            } else {
              throw loginErr;
            }
          } else { 
            console.error("Auth Error:", loginErr);
            throw loginErr; 
          }
        }
      }
      setShowAuthOverlay(false);
    } catch (err) { 
      setAuthError(formatAuthError(err)); 
    } finally { setIsProcessing(false); }
  };

  const unlockStrategy = async (strat) => {
    if (strat.isAutoTrade && currentPlanName !== "PRO" && !isAdmin) {
      alert("AUTO TRADE STRATEGIES ARE EXCLUSIVE TO PRO USERS.");
      return;
    }
    if (currentPlanName === "PRO" || isAdmin) {
      setViewingStrat(strat);
      return;
    }
    if (currentPlanName === "BASIC") {
      if (unlockedStrats.includes(strat.id)) {
        setViewingStrat(strat);
      } else if (unlockedStrats.length < 3) {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
        await updateDoc(userDocRef, {
          unlockedStrats: [...unlockedStrats, strat.id]
        });
        setViewingStrat(strat);
      } else {
        alert("BASIC PLAN LIMIT: 3 STRATEGIES REACHED.");
      }
      return;
    }
    if (currentPlanName === "STARTER") {
      if (unlockedStrats.includes(strat.id)) {
        setViewingStrat(strat);
      } else {
        alert("STARTER PLAN: USE 'UNLOCK RANDOM' TO GAIN ACCESS.");
      }
      return;
    }
    alert("UPGRADE PLAN TO UNLOCK SPECIFIC STRATEGIES.");
  };

  const unlockRandomStrategy = async () => {
    if (currentPlanName !== "STARTER") return;
    if (unlockedStrats.length >= 1) {
      alert("STARTER LIMIT: 1 RANDOM STRATEGY REACHED.");
      return;
    }
    const available = strategies.filter(s => !unlockedStrats.includes(s.id));
    if (available.length === 0) {
      alert("NO MORE STRATEGIES TO UNLOCK.");
      return;
    }
    const random = available[Math.floor(Math.random() * available.length)];
    const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
    await updateDoc(userDocRef, {
      unlockedStrats: [...unlockedStrats, random.id]
    });
    alert(`UNLOCKED: ${random.title}`);
  };

  const connectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const resp = await window.solana.connect();
        setWalletAddress(resp.publicKey.toString());
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("PLEASE INSTALL PHANTOM WALLET");
    }
  };

  const updateStrategy = async () => {
    if (!editingStrat) return;
    setIsUploading(true);
    try {
      const stratDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'global_strategies', editingStrat.id);
      await updateDoc(stratDocRef, {
        title: editingStrat.title,
        description: editingStrat.description,
        content: editingStrat.content,
        assetCategory: editingStrat.assetCategory,
        timeframes: editingStrat.timeframes,
        isAutoTrade: editingStrat.isAutoTrade || false,
        updatedAt: serverTimestamp()
      });
      setEditingStrat(null);
    } catch (err) {
      console.error(err);
      alert("UPDATE FAILED: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const submitPayment = async () => {
    if (!user) {
      setShowAuthOverlay(true);
      return;
    }
    setPaymentStatus("SUBMITTING");
    
    try {
      if (selectedPlan?.price === "0" || selectedPlan?.isTrial) {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
        const updateData: any = { plan: selectedPlan.name.toUpperCase() };
        if (selectedPlan.name === "Basic" && selectedPlan.isTrial) {
          // Set expiration to 24 hours from now
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);
          updateData.expiresAt = Timestamp.fromDate(expiresAt);
        } else if (selectedPlan.name === "Starter") {
          updateData.expiresAt = null; // Clear expiration if switching to starter
        }
        await updateDoc(userDocRef, updateData);
        const isPro = selectedPlan.name === "Pro";
        setTimeout(() => {
          setPaymentStatus("SUBMITTED");
          setSelectedPlan(null);
          if (isPro) {
            setShowProSuccessModal(true);
          }
        }, 1000);
        return;
      }

      if (!walletAddress) {
        await connectWallet();
        setPaymentStatus("IDLE");
        return;
      }

      const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');
      const fromPubkey = new web3.PublicKey(walletAddress);
      const toPubkey = new web3.PublicKey(WALLET_ADDRESSES.SOL);
      
      // Mock SOL conversion: $150 per SOL
      const solAmount = parseFloat(selectedPlan.price) / 150;
      
      const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(solAmount * web3.LAMPORTS_PER_SOL),
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      if (!window.solana) {
        alert("SOLANA WALLET NOT FOUND. PLEASE INSTALL PHANTOM.");
        setPaymentStatus("IDLE");
        return;
      }
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      setTxHash(signature);
      
      // Automatic verification
      await connection.confirmTransaction(signature);
      
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'payment_verifications'), {
        userId: user.uid, 
        email: user.email, 
        plan: selectedPlan.name, 
        amount: selectedPlan.price, 
        txHash: signature, 
        currency: "SOL",
        timestamp: serverTimestamp(), 
        status: "verified"
      });

      const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
      const updateData: any = { plan: selectedPlan.name.toUpperCase() };
      const expiresAt = new Date();
      if (selectedPlan.isTrial) {
        expiresAt.setHours(expiresAt.getHours() + 24);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }
      updateData.expiresAt = Timestamp.fromDate(expiresAt);
      await updateDoc(userDocRef, updateData);
      
      const isPro = selectedPlan.name === "Pro";
      setPaymentStatus("SUBMITTED");
      setTxHash("");
      if (isPro) {
        setShowProSuccessModal(true);
      }
    } catch (err) { 
      console.error(err);
      setPaymentStatus("IDLE"); 
      alert("PAYMENT FAILED: " + err.message);
    }
  };

  const verifyManualPayment = async () => {
    if (!selectedPlan || (!walletAddress && !manualAddress)) {
      alert("PLEASE CONNECT WALLET OR ENTER ADDRESS TO VERIFY.");
      return;
    }
    const addressToVerify = manualAddress || walletAddress;
    setPaymentStatus("SUBMITTING");
    
    try {
      const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');
      const recipientPubkey = new web3.PublicKey(WALLET_ADDRESSES.SOL);
      
      // 1. Get recent signatures for the recipient address
      const signatures = await connection.getSignaturesForAddress(recipientPubkey, { limit: 30 });
      
      // 2. Calculate expected amount in lamports ($150/SOL)
      const expectedAmountLamports = Math.floor((parseFloat(selectedPlan.price) / 150) * web3.LAMPORTS_PER_SOL);
      
      let verifiedSig = null;
      
      // 3. Scan transactions for a match
      for (const sigInfo of signatures) {
        const tx = await connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx || !tx.meta || tx.meta.err) continue;
        
        const instructions = tx.transaction.message.instructions;
        for (const inst of instructions) {
          if ('parsed' in inst && inst.program === 'system' && inst.parsed.type === 'transfer') {
            const { info } = inst.parsed;
            // Check if destination, source, and amount match
            if (info.destination === WALLET_ADDRESSES.SOL && 
                info.source === addressToVerify && 
                Math.abs(info.lamports - expectedAmountLamports) < 2000000) { // ~0.002 SOL tolerance for fees/rounding
              
              verifiedSig = sigInfo.signature;
              break;
            }
          }
        }
        if (verifiedSig) break;
      }
      
      if (verifiedSig) {
        // 4. Update user plan in Firestore
        const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
        const updateData: any = { 
          plan: selectedPlan.name.toUpperCase(),
          lastPaymentSig: verifiedSig,
          paymentVerifiedAt: serverTimestamp()
        };
        const expiresAt = new Date();
        if (selectedPlan.isTrial) {
          expiresAt.setHours(expiresAt.getHours() + 24);
        } else {
          expiresAt.setDate(expiresAt.getDate() + 30);
        }
        updateData.expiresAt = Timestamp.fromDate(expiresAt);
        await updateDoc(userDocRef, updateData);
        
        const isPro = selectedPlan.name === "Pro";
        
        // Log verification
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'payment_verifications'), {
          userId: user.uid, 
          email: user.email, 
          plan: selectedPlan.name, 
          amount: selectedPlan.price, 
          txHash: verifiedSig, 
          sender: addressToVerify,
          timestamp: serverTimestamp(), 
          status: "verified_via_scan"
        });

        setPaymentStatus("SUBMITTED");
        if (isPro) {
          setShowProSuccessModal(true);
        }
      } else {
        alert("NO MATCHING TRANSACTION FOUND. PLEASE ENSURE YOU SENT THE CORRECT AMOUNT TO THE RECIPIENT ADDRESS FROM THIS WALLET.");
        setPaymentStatus("IDLE");
      }
    } catch (err) {
      console.error("Verification Error:", err);
      setPaymentStatus("IDLE");
      alert("VERIFICATION FAILED: " + err.message);
    }
  };

  const handleUpload = async () => {
    if (!isAdmin || !uploadTitle || !uploadCode || uploadTimeframes.length === 0) {
      if (uploadTimeframes.length === 0) alert("SELECT AT LEAST ONE TIMEFRAME.");
      return;
    }
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'global_strategies'), {
        title: uploadTitle, 
        description: uploadDesc, 
        assetCategory: uploadAssetCat, 
        timeframes: uploadTimeframes, 
        content: uploadCode, 
        isAutoTrade: uploadIsAutoTrade,
        author: user.uid, 
        timestamp: serverTimestamp()
      });
      setUploadTitle(""); 
      setUploadDesc("");
      setUploadCode(""); 
      setUploadTimeframes([]);
      setUploadIsAutoTrade(false);
      setActiveTab('strategies');
    } catch (err) { 
      console.error(err); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleAdminUpgradeUser = async () => {
    if (!isAdmin || !adminUserEmail) return;
    setAdminUserStatus("LOADING");
    try {
      const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), where("email", "==", adminUserEmail.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("User not found.");
        setAdminUserStatus("IDLE");
        return;
      }
      const userDoc = snap.docs[0];
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', userDoc.id), {
        plan: "PRO",
        expiresAt: null // Permanent Pro
      });
      alert(`User ${adminUserEmail} upgraded to PRO.`);
      setAdminUserEmail("");
      setAdminUserStatus("SUCCESS");
      setTimeout(() => setAdminUserStatus("IDLE"), 2000);
    } catch (err) {
      console.error(err);
      alert("Error upgrading user.");
      setAdminUserStatus("IDLE");
    }
  };

  const deleteStrategy = async () => {
    if (!isAdmin || !stratToDelete) return;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'global_strategies', stratToDelete.id));
      setStratToDelete(null);
    } catch (err) {
      console.error(err);
      setErrorMessage("FAILED TO DELETE STRATEGY. PLEASE TRY AGAIN.");
    } finally {
      setIsDeleting(false);
    }
  };

  const runBacktest = async () => {
    if (!selectedStratId) return;
    
    if (currentPlanName === "STARTER") {
      alert("STARTER PLAN: BACKTESTS ARE NOT INCLUDED. PLEASE UPGRADE.");
      return;
    }
    
    if (currentPlanName === "BASIC" && backtestCount >= 5) {
      alert("BASIC PLAN LIMIT: 5 BACKTESTS PER MONTH REACHED.");
      return;
    }

    setIsTesting(true);
    setBtResults(null);
    
    // Increment backtest count in Firestore
    if (user && !isAdmin) {
      const userDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
      await updateDoc(userDocRef, {
        backtestCount: (backtestCount || 0) + 1
      });
    }

    // Real-time calculation simulation for UI
    setTimeout(() => {
      setBtResults({
        netProfit: "$" + (Math.random() * 450000).toLocaleString(undefined, {minimumFractionDigits: 2}),
        winRate: (75 + Math.random() * 15).toFixed(2) + "%",
        profitFactor: (2.1 + Math.random() * 0.9).toFixed(2),
        drawdown: (0.4 + Math.random() * 1.5).toFixed(2) + "%",
        trades: Math.floor(500 + Math.random() * 1000)
      });
      setIsTesting(false);
    }, 1500);
  };

  if (loading) return <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-sans text-xs text-zinc-500 tracking-widest uppercase">Loading Monastrategys...</div>;

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-black text-white flex flex-col font-sans overflow-hidden text-sm">
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-3 md:px-6 bg-black z-50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-base md:text-lg font-bold tracking-tight truncate max-w-[120px] md:max-w-none">Monastrategys</div>
          {currentPlanName === "PRO" && (
            <span className="bg-green-500/20 text-green-500 text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded border border-green-500/30 tracking-widest uppercase">PRO</span>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <div className={"text-[10px] md:text-xs font-medium " + (isAdmin ? "text-purple-500" : "text-zinc-400")}>{isAdmin ? "Admin" : "User"}</div>
                <div className="text-[9px] md:text-[10px] text-zinc-500 truncate max-w-[150px]">{user.email + " | " + currentPlanName}</div>
              </div>
              <button 
                onClick={() => signOut(auth)} 
                className="bg-zinc-900 border border-white/10 px-2 md:px-3 py-1.5 rounded-md text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2"
                title="Log Out"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden md:inline">Log Out</span>
              </button>
            </>
          ) : (
             <div className="text-xs font-medium text-zinc-500">Guest</div>
          )}
        </div>
      </header>

      <main className="flex-1 relative flex flex-col overflow-hidden pb-16">
        
        {/* CHART TAB */}
        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 border-b border-white/5 bg-zinc-950 flex items-center px-4 justify-between">
               <div className="flex items-center gap-4 flex-1 max-w-2xl">
                 <input 
                   value={searchQuery} 
                   onChange={(e) => setSearchQuery(e.target.value.toUpperCase())} 
                   onKeyDown={(e) => e.key === 'Enter' && searchQuery && setSelectedAsset(searchQuery)} 
                   placeholder="Search asset (e.g. BTCUSDT)..." 
                   className="flex-1 bg-zinc-900 border border-white/10 px-4 py-2 text-sm text-white outline-none rounded-md focus:border-zinc-500 transition-colors" 
                 />
                 <button onClick={() => setSelectedAsset(searchQuery)} className="bg-white text-black text-sm font-medium px-6 py-2 rounded-md hover:bg-zinc-200 transition-all">Load</button>
               </div>
               <div className="text-xs text-zinc-500 font-medium ml-4 hidden md:block">Live Feed Active</div>
            </div>
            <div className="flex-1 p-2">
              <TradingViewWidget symbol={selectedAsset} />
            </div>
          </div>
        )}

        {/* AUTH OVERLAY */}
        {(showAuthOverlay || (!user && activeTab !== 'plan')) && (
           <div className="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 z-[100] backdrop-blur-sm">
           <div className="max-w-sm w-full border border-white/10 bg-zinc-950 p-8 rounded-xl shadow-2xl relative">
             {showAuthOverlay && (
               <button onClick={() => setShowAuthOverlay(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             )}
             <div className="text-center mb-8">
               <h2 className="text-2xl font-bold tracking-tight mb-2">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
               <div className="text-sm text-zinc-500">{isSignUp ? 'Join Monastrategys today' : 'Access your strategies and plans'}</div>
             </div>
             
             <button onClick={handleGoogleSignIn} disabled={isProcessing} className="w-full bg-white text-black py-3 rounded-md font-medium text-sm hover:bg-zinc-200 transition-all mb-6 flex items-center justify-center gap-3 disabled:opacity-50">
               {isProcessing ? (
                 <div className="w-4 h-4 border-2 border-zinc-300 border-t-black rounded-full animate-spin"></div>
               ) : (
                 <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
               )}
               Continue with Google
             </button>

             <div className="relative flex items-center py-4 mb-2">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-zinc-500 text-xs">or</span>
                <div className="flex-grow border-t border-white/10"></div>
             </div>

             <form onSubmit={handleAuthSubmit} className="space-y-4">
               <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm outline-none focus:border-zinc-500 text-white placeholder:text-zinc-500 transition-colors" required />
               <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm outline-none focus:border-zinc-500 text-white placeholder:text-zinc-500 transition-colors" required />
               <button disabled={isProcessing} type="submit" className="w-full bg-zinc-800 text-white py-3 rounded-md font-medium text-sm hover:bg-zinc-700 transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                 {isProcessing ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                     {isSignUp ? 'Creating...' : 'Signing in...'}
                   </>
                 ) : (isSignUp ? 'Sign Up' : 'Sign In')}
               </button>
               {authError && <div className="text-sm text-red-400 text-center mt-4">{authError}</div>}
             </form>

             <div className="mt-6 text-center">
               <button 
                 onClick={() => setIsSignUp(!isSignUp)} 
                 className="text-xs text-zinc-500 hover:text-white transition-colors"
               >
                 {isSignUp ? 'Already have an account? Sign In' : 'Don\'t have an account? Sign Up'}
               </button>
             </div>
           </div>
         </div>
        )}

        {/* PLANS TAB */}
        {/* UPGRADE TAB */}
        {activeTab === 'plan' && (
          <div className="absolute inset-0 bg-black p-10 flex flex-col items-center z-20 overflow-y-auto">
            <div className="max-w-4xl w-full pb-20">
              {!showAboutInPlan ? (
                <>
                  <div className="text-center mb-12 border-b border-white/10 pb-8">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-4">Subscription Plans</h2>
                    {currentPlanName === "PRO" && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 inline-block">
                        <div className="text-green-500 font-bold text-sm flex items-center gap-2 justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          PRO STATUS ACTIVE
                        </div>
                        <div className="text-zinc-500 text-[10px] mt-1">Full access to all strategies and automated trading.</div>
                      </div>
                    )}
                    {!user && (
                      <div className="flex items-center justify-center gap-4 text-sm">
                        <button onClick={() => setShowAuthOverlay(true)} className="text-zinc-400 hover:text-white transition-colors underline underline-offset-4">Sign In</button>
                        <span className="text-zinc-700">|</span>
                        <button onClick={() => setShowAuthOverlay(true)} className="text-zinc-400 hover:text-white transition-colors underline underline-offset-4">Register</button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { name: "Starter", price: "0", desc: ["1 Random Strategy Unlock", "No Backtests"] },
                      { name: "Basic", price: "9", desc: ["3 new strategies every month", "24H free trial", "5 Backtests per Month"], isTrial: true },
                      { name: "Pro", price: "29", desc: ["All Strategies + AutoTrade", "Unlimited Backtests"] }
                    ].map(plan => (
                      <div key={plan.name} className={"bg-zinc-950 border " + (currentPlanName === plan.name.toUpperCase() ? "border-zinc-500" : "border-white/10") + " p-8 rounded-xl flex flex-col relative"}>
                        {currentPlanName === plan.name.toUpperCase() && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-full font-medium">Current Plan</div>}
                        <div className="text-xl text-white font-bold mb-2">{plan.name}</div>
                        <div className="text-2xl font-light mb-6">${plan.price}<span className="text-sm text-zinc-500">/mo</span></div>
                        {currentPlanName === plan.name.toUpperCase() && (
                          <div className="mb-6 p-3 bg-zinc-900 rounded-lg border border-white/5 text-center">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Active Plan</span>
                          </div>
                        )}
                        <ul className="text-sm text-zinc-400 space-y-3 mb-10 flex-1">
                          {plan.desc.map((item, idx) => <li key={idx} className="flex items-center gap-2"><svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{item}</li>)}
                        </ul>
                        <button 
                          onClick={() => {
                            if (!user) {
                              setShowAuthOverlay(true);
                            } else {
                              setSelectedPlan(plan);
                            }
                          }} 
                          disabled={currentPlanName === plan.name.toUpperCase()} 
                          className={"mt-auto py-3 rounded-md text-sm font-medium transition-all " + (currentPlanName === plan.name.toUpperCase() ? "bg-zinc-900 text-zinc-600" : "bg-white text-black hover:bg-zinc-200")}
                        >
                          {currentPlanName === plan.name.toUpperCase() ? 'Selected' : (plan.price === "0" ? 'Select' : 'Buy Now')}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 flex justify-center">
                    <button 
                      onClick={() => setShowAboutInPlan(true)}
                      className="text-zinc-500 hover:text-white text-sm font-medium transition-all flex items-center gap-2 border-b border-zinc-800 pb-1"
                    >
                      About Us
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {selectedPlan && (
                    <div className="bg-zinc-950 border border-white/10 p-8 rounded-xl mt-10">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-bold text-white">{selectedPlan.price === "0" ? "Switch to " : "Upgrade to "}{selectedPlan.name}</h3>
                        <button onClick={() => setSelectedPlan(null)} className="text-zinc-500 hover:text-white text-sm transition-colors">Cancel</button>
                      </div>
                      {selectedPlan.price !== "0" && !selectedPlan.isTrial && (
                        <div className="bg-zinc-900 border border-white/5 p-6 rounded-lg mb-8">
                          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-4 font-bold">Payment Details</div>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-zinc-400 text-xs">Recipient Address</span>
                              <span className="text-white text-[10px] font-mono bg-black px-4 py-2 rounded border border-white/5 select-all block leading-tight text-center w-full">
                                {WALLET_ADDRESSES.SOL.slice(0, 16)}<br />
                                {WALLET_ADDRESSES.SOL.slice(16)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-zinc-400 text-xs">Amount to Send</span>
                              <span className="text-white text-sm font-bold">{(parseFloat(selectedPlan.price) / 150).toFixed(4)} SOL</span>
                            </div>
                          </div>
                          <div className="mt-6 pt-6 border-t border-white/5">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block">Verify Sender Wallet</label>
                            <input 
                              type="text" 
                              value={manualAddress || walletAddress} 
                              onChange={(e) => setManualAddress(e.target.value)}
                              placeholder="Paste your wallet address here..."
                              className="w-full bg-black border border-white/10 p-3 rounded-md text-xs text-white outline-none focus:border-zinc-500 transition-colors font-mono"
                            />
                            <div className="mt-2 text-[10px] text-zinc-600 italic">Enter the address you used to send the SOL.</div>
                          </div>
                        </div>
                      )}
                      {selectedPlan.price === "0" ? (
                        <div className="text-center p-6 bg-zinc-900 rounded-lg mb-8 text-sm text-zinc-300 border border-white/5">
                          Confirm switching to the Starter plan. Some features will be limited.
                        </div>
                      ) : selectedPlan.isTrial ? (
                        <div className="text-center p-6 bg-zinc-900 rounded-lg mb-8 text-sm text-zinc-300 border border-white/5">
                          You are eligible for a 24-hour trial of the Basic plan.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 mb-8">
                          <button 
                            onClick={submitPayment} 
                            disabled={paymentStatus !== "IDLE"} 
                            className="w-full bg-white text-black py-3 rounded-md font-medium text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                          >
                            {paymentStatus === "SUBMITTING" ? "Processing..." : "Pay"}
                          </button>
                          <button 
                            onClick={verifyManualPayment} 
                            disabled={paymentStatus !== "IDLE"} 
                            className="w-full bg-zinc-800 text-white py-3 rounded-md font-medium text-sm hover:bg-zinc-700 transition-all"
                          >
                            {paymentStatus === "SUBMITTING" ? "Verifying..." : "Verify"}
                          </button>
                        </div>
                      )}

                      {selectedPlan.price === "0" && (
                        <div className="flex flex-col gap-3 mb-8">
                          <button 
                            onClick={submitPayment} 
                            disabled={paymentStatus !== "IDLE"} 
                            className="w-full bg-white text-black py-3 rounded-md font-medium text-sm hover:bg-zinc-200 transition-all"
                          >
                            {paymentStatus === "SUBMITTING" ? "Switching..." : "Confirm Switch"}
                          </button>
                        </div>
                      )}

                      {paymentStatus === "SUBMITTED" && <div className="mt-4 text-sm text-green-400 text-center font-medium">Plan updated successfully!</div>}
                      
                      {selectedPlan.price !== "0" && !selectedPlan.isTrial && (
                        <div className="mt-6 text-[9px] text-zinc-600 text-center leading-relaxed max-w-xs mx-auto">
                          Important: Verification requires an exact match of the subscription amount and a valid sender wallet address. Incorrect payments or missing wallet information will result in verification failure.
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white">About Monastrategys</h2>
                    <button 
                      onClick={() => setShowAboutInPlan(false)}
                      className="text-zinc-500 hover:text-white text-sm transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      Back to Plans
                    </button>
                  </div>
                  
                  <div className="text-center mb-12">
                    <p className="text-zinc-500 text-sm max-w-xl mx-auto">
                      The ultimate hub for professional PineScript strategies, automated trading, and high-fidelity backtesting.
                    </p>
                  </div>

                  {/* PLATFORM OVERVIEW SECTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-zinc-400 leading-relaxed">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Professional PineScript Integration
                        </h3>
                        <p className="text-sm">
                          Monastrategys delivers high-performance PineScript code specifically engineered for TradingView. 
                          Our strategies bridge the gap between professional-grade analysis and accessible execution, 
                          providing you with the exact tools used by institutional-level traders.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          5-Step Implementation Guide
                        </h3>
                        <ol className="text-sm space-y-2 list-decimal list-inside ml-1">
                          <li>Open any asset chart on <span className="text-white">TradingView</span>.</li>
                          <li>Navigate to the <span className="text-white">Pine Editor</span> tab at the bottom.</li>
                          <li>Select <span className="text-white">Open</span> → <span className="text-white">New Strategy</span>.</li>
                          <li>Delete all existing boilerplate code in the editor.</li>
                          <li>Paste your Monastrategys code, click <span className="text-white">Save</span>, and <span className="text-white">Add to Chart</span>.</li>
                        </ol>
                        <p className="mt-3 text-xs italic">
                          Depending on the strategy you pick, your chart will display Buy/Sell signals, visual indicators, customizable sound alerts, and in many cases, integrated Stop Loss and Take Profit signals.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Pro Auto-Trading (2 Min Setup)
                        </h3>
                        <div className="space-y-4 text-sm mb-6">
                          <div>
                            <div className="text-white font-bold mb-1">Step 1 — Add to chart</div>
                            <p className="text-zinc-400">Paste into TradingView → click <span className="text-white">Add to Chart</span></p>
                          </div>
                          <div>
                            <div className="text-white font-bold mb-1">Step 2 — Create ONE alert</div>
                            <ul className="text-zinc-400 space-y-1 list-none">
                              <li className="flex items-center gap-2"><span>•</span> Click <span className="text-white">Alert</span></li>
                              <li className="flex items-center gap-2"><span>•</span> Condition: <span className="text-white">This Strategy</span></li>
                              <li className="flex items-center gap-2"><span>•</span> Enable <span className="text-white">Webhook URL</span></li>
                              <li className="flex items-center gap-2"><span>•</span> Paste your bot webhook <span className="text-zinc-500 text-xs">(from 3Commas, etc.)</span></li>
                              <li className="flex items-center gap-2"><span>•</span> <span className="text-white">Done</span></li>
                            </ul>
                          </div>
                          <div className="border-t border-white/5 pt-4">
                            <div className="text-white font-bold mb-2 flex items-center gap-2">
                              WHAT HAPPENS NOW
                            </div>
                            <ul className="text-zinc-400 space-y-1 text-xs mb-4">
                              <li className="flex items-center gap-2"><span>•</span> Strategy fires → sends JSON</li>
                              <li className="flex items-center gap-2"><span>•</span> Webhook receives it</li>
                              <li className="flex items-center gap-2"><span>•</span> Bot executes trade automatically</li>
                            </ul>
                            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-md">
                              <div className="text-green-500 font-bold text-[10px] uppercase tracking-widest mb-1">PRO FEATURE</div>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                Pro members can use our <span className="text-white">Auto Trade App</span> for 1-click execution. Look for the <span className="text-green-500">Execute Protocol</span> button on Pro strategies.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-yellow-500 font-bold bg-yellow-500/5 p-3 rounded border border-yellow-500/10">
                          <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border border-black shrink-0">
                            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </div>
                          Premium Pro strategies are marked with this Gold Plus symbol.
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          Universal Market Coverage
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-600 block mb-1">Assets</span>
                            <div className="flex flex-wrap gap-1">
                              {ASSET_CATEGORIES.map(cat => <span key={cat} className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded border border-white/5">{cat}</span>)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-600 block mb-1">Timeframes</span>
                            <div className="flex flex-wrap gap-1">
                              {TIMEFRAMES.map(tf => <span key={tf} className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded border border-white/5">{tf}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 pt-8 border-t border-white/10 flex flex-col items-center gap-4">
                    <div className="text-zinc-500 text-xs">Want to see more? Check out our project on GitHub</div>
                    <a href="https://jaykk99.github.io/" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-white text-sm font-medium hover:bg-zinc-800 transition-all flex items-center gap-3">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                      View GitHub Documentation
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STRATEGIES TAB */}
        {user && activeTab === 'strategies' && (
          <div className="absolute inset-0 bg-black p-6 flex flex-col z-20 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 mb-6 gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-white">Strategies</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setStratSearch("")} 
                    className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-all"
                  >
                    Remove Mode
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <input 
                  value={stratSearch} 
                  onChange={(e) => setStratSearch(e.target.value)} 
                  placeholder="Search strategies..." 
                  className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 transition-colors w-full md:w-64"
                />
                <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 transition-colors">
                  <option value="ALL">ALL ASSETS</option>
                  {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterTimeframe} onChange={e => setFilterTimeframe(e.target.value)} className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 transition-colors">
                  <option value="ALL">ALL TIMEFRAMES</option>
                  {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterAutoTrade} onChange={e => setFilterAutoTrade(e.target.value)} className="bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 transition-colors">
                  <option value="ALL">ALL TYPES</option>
                  <option value="AUTO">AUTO TRADE (PRO)</option>
                  <option value="MANUAL">MANUAL ONLY</option>
                </select>
                {currentPlanName === "STARTER" && (
                  <button 
                    onClick={unlockRandomStrategy}
                    className="bg-zinc-800 text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-zinc-700 transition-all border border-white/5"
                  >
                    UNLOCK RANDOM ({1 - unlockedStrats.length} LEFT)
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {strategies
                .filter(s => filterAsset === "ALL" || s.assetCategory === filterAsset)
                .filter(s => filterTimeframe === "ALL" || (s.timeframes && s.timeframes.includes(filterTimeframe)))
                .filter(s => {
                  if (filterAutoTrade === "ALL") return true;
                  if (filterAutoTrade === "AUTO") return s.isAutoTrade;
                  return !s.isAutoTrade;
                })
                .filter(s => s.title.toLowerCase().includes(stratSearch.toLowerCase()) || s.description.toLowerCase().includes(stratSearch.toLowerCase()))
                .sort((a, b) => (b.isAutoTrade ? 1 : 0) - (a.isAutoTrade ? 1 : 0))
                .map(strat => (
                <div key={strat.id} className="bg-zinc-950 border border-white/10 rounded-xl p-6 flex flex-col hover:border-zinc-600 transition-all group relative">
                  {strat.isAutoTrade && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border-2 border-black z-10" title="Pro AutoTrade Strategy">
                      <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingStrat({...strat}); }} 
                        className="p-1.5 text-zinc-500 hover:text-blue-500 transition-colors bg-black/50 rounded-full border border-white/5 hover:border-blue-500/50"
                        title="Edit Strategy"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M18.364 5.636a9 9 0 010 12.728m0 0l-1.414-1.414m1.414 1.414l1.414 1.414M12 12l1.414 1.414m-1.414-1.414L10.586 10.586" /></svg>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setStratToDelete(strat); }} 
                        className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors bg-black/50 rounded-full border border-white/5 hover:border-red-500/50"
                        title="Remove Strategy"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-500 font-medium px-2 py-1 bg-zinc-900 rounded-md inline-block">
                        {strat.assetCategory} / {strat.timeframes ? strat.timeframes.join(", ") : "N/A"}
                      </span>
                      {strat.isAutoTrade && (
                        <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">
                          Auto Trade (Pro Only)
                        </span>
                      )}
                    </div>
                    {unlockedStrats.includes(strat.id) && <span className="text-xs text-zinc-400 font-medium">Unlocked</span>}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-6 leading-tight">{strat.title}</h3>
                  <div className="flex flex-col gap-2 mt-auto">
                    <button onClick={() => unlockStrategy(strat)} className={"w-full py-2 rounded-md text-sm font-medium transition-all " + (currentPlanName === "PRO" || isAdmin || unlockedStrats.includes(strat.id) ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200")}>
                      {currentPlanName === "PRO" || isAdmin || unlockedStrats.includes(strat.id) ? "View Source" : "Unlock Strategy"}
                    </button>
                    {strat.isAutoTrade && (currentPlanName === "PRO" || isAdmin) && (
                      <div className="w-full bg-zinc-900 text-zinc-500 py-2 rounded-md text-sm font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Auto Trade Enabled
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {editingStrat && (
              <div className="fixed inset-0 bg-black/95 z-[90] flex flex-col p-6 md:p-10 overflow-hidden backdrop-blur-sm">
                <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  <div className="flex justify-between items-center border-b border-white/10 p-6 bg-zinc-900/50">
                    <h2 className="text-xl font-bold text-white">Edit Strategy</h2>
                    <button onClick={() => setEditingStrat(null)} className="text-zinc-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5">Cancel</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Title</label>
                        <input 
                          value={editingStrat.title} 
                          onChange={e => setEditingStrat({...editingStrat, title: e.target.value})}
                          className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Category</label>
                        <select 
                          value={editingStrat.assetCategory} 
                          onChange={e => setEditingStrat({...editingStrat, assetCategory: e.target.value})}
                          className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors"
                        >
                          {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                      <textarea 
                        value={editingStrat.description} 
                        onChange={e => setEditingStrat({...editingStrat, description: e.target.value})}
                        className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white h-24 outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Pine Script Code</label>
                      <textarea 
                        value={editingStrat.content} 
                        onChange={e => setEditingStrat({...editingStrat, content: e.target.value})}
                        className="w-full bg-zinc-900 border border-white/10 p-4 rounded-md font-mono text-xs text-zinc-300 h-64 outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-md border border-white/5">
                      <div>
                        <div className="text-sm font-medium text-white">Auto Trade Strategy</div>
                        <div className="text-[10px] text-zinc-500">Enable for Pro mode users</div>
                      </div>
                      <button 
                        onClick={() => setEditingStrat({...editingStrat, isAutoTrade: !editingStrat.isAutoTrade})}
                        className={"px-4 py-2 rounded-md text-xs font-bold transition-all " + (editingStrat.isAutoTrade ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400")}
                      >
                        {editingStrat.isAutoTrade ? "ON" : "OFF"}
                      </button>
                    </div>
                    <button 
                      onClick={updateStrategy} 
                      disabled={isUploading}
                      className="w-full bg-white text-black py-4 rounded-md font-bold text-sm hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {isUploading ? "Updating..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {viewingStrat && (
              <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col p-6 md:p-10 overflow-hidden backdrop-blur-sm">
                <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  <div className="flex justify-between items-center border-b border-white/10 p-6 bg-zinc-900/50">
                    <div>
                      <h2 className="text-2xl font-bold text-white leading-none">{viewingStrat.title}</h2>
                      <div className="text-sm text-zinc-500 mt-2">{viewingStrat.assetCategory} Strategy</div>
                    </div>
                    <button onClick={() => { setViewingStrat(null); setCopied(false); }} className="text-zinc-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5">Close</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 md:p-10">
                    <div className="mb-10">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Description</h3>
                      <p className="text-zinc-300 text-lg leading-relaxed font-light italic">
                        "{viewingStrat.description}"
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Pine Script Source</h3>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(viewingStrat.content);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={"flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all " + (copied ? "bg-green-600 text-white" : "bg-white text-black hover:bg-zinc-200")}
                        >
                          {copied ? (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              COPIED
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                              COPY CODE
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-black border border-white/5 rounded-lg p-6 font-mono text-sm text-zinc-400 overflow-x-auto whitespace-pre leading-relaxed">
                        {viewingStrat.content}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showProSuccessModal && (
              <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
                <div className="max-w-md w-full bg-zinc-950 border border-zinc-500/30 rounded-2xl p-10 shadow-2xl text-center animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Welcome to Pro</h3>
                  <p className="text-zinc-400 text-sm mb-10 leading-relaxed">
                    Your account has been upgraded to <span className="text-white font-bold">PRO</span>. 
                    You now have full access to our automated trading infrastructure.
                  </p>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={() => setShowProSuccessModal(false)}
                      className="w-full bg-zinc-900 text-zinc-400 py-4 rounded-xl font-medium text-sm hover:bg-zinc-800 transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {stratToDelete && (
              <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-6 backdrop-blur-sm">
                <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-xl p-8 shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
                  <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                    Are you sure you want to delete <span className="text-white font-bold">"{stratToDelete.title}"</span>? This action cannot be undone.
                  </p>
                  {errorMessage && <div className="text-red-500 text-xs font-bold mb-6 uppercase tracking-widest">{errorMessage}</div>}
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setStratToDelete(null)} 
                      disabled={isDeleting}
                      className="flex-1 bg-zinc-900 text-white py-3 rounded-md text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={deleteStrategy} 
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 text-white py-3 rounded-md text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : "Delete Strategy"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BACKTEST TAB */}
        {user && activeTab === 'backtest' && (
          <div className="absolute inset-0 bg-black p-10 flex flex-col items-center overflow-y-auto z-20">
             <div className="max-w-5xl w-full">
              <h2 className="text-3xl font-bold tracking-tight mb-8 border-b border-white/10 pb-6">Backtesting Engine</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6 bg-zinc-950 p-8 rounded-xl border border-white/10">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Select Strategy</label>
                    <select value={selectedStratId} onChange={e => setSelectedStratId(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors">
                      <option value="">Choose a strategy...</option>
                      {strategies.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <button onClick={runBacktest} disabled={isTesting || !selectedStratId} className="w-full bg-white text-black py-3 rounded-md font-medium text-sm hover:bg-zinc-200 transition-all disabled:opacity-50">
                    {isTesting ? 'Running Simulation...' : 'Run Backtest'}
                  </button>
                </div>
                <div className="lg:col-span-2 bg-zinc-950 p-8 rounded-xl border border-white/10 min-h-[400px] flex items-center justify-center relative">
                  {isTesting && <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 z-10 rounded-xl backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin mb-4"></div>
                    <div className="text-sm text-zinc-400 font-medium">Processing historical data...</div>
                  </div>}
                  {btResults ? (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {Object.entries(btResults).map(([k, v]) => (
                        <div key={k} className="p-6 bg-zinc-900 rounded-lg border border-white/5">
                          <div className="text-sm text-zinc-500 font-medium mb-2">{k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                          <div className="text-2xl font-bold text-white">{v}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-zinc-600 text-sm font-medium">Select a strategy and run a backtest to see results.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UPLOAD TAB (Admin only) */}
        {user && isAdmin && activeTab === 'upload' && (
          <div className="absolute inset-0 bg-black p-10 flex flex-col items-center z-20 overflow-y-auto">
            <div className="max-w-4xl w-full">
              <h2 className="text-3xl font-bold tracking-tight mb-8 border-b border-white/10 pb-6">Admin Dashboard</h2>
              
              <div className="mb-10 space-y-6 bg-zinc-950 p-8 rounded-xl border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  User Management
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Target User Email</label>
                    <input 
                      value={adminUserEmail} 
                      onChange={e => setAdminUserEmail(e.target.value)} 
                      className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-purple-500 transition-colors" 
                      placeholder="user@example.com" 
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button 
                      onClick={handleAdminUpgradeUser} 
                      disabled={adminUserStatus === "LOADING" || !adminUserEmail}
                      className="bg-purple-600 text-white px-8 py-3 rounded-md font-bold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {adminUserStatus === "LOADING" ? "Processing..." : "Grant PRO Access"}
                    </button>
                    <button 
                      onClick={async () => {
                        if (!isAdmin || !adminUserEmail) return;
                        setAdminUserStatus("LOADING");
                        try {
                          const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), where("email", "==", adminUserEmail.toLowerCase()));
                          const snap = await getDocs(q);
                          if (!snap.empty) {
                            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', snap.docs[0].id), { plan: "STARTER" });
                            alert(`User ${adminUserEmail} downgraded to STARTER.`);
                          }
                          setAdminUserStatus("IDLE");
                        } catch (err) {
                          console.error(err);
                          setAdminUserStatus("IDLE");
                        }
                      }} 
                      disabled={adminUserStatus === "LOADING" || !adminUserEmail}
                      className="bg-zinc-800 text-zinc-400 px-4 py-3 rounded-md font-bold text-sm hover:bg-zinc-700 transition-all disabled:opacity-50"
                    >
                      Reset to Starter
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  * Upgrading a user to PRO will grant them permanent access to all strategies and automated trading features.
                </p>
              </div>

              <div className="space-y-6 bg-zinc-950 p-8 rounded-xl border border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Strategy Title</label>
                    <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Enter title" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Category</label>
                    <select value={uploadAssetCat} onChange={e => setUploadAssetCat(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors">
                      {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">Timeframes (Multi-pick)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIMEFRAMES.map(tf => (
                      <label key={tf} className={"flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all " + (uploadTimeframes.includes(tf) ? "bg-white text-black border-white" : "bg-zinc-900 text-zinc-500 border-white/10 hover:border-zinc-500")}>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={uploadTimeframes.includes(tf)} 
                          onChange={() => {
                            if (uploadTimeframes.includes(tf)) {
                              setUploadTimeframes(uploadTimeframes.filter(t => t !== tf));
                            } else {
                              setUploadTimeframes([...uploadTimeframes, tf]);
                            }
                          }}
                        />
                        <span className="text-xs font-bold">{tf}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">Description</label>
                  <input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Brief description" />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">Pine Script Source</label>
                  <textarea value={uploadCode} onChange={e => setUploadCode(e.target.value)} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-md font-mono text-sm text-zinc-300 h-96 outline-none focus:border-zinc-500 transition-colors" placeholder="Paste Pine Script code here..." />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-md border border-white/5">
                  <div>
                    <div className="text-sm font-medium text-white">Auto Trade Strategy</div>
                    <div className="text-[10px] text-zinc-500">Pro mode users get access to autotrading strategies</div>
                  </div>
                  <button 
                    onClick={() => setUploadIsAutoTrade(!uploadIsAutoTrade)}
                    className={"px-4 py-2 rounded-md text-xs font-bold transition-all " + (uploadIsAutoTrade ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400")}
                  >
                    {uploadIsAutoTrade ? "ON" : "OFF"}
                  </button>
                </div>
                <button onClick={handleUpload} disabled={isUploading} className="bg-white text-black py-3 rounded-md font-medium text-sm w-full hover:bg-zinc-200 transition-all disabled:opacity-50">
                  {isUploading ? "Uploading..." : "Publish Strategy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-white/10 flex items-center justify-center px-4 z-[60]">
        <nav className="flex gap-1 w-full max-w-2xl">
          {[
            { id: 'chart', label: 'Chart' },
            { id: 'strategies', label: 'Strategies' },
            { id: 'backtest', label: 'Backtest' },
            { id: 'plan', label: 'Upgrade', hide: isAdmin },
            { id: 'upload', label: 'Admin', show: isAdmin }
          ].filter(n => {
            if (!user) return n.id === 'plan';
            if (isAdmin) return n.id !== 'plan';
            return (n.show === undefined || n.show) && (n.hide === undefined || !n.hide);
          }).map(nav => (
            <button key={nav.id} onClick={() => setActiveTab(nav.id)} className={"flex-1 text-sm font-medium py-3 border-t-2 transition-all " + (activeTab === nav.id ? "text-white border-white bg-white/5" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
              {nav.label}
            </button>
          ))}
        </nav>
      </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
