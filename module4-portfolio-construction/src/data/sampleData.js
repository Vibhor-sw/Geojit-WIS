// Sample / mock data for the Module 4 prototype.
// All figures are illustrative placeholders (governed capital-market assumptions,
// a small investable universe, sample holdings/lots) so every use case can be
// exercised end-to-end without a live vendor data licence. Replace with real
// feeds (Accord/Global Datafeeds, AMFI, Capitaline/CMIE, MSCI ESG, etc.) at
// integration time -- see the Data-Source Mapping tables in the spec.

const ASSET_CLASSES = ['Equity', 'Debt', 'Gold', 'Cash', 'International'];

// Capital-market assumptions: annualised expected return / volatility per asset class,
// plus a correlation matrix. "Geojit house view" placeholder, versioned for audit.
const CAPITAL_MARKET_ASSUMPTIONS = {
  version: 'CMA-2026Q3-v1',
  effectiveDate: '2026-07-01',
  assetClasses: ASSET_CLASSES,
  expectedReturn: { Equity: 0.12, Debt: 0.07, Gold: 0.08, Cash: 0.045, International: 0.10 },
  volatility: { Equity: 0.19, Debt: 0.05, Gold: 0.15, Cash: 0.01, International: 0.17 },
  correlation: [
    /*              Equity  Debt   Gold   Cash  Intl */
    /* Equity */ [1.00, -0.10, 0.05, 0.00, 0.65],
    /* Debt   */ [-0.10, 1.00, 0.10, 0.20, -0.05],
    /* Gold   */ [0.05, 0.10, 1.00, 0.05, 0.20],
    /* Cash   */ [0.00, 0.20, 0.05, 1.00, 0.00],
    /* Intl   */ [0.65, -0.05, 0.20, 0.00, 1.00],
  ],
};

// Glide-path matrix: horizon bucket -> base allocation, governed default.
const GLIDE_PATH_MATRIX = {
  short: { Equity: 0.15, Debt: 0.45, Gold: 0.10, Cash: 0.30, International: 0.00 }, // < 3y
  medium: { Equity: 0.45, Debt: 0.35, Gold: 0.10, Cash: 0.05, International: 0.05 }, // 3-7y
  long: { Equity: 0.60, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.10 }, // > 7y
};

// Risk-profile guardrails (min/max weight per asset class) by risk category 1 (conservative) - 5 (aggressive).
const RISK_GUARDRAILS = {
  1: { Equity: [0, 0.25], Debt: [0.40, 0.80], Gold: [0, 0.15], Cash: [0.05, 0.40], International: [0, 0.05] },
  2: { Equity: [0.10, 0.40], Debt: [0.30, 0.65], Gold: [0, 0.15], Cash: [0.02, 0.25], International: [0, 0.10] },
  3: { Equity: [0.25, 0.55], Debt: [0.20, 0.55], Gold: [0, 0.15], Cash: [0.02, 0.15], International: [0, 0.15] },
  4: { Equity: [0.40, 0.70], Debt: [0.10, 0.40], Gold: [0, 0.12], Cash: [0, 0.10], International: [0, 0.20] },
  5: { Equity: [0.55, 0.85], Debt: [0, 0.25], Gold: [0, 0.10], Cash: [0, 0.08], International: [0, 0.25] },
};

// A small sample investable universe (illustrative NSE-listed names + a couple of ETFs / gold / debt proxies).
// expReturn/vol are annualised; sector & factor loadings are illustrative (z-scored) placeholders standing in
// for Capitaline/CMIE fundamentals-derived factors.
const UNIVERSE = [
  { id: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', assetClass: 'Equity', expReturn: 0.14, vol: 0.24, esg: 62, carbon: 78, factors: { value: -0.2, quality: 0.8, momentum: 0.4, size: 1.2, lowvol: -0.3 } },
  { id: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', assetClass: 'Equity', expReturn: 0.13, vol: 0.20, esg: 78, carbon: 12, factors: { value: -0.5, quality: 1.4, momentum: 0.2, size: 1.1, lowvol: 0.6 } },
  { id: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.135, vol: 0.22, esg: 70, carbon: 8, factors: { value: 0.3, quality: 1.0, momentum: -0.1, size: 1.0, lowvol: 0.2 } },
  { id: 'INFY', name: 'Infosys', sector: 'IT', assetClass: 'Equity', expReturn: 0.125, vol: 0.21, esg: 80, carbon: 10, factors: { value: -0.3, quality: 1.2, momentum: 0.3, size: 0.9, lowvol: 0.5 } },
  { id: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.14, vol: 0.23, esg: 65, carbon: 9, factors: { value: 0.4, quality: 0.9, momentum: 0.5, size: 0.8, lowvol: 0.0 } },
  { id: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.10, vol: 0.16, esg: 82, carbon: 20, factors: { value: -0.8, quality: 1.5, momentum: -0.2, size: 0.7, lowvol: 1.0 } },
  { id: 'ITC', name: 'ITC Ltd', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.115, vol: 0.18, esg: 55, carbon: 35, factors: { value: 0.9, quality: 0.7, momentum: 0.1, size: 0.6, lowvol: 0.7 } },
  { id: 'LT', name: 'Larsen & Toubro', sector: 'Industrials', assetClass: 'Equity', expReturn: 0.135, vol: 0.24, esg: 60, carbon: 55, factors: { value: 0.2, quality: 0.6, momentum: 0.4, size: 0.9, lowvol: -0.4 } },
  { id: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', assetClass: 'Equity', expReturn: 0.13, vol: 0.22, esg: 58, carbon: 40, factors: { value: 0.0, quality: 0.5, momentum: 0.6, size: 0.8, lowvol: -0.2 } },
  { id: 'SUNPHARMA', name: 'Sun Pharma', sector: 'Healthcare', assetClass: 'Equity', expReturn: 0.12, vol: 0.20, esg: 68, carbon: 25, factors: { value: -0.1, quality: 0.9, momentum: 0.0, size: 0.5, lowvol: 0.3 } },
  { id: 'NIFTYBEES', name: 'Nifty 50 ETF', sector: 'Diversified', assetClass: 'Equity', expReturn: 0.12, vol: 0.17, esg: 68, carbon: 30, factors: { value: 0.0, quality: 0.8, momentum: 0.1, size: 1.0, lowvol: 0.2 } },
  { id: 'GOLDBEES', name: 'Gold ETF', sector: 'Commodity', assetClass: 'Gold', expReturn: 0.08, vol: 0.15, esg: 50, carbon: 5, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 1.5 } },
  { id: 'LIQUIDBEES', name: 'Liquid / Debt Fund', sector: 'Debt', assetClass: 'Debt', expReturn: 0.07, vol: 0.05, esg: 50, carbon: 2, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 2.0 } },
];

// Sample benchmark (Nifty-50 style) weights over a subset of the universe, for TE calcs.
const BENCHMARK_WEIGHTS = {
  RELIANCE: 0.10, TCS: 0.08, HDFCBANK: 0.11, INFY: 0.07, ICICIBANK: 0.08,
  HINDUNILVR: 0.06, ITC: 0.05, LT: 0.06, BHARTIARTL: 0.05, SUNPHARMA: 0.04,
  NIFTYBEES: 0.20, GOLDBEES: 0.05, LIQUIDBEES: 0.05,
};

// Sample client holdings with tax lots (cost basis, purchase date, quantity) for UC4/UC5.
const SAMPLE_LOTS = [
  { id: 'L1', security: 'RELIANCE', qty: 40, costBasis: 2450, purchaseDate: '2024-02-10', currentPrice: 2870 },
  { id: 'L2', security: 'TCS', qty: 25, costBasis: 4100, purchaseDate: '2023-11-05', currentPrice: 3820 },
  { id: 'L3', security: 'HDFCBANK', qty: 60, costBasis: 1620, purchaseDate: '2025-01-20', currentPrice: 1590 },
  { id: 'L4', security: 'INFY', qty: 50, costBasis: 1550, purchaseDate: '2024-08-14', currentPrice: 1690 },
  { id: 'L5', security: 'ITC', qty: 200, costBasis: 460, purchaseDate: '2025-05-02', currentPrice: 430 },
  { id: 'L6', security: 'LT', qty: 20, costBasis: 3600, purchaseDate: '2024-12-18', currentPrice: 3420 },
  { id: 'L7', security: 'NIFTYBEES', qty: 300, costBasis: 240, purchaseDate: '2023-06-01', currentPrice: 268 },
  { id: 'L8', security: 'GOLDBEES', qty: 500, costBasis: 55, purchaseDate: '2024-04-22', currentPrice: 63 },
  { id: 'L9', security: 'LIQUIDBEES', qty: 1000, costBasis: 100, purchaseDate: '2025-03-11', currentPrice: 101.8 },
];

// Sample sector/name exclusion list for ESG mandate screening.
const EXCLUSION_LIST = ['ITC']; // e.g. tobacco activity exclusion

// Sample tax rules (India-style placeholder: equity STCG/LTCG by 12m holding period).
const TAX_RULES = {
  equity: { shortTermMonths: 12, stcgRate: 0.20, ltcgRate: 0.125, ltcgExemption: 125000 },
  debt: { shortTermMonths: 24, stcgRate: 0.30, ltcgRate: 0.20 },
  washSaleWindowDays: 30,
};

// Governed model-portfolio library for the robo-advisory engine (UC7), keyed by risk category.
const MODEL_PORTFOLIO_LIBRARY = {
  1: { name: 'Capital Preservation', weights: { Equity: 0.15, Debt: 0.55, Gold: 0.10, Cash: 0.20, International: 0.00 } },
  2: { name: 'Conservative Growth', weights: { Equity: 0.30, Debt: 0.45, Gold: 0.10, Cash: 0.10, International: 0.05 } },
  3: { name: 'Balanced Growth', weights: { Equity: 0.45, Debt: 0.32, Gold: 0.10, Cash: 0.05, International: 0.08 } },
  4: { name: 'Growth', weights: { Equity: 0.58, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.12 } },
  5: { name: 'Aggressive Growth', weights: { Equity: 0.72, Debt: 0.08, Gold: 0.05, Cash: 0.00, International: 0.15 } },
};

module.exports = {
  ASSET_CLASSES, CAPITAL_MARKET_ASSUMPTIONS, GLIDE_PATH_MATRIX, RISK_GUARDRAILS,
  UNIVERSE, BENCHMARK_WEIGHTS, SAMPLE_LOTS, EXCLUSION_LIST, TAX_RULES, MODEL_PORTFOLIO_LIBRARY,
};
