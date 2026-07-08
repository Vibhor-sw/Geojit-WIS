// Shared numerical utilities: RNG, stats, small matrix algebra.
// Kept dependency-free (pure JS) so the whole prototype runs with only Express installed.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  return mulberry32(seed == null ? Date.now() % 2147483647 : seed);
}

// Standard normal via Box-Muller, driven by a supplied uniform RNG.
function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Draw a correlated multivariate normal vector given mean vector mu and covariance Sigma
// using a simple Cholesky decomposition.
function cholesky(Sigma) {
  const n = Sigma.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const val = Sigma[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(val, 1e-12));
      } else {
        L[i][j] = (Sigma[i][j] - sum) / (L[j][j] || 1e-12);
      }
    }
  }
  return L;
}

function mvnSample(rng, mu, Sigma, L) {
  const chol = L || cholesky(Sigma);
  const n = mu.length;
  const z = new Array(n).fill(0).map(() => randn(rng));
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = mu[i];
    for (let k = 0; k <= i; k++) s += chol[i][k] * z[k];
    out[i] = s;
  }
  return out;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length);
}

function percentile(sortedArr, p) {
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

// Standard normal CDF (Abramowitz-Stegun approximation).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

// ---- Small dense matrix algebra (n <= ~20, fine for this prototype) ----

function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
      C[i][j] = s;
    }
  return C;
}

function matVec(A, v) {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

function transpose(A) {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function addMat(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function scaleMat(A, s) {
  return A.map((row) => row.map((v) => v * s));
}

// Gauss-Jordan inversion with partial pivoting.
function invert(Ain) {
  const n = Ain.length;
  const A = Ain.map((row) => row.slice());
  const I = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-10) A[pivot][col] += 1e-8; // regularise near-singular
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [I[col], I[pivot]] = [I[pivot], I[col]];
    const pv = A[col][col];
    for (let j = 0; j < n; j++) { A[col][j] /= pv; I[col][j] /= pv; }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      for (let j = 0; j < n; j++) {
        A[r][j] -= factor * A[col][j];
        I[r][j] -= factor * I[col][j];
      }
    }
  }
  return I;
}

// Sample covariance matrix (assets in columns) from an array of historical return rows.
function sampleCovariance(returnRows) {
  const n = returnRows.length, k = returnRows[0].length;
  const means = new Array(k).fill(0);
  for (const row of returnRows) for (let j = 0; j < k; j++) means[j] += row[j] / n;
  const Sigma = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const row of returnRows) {
    for (let i = 0; i < k; i++)
      for (let j = 0; j < k; j++)
        Sigma[i][j] += (row[i] - means[i]) * (row[j] - means[j]) / (n - 1);
  }
  return Sigma;
}

// Ledoit-Wolf style shrinkage toward a diagonal (constant-correlation-free) target.
function shrinkCovariance(Sigma, delta) {
  const n = Sigma.length;
  const avgVar = mean(Sigma.map((row, i) => row[i]));
  const F = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? avgVar : 0))
  );
  return addMat(scaleMat(F, delta), scaleMat(Sigma, 1 - delta));
}

// Project a raw weight vector onto { sum(w) = 1, lb <= w <= ub } via iterative clipping.
function projectToSimplexBox(w, lb, ub) {
  let x = w.slice();
  for (let iter = 0; iter < 200; iter++) {
    x = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
    const sum = x.reduce((a, b) => a + b, 0);
    const diff = (1 - sum) / x.length;
    x = x.map((v) => v + diff);
    const clipped = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
    const err = Math.max(...clipped.map((v, i) => Math.abs(v - x[i])));
    x = clipped;
    if (err < 1e-9) break;
  }
  const sum = x.reduce((a, b) => a + b, 0) || 1;
  return x.map((v) => v / sum);
}

module.exports = {
  makeRng, randn, cholesky, mvnSample, mean, std, percentile, normCdf,
  matMul, matVec, transpose, addMat, scaleMat, invert, sampleCovariance,
  shrinkCovariance, projectToSimplexBox,
};
