// Module 5 macro time series for M5-UC7 (Macro & Rate Cycle Forecasting), reused by M5-UC8 (return
// forecasting), M5-UC9 (yield-curve factor forecasting) and M5-UC10 (regime detection) — mirroring
// the spec's "shared cores" build note. No licensed macro feed (RBI/MOSPI/DGFT) is wired into this
// prototype; the quarterly history below is generated deterministically so the same run always
// produces the same series.
const { hashSeed, mulberry32, round2, rngNormal } = require('./stockUniverse');

const QUARTERS = 20; // 5 years of quarterly history ending "now"
function buildSeries(seedKey, base, drift, vol, floor, ceil) {
  const rng = mulberry32(hashSeed(seedKey));
  const vals = [base];
  for (let i = 1; i < QUARTERS; i++) {
    const next = vals[i - 1] + drift + rngNormal(rng) * vol;
    vals.push(Math.max(floor, Math.min(ceil, next)));
  }
  return vals.map((v) => round2(v));
}

const gdpGrowthPct = buildSeries('gdp', 6.2, 0.03, 0.55, 2, 9.5);
const cpiPct = buildSeries('cpi', 5.4, -0.02, 0.35, 2.5, 7.5);
const iipGrowthPct = buildSeries('iip', 4.8, 0.02, 1.1, -3, 12);
const pmiIndex = buildSeries('pmi', 54, 0.05, 1.6, 44, 62);
const repoRatePct = buildSeries('repo', 6.5, -0.01, 0.12, 4.5, 8);

function quarterLabels() {
  const labels = [];
  const start = new Date('2021-10-01');
  for (let i = 0; i < QUARTERS; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i * 3, 1);
    const calMonth = d.getMonth(), calYear = d.getFullYear();
    const fiscalMonthIdx = (calMonth - 3 + 12) % 12; // April = 0
    const fiscalQuarter = Math.floor(fiscalMonthIdx / 3) + 1;
    const fiscalYear = calMonth >= 3 ? calYear + 1 : calYear; // Apr..Dec belongs to FY ending next calendar year
    labels.push(`Q${fiscalQuarter} FY${fiscalYear.toString().slice(-2)}`);
  }
  return labels;
}
const QUARTER_LABELS = quarterLabels();

// High-frequency indicators (monthly, last 12 months) — GST collections, e-way bills, auto sales,
// power demand growth, as illustrative proxies for the nowcast bridge model.
function buildMonthly(seedKey, base, drift, vol) {
  const rng = mulberry32(hashSeed(seedKey));
  const vals = [base];
  for (let i = 1; i < 12; i++) vals.push(round2(vals[i - 1] + drift + rngNormal(rng) * vol));
  return vals;
}
const HIGH_FREQ = {
  gstCollectionGrowthPct: buildMonthly('gst', 9, 0.1, 2.2),
  ewayBillGrowthPct: buildMonthly('eway', 7.5, 0.05, 2.8),
  autoSalesGrowthPct: buildMonthly('auto', 5, -0.05, 4.5),
  powerDemandGrowthPct: buildMonthly('power', 6.2, 0.03, 1.6),
};

module.exports = { QUARTERS, QUARTER_LABELS, gdpGrowthPct, cpiPct, iipGrowthPct, pmiIndex, repoRatePct, HIGH_FREQ };
