// Strategy + user + payment types shared across the app.

export type PlanName = 'STARTER' | 'BASIC' | 'PRO';

export interface Strategy {
  id: string;
  title: string;
  description: string;
  assetCategory: string;
  timeframes: string[];
  content: string;
  isAutoTrade: boolean;
  author?: string;
  timestamp?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  role: 'admin' | 'user';
  plan: PlanName;
  unlockedStrats: string[];
  backtestCount: number;
  expiresAt?: unknown;
  createdAt?: unknown;
}

export interface PlanDef {
  name: 'Starter' | 'Basic' | 'Pro';
  price: string;
  desc: string[];
  isTrial?: boolean;
}

export interface BacktestStats {
  netProfit: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: number;
  equity: number[];
}

export interface BacktestRun {
  runId: string;
  strategyId: string;
  strategyTitle: string;
  ranAt: number;
  stats: BacktestStats;
}

export const PLANS: PlanDef[] = [
  { name: 'Starter', price: '0', desc: ['1 Random Strategy Unlock', 'No Backtests'] },
  {
    name: 'Basic',
    price: '9',
    desc: ['3 new strategies every month', '24H free trial', '5 Backtests per Month'],
    isTrial: true,
  },
  { name: 'Pro', price: '29', desc: ['All Strategies + AutoTrade', 'Unlimited Backtests'] },
];

export const ASSET_CATEGORIES = ['CRYPTO', 'STOCKS', 'FOREX', 'FUNDS', 'COMMODITIES', 'INDICES'];
export const TIMEFRAMES = ['1M', '5M', '15M', '30M', '1H', '4H', '1D', '1W'];

export const SOL_RECIPIENT = '4M6VH8S8H5F9Z3Y1G8M7N2B5V4C3X2Z1A0S9D8F7G6H';
