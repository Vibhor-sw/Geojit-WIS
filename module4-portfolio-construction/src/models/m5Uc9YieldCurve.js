// M5-UC9 — Yield Curve & Fixed-Income Modeling. Fits a 3-factor Nelson-Siegel curve to the
// synthetic G-sec par curve, derives forwards and a simplified term premium, runs a real PCA
// (power-iteration eigen-decomposition, not a canned "level/slope/curvature" label) over a
// synthetic history of daily curve changes, and applies parallel/steepening/flattening shock
// scenarios to the Module 5 bond portfolio via duration/convexity.
const { GSEC_CURVE, GSEC_TENORS, gsecYieldAt, round2 } = require('../data/bondUniverse');
const { BOND_UNIVERSE } = require('../data/bondUniverse');
const { hashSeed, mulberry32, rngNormal } = require('../data/stockUniverse');
const { repoRatePct } = require('../data/macroSeries');

function nsBasis(tau, lambda) {
  const x = tau / lambda;
  const f1 = x > 1e-6 ? (1 - Math.exp(-x)) / x : 1;
  const f2 = f1 - Math.exp(-x);
  return [1, f1, f2];
}
// Ordinary least squares for a fixed lambda: solves the 3x3 normal-equations system by hand
// (small enough to invert directly without a linear-algebra dependency).
function fitNsForLambda(points, lambda) {
  let XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let Xty = [0, 0, 0];
  points.forEach((p) => {
    const b = nsBasis(p.tenor, lambda);
    for (let i = 0; i < 3; i++) {
      Xty[i] += b[i] * p.yield;
      for (let j = 0; j < 3; j++) XtX[i][j] += b[i] * b[j];
    }
  });
  const beta = solve3x3(XtX, Xty);
  const sse = points.reduce((acc, p) => { const b = nsBasis(p.tenor, lambda); const fitted = b[0] * beta[0] + b[1] * beta[1] + b[2] * beta[2]; return acc + (fitted - p.yield) ** 2; }, 0);
  return { beta, sse };
}
function solve3x3(A, y) {
  // Cramer's rule.
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  if (Math.abs(d) < 1e-12) return [0, 0, 0];
  const replace = (col) => A.map((row, i) => row.map((v, j) => (j === col ? y[i] : v)));
  return [det(replace(0)) / d, det(replace(1)) / d, det(replace(2)) / d];
}
function fitNelsonSiegel(points) {
  let best = null;
  for (let lambda = 0.5; lambda <= 5; lambda += 0.1) {
    const fit = fitNsForLambda(points, lambda);
    if (!best || fit.sse < best.sse) best = { ...fit, lambda };
  }
  return best;
}
function nsYield(beta, lambda, tau) { const b = nsBasis(tau, lambda); return b[0] * beta[0] + b[1] * beta[1] + b[2] * beta[2]; }

function computeForwards(fit, tenors) {
  return tenors.slice(0, -1).map((t1, i) => {
    const t2 = tenors[i + 1];
    const y1 = nsYield(fit.beta, fit.lambda, t1), y2 = nsYield(fit.beta, fit.lambda, t2);
    const fwd = (y2 * t2 - y1 * t1) / (t2 - t1);
    return { fromTenor: t1, toTenor: t2, forwardYield: round2(fwd) };
  });
}

// PCA via power iteration + deflation over a synthetic daily curve-change history, built from three
// independent, seeded shock factors (level/slope/curvature) plus idiosyncratic tenor noise — so the
// "true" factor structure is known, and the PCA below has to genuinely recover it from the
// covariance matrix rather than being handed the answer.
function buildCurveHistory(fit, tenors, days) {
  const levelRng = mulberry32(hashSeed('curve-level')), slopeRng = mulberry32(hashSeed('curve-slope')), curveRng = mulberry32(hashSeed('curve-curvature'));
  const noiseRngs = tenors.map((t) => mulberry32(hashSeed('curve-noise-' + t)));
  const changes = [];
  for (let d = 0; d < days; d++) {
    const levelShock = rngNormal(levelRng) * 0.04;
    const slopeShock = rngNormal(slopeRng) * 0.03;
    const curveShock = rngNormal(curveRng) * 0.02;
    changes.push(tenors.map((t, i) => {
      const b = nsBasis(t, fit.lambda);
      const idio = rngNormal(noiseRngs[i]) * 0.01;
      return levelShock * b[0] + slopeShock * b[1] + curveShock * b[2] + idio;
    }));
  }
  return changes;
}
function covMatrix(rows) {
  const n = rows.length, k = rows[0].length;
  const means = new Array(k).fill(0);
  rows.forEach((r) => r.forEach((v, j) => { means[j] += v / n; }));
  const cov = Array.from({ length: k }, () => new Array(k).fill(0));
  rows.forEach((r) => { for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) cov[i][j] += (r[i] - means[i]) * (r[j] - means[j]) / (n - 1); });
  return cov;
}
function matVecMul(M, v) { return M.map((row) => row.reduce((a, x, i) => a + x * v[i], 0)); }
function vecNorm(v) { return Math.sqrt(v.reduce((a, x) => a + x * x, 0)); }
function powerIteration(M, iterations) {
  let v = M.map((_, i) => (i === 0 ? 1 : 0.3));
  for (let it = 0; it < iterations; it++) { v = matVecMul(M, v); const n = vecNorm(v) || 1; v = v.map((x) => x / n); }
  const Mv = matVecMul(M, v);
  const eigenvalue = v.reduce((a, x, i) => a + x * Mv[i], 0);
  return { eigenvector: v, eigenvalue };
}
function deflate(M, eigenvalue, eigenvector) {
  const k = M.length;
  return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => M[i][j] - eigenvalue * eigenvector[i] * eigenvector[j]));
}
function topKPCA(rows, k) {
  let M = covMatrix(rows);
  const totalVariance = M.reduce((a, row, i) => a + row[i], 0);
  const components = [];
  for (let c = 0; c < k; c++) {
    const { eigenvector, eigenvalue } = powerIteration(M, 60);
    components.push({ eigenvalue: round2(eigenvalue), varianceExplainedPct: round2((eigenvalue / totalVariance) * 100), loadings: eigenvector.map((x) => round2(x)) });
    M = deflate(M, eigenvalue, eigenvector);
  }
  return { components, totalVariance: round2(totalVariance) };
}

function bondPnlForShock(bond, shockBpsAtTenor) {
  const dY = shockBpsAtTenor / 10000;
  const pnlPct = -bond.duration * dY + 0.5 * bond.convexity * dY * dY;
  return round2(pnlPct * 100);
}
function shockAtTenor(tenor, scenario) {
  if (scenario === 'parallel') return 50;
  if (scenario === 'steepening') return -20 + (tenor / 30) * 60; // short end down, long end up
  if (scenario === 'flattening') return 30 - (tenor / 30) * 60; // short end up, long end down
  return 0;
}

function runYieldCurve(payload) {
  const p = payload || {};
  const fit = fitNelsonSiegel(GSEC_CURVE);
  const fittedCurve = GSEC_TENORS.map((t) => ({ tenor: t, marketYield: gsecYieldAt(t), fittedYield: round2(nsYield(fit.beta, fit.lambda, t)) }));
  const fitErrorBps = round2((fittedCurve.reduce((a, r) => a + Math.abs(r.marketYield - r.fittedYield), 0) / fittedCurve.length) * 100);

  const forwards = computeForwards(fit, GSEC_TENORS);
  const currentRepo = repoRatePct[repoRatePct.length - 1];
  const termPremium = GSEC_TENORS.filter((t) => t >= 1).map((t) => ({ tenor: t, termPremiumPct: round2(gsecYieldAt(t) - currentRepo) }));

  const history = buildCurveHistory(fit, GSEC_TENORS, 250);
  const pca = topKPCA(history, 3);

  const scenarios = ['parallel', 'steepening', 'flattening'].map((scenario) => {
    const bondImpacts = BOND_UNIVERSE.map((b) => ({ id: b.id, name: b.name, rating: b.rating, pnlPct: bondPnlForShock(b, shockAtTenor(b.tenorYears, scenario)) }));
    const portfolioPnlPct = round2(bondImpacts.reduce((a, b) => a + b.pnlPct, 0) / bondImpacts.length);
    return { scenario, description: scenario === 'parallel' ? '+50bps parallel shift' : scenario === 'steepening' ? 'Short end -20bps, long end +40bps' : 'Short end +30bps, long end -30bps', portfolioPnlPct, bondImpacts };
  });

  const avgDuration = round2(BOND_UNIVERSE.reduce((a, b) => a + b.duration, 0) / BOND_UNIVERSE.length);
  const avgConvexity = round2(BOND_UNIVERSE.reduce((a, b) => a + b.convexity, 0) / BOND_UNIVERSE.length);

  return {
    fittedCurve, fitParams: { lambda: round2(fit.lambda), beta0_level: round2(fit.beta[0]), beta1_slope: round2(fit.beta[1]), beta2_curvature: round2(fit.beta[2]), avgFitErrorBps: fitErrorBps },
    forwards, termPremium,
    curveFactors: pca,
    scenarioImpact: scenarios,
    fiRiskAnalytics: { avgPortfolioDuration: avgDuration, avgPortfolioConvexity: avgConvexity, bondCount: BOND_UNIVERSE.length },
  };
}

module.exports = { runYieldCurve };
