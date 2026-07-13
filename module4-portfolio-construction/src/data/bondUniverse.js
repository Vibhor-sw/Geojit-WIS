// Module 5 fixed-income universe: a synthetic sovereign G-sec curve (benchmark) plus a spread of
// corporate bonds across rating buckets and tenors, used by M5-UC5 (Credit & Bond Relative-Value)
// and M5-UC9 (Yield Curve & Fixed-Income Modeling). No licensed bond/curve feed (CCIL/FBIL) is
// wired into this prototype — every yield, spread and rating below is generated deterministically
// from each instrument's ID via the same seeded-PRNG approach used across Module 3/4/5, so results
// are reproducible across runs, not random each time.
const { hashSeed, mulberry32, round2 } = require('./stockUniverse');

const TODAY_BONDS = new Date('2026-07-08');

// Synthetic G-sec benchmark curve (par yields by tenor in years) — the "market" curve M5-UC9 fits
// a Nelson-Siegel-Svensson model to, and the spread benchmark for M5-UC5.
const GSEC_TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30];
function buildGsecCurve() {
  // Upward-sloping base curve with a slight hump, consistent with a "normal" rate environment.
  const level = 6.6, slope = 1.1, curvature = -0.6, decay = 2.2;
  return GSEC_TENORS.map((tau) => {
    const f1 = tau > 0 ? (1 - Math.exp(-tau / decay)) / (tau / decay) : 1;
    const f2 = f1 - Math.exp(-tau / decay);
    const yld = level + slope * (-f1) + curvature * f2; // NSS-style shape (beta0+beta1*f1+beta2*f2), beta3=0
    return { tenor: tau, yield: round2(Math.max(4.5, yld)) };
  });
}
const GSEC_CURVE = buildGsecCurve();
function gsecYieldAt(tenor) {
  // Linear interpolation across the fitted par-curve points.
  if (tenor <= GSEC_CURVE[0].tenor) return GSEC_CURVE[0].yield;
  if (tenor >= GSEC_CURVE[GSEC_CURVE.length - 1].tenor) return GSEC_CURVE[GSEC_CURVE.length - 1].yield;
  for (let i = 0; i < GSEC_CURVE.length - 1; i++) {
    const a = GSEC_CURVE[i], b = GSEC_CURVE[i + 1];
    if (tenor >= a.tenor && tenor <= b.tenor) {
      const w = (tenor - a.tenor) / (b.tenor - a.tenor);
      return round2(a.yield + w * (b.yield - a.yield));
    }
  }
  return GSEC_CURVE[GSEC_CURVE.length - 1].yield;
}

const RATING_SPREAD_BPS = { AAA: 45, AA: 90, A: 160, BBB: 280 };
const RATINGS = ['AAA', 'AA', 'A', 'BBB'];
const ISSUER_NAMES = [
  { name: 'NHAI Infra Bonds 2031', sector: 'Infrastructure', rating: 'AAA' },
  { name: 'REC Ltd NCD 2029', sector: 'Financial Services', rating: 'AAA' },
  { name: 'HDFC Bank Perpetual Bond', sector: 'Financial Services', rating: 'AAA' },
  { name: 'Power Finance Corp NCD 2028', sector: 'Financial Services', rating: 'AA' },
  { name: 'Tata Capital NCD 2030', sector: 'Financial Services', rating: 'AA' },
  { name: 'L&T Finance NCD 2027', sector: 'Financial Services', rating: 'AA' },
  { name: 'Shriram Finance NCD 2026', sector: 'Financial Services', rating: 'A' },
  { name: 'Piramal Capital NCD 2028', sector: 'Financial Services', rating: 'A' },
  { name: 'JSW Steel NCD 2029', sector: 'Metals & Mining', rating: 'A' },
  { name: 'Vedanta Resources NCD 2027', sector: 'Metals & Mining', rating: 'BBB' },
  { name: 'Adani Ports NCD 2030', sector: 'Services', rating: 'AA' },
  { name: 'Muthoot Finance NCD 2026', sector: 'Financial Services', rating: 'A' },
  { name: 'Indiabulls Housing NCD 2027', sector: 'Financial Services', rating: 'BBB' },
  { name: 'Bajaj Finance NCD 2029', sector: 'Financial Services', rating: 'AAA' },
  { name: 'Tata Motors NCD 2028', sector: 'Automobile and Auto Components', rating: 'AA' },
  { name: 'Godrej Properties NCD 2027', sector: 'Consumer Durables', rating: 'A' },
  { name: 'IRFC Bond 2032', sector: 'Services', rating: 'AAA' },
  { name: 'Manappuram Finance NCD 2026', sector: 'Financial Services', rating: 'A' },
  { name: 'Aditya Birla Finance NCD 2029', sector: 'Financial Services', rating: 'AA' },
  { name: 'GMR Airports NCD 2028', sector: 'Services', rating: 'BBB' },
];

function buildBond(issuer, idx) {
  const isin = `INF-BOND-${idx.toString().padStart(3, '0')}`;
  const rng = mulberry32(hashSeed(isin + issuer.name));
  const tenor = round2(2 + rng() * 8); // 2-10yr
  const benchmarkYield = gsecYieldAt(tenor);
  const ratingSpreadBase = RATING_SPREAD_BPS[issuer.rating];
  const idiosyncraticSpread = Math.round(ratingSpreadBase * (0.75 + rng() * 0.5));
  const ytm = round2(benchmarkYield + idiosyncraticSpread / 100);
  const coupon = round2(ytm - 0.15 + rng() * 0.3);
  const price = round2(100 - (ytm - coupon) * tenor * 0.9); // rough clean-price proxy from yield/coupon gap
  const duration = round2(tenor * (1 - ytm / 100 * 0.35)); // modified duration proxy, shortens with higher yield
  const convexity = round2(duration * duration * 0.012);
  const couponAccrual = round2(coupon);
  const rollDown = round2((gsecYieldAt(tenor) - gsecYieldAt(Math.max(0.25, tenor - 1))) * duration * -1);
  const carryPlusRoll = round2(couponAccrual + rollDown);
  // Internal credit score (0-100) from rating anchor plus fundamental jitter (leverage/coverage proxy).
  const ratingAnchor = { AAA: 92, AA: 80, A: 66, BBB: 50 }[issuer.rating];
  const leverageJitter = round2((rng() - 0.5) * 14);
  const creditScore = Math.max(20, Math.min(99, round2(ratingAnchor + leverageJitter)));
  const avgVolume = Math.round(500000 + rng() * 4000000 * (issuer.rating === 'AAA' ? 2 : issuer.rating === 'AA' ? 1.3 : 0.6));
  const bidAskBps = round2(3 + (issuer.rating === 'AAA' ? 2 : issuer.rating === 'AA' ? 5 : issuer.rating === 'A' ? 10 : 18) * (0.7 + rng() * 0.6));
  const liquidityScore = Math.max(10, Math.min(100, Math.round(100 - bidAskBps * 2.2 + Math.min(20, avgVolume / 300000))));
  const deteriorating = rng() < 0.18;
  return {
    id: `BOND${idx}`, isin, name: issuer.name, sector: issuer.sector, rating: issuer.rating,
    tenorYears: tenor, maturityDate: new Date(TODAY_BONDS.getTime() + tenor * 365 * 86400000).toISOString().slice(0, 10),
    coupon, price, ytm, benchmarkYield, spreadBps: Math.round((ytm - benchmarkYield) * 100),
    duration, convexity, carryPlusRoll, creditScore, avgVolume, bidAskBps, liquidityScore,
    deterioratingFundamentals: deteriorating,
  };
}

const BOND_UNIVERSE = ISSUER_NAMES.map((issuer, i) => buildBond(issuer, i + 1));

module.exports = { BOND_UNIVERSE, GSEC_CURVE, GSEC_TENORS, gsecYieldAt, RATINGS, RATING_SPREAD_BPS, round2 };
