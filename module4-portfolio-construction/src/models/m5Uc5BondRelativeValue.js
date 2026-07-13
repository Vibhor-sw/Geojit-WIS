// M5-UC5 — Credit & Bond Relative-Value Ranking. Computes spread-per-unit-risk (liquidity-adjusted)
// for each bond in the Module 5 fixed-income universe, ranks within rating buckets, and flags
// deterioration-driven downgrade/migration risk. Uses the synthetic G-sec benchmark curve and bond
// analytics from bondUniverse.js — no licensed CCIL/FBIL feed in this prototype.
const { BOND_UNIVERSE, RATINGS, round2 } = require('../data/bondUniverse');

// Illustrative 1-year probability-of-default (PD) anchors by rating, consistent with the ordering
// (not the exact magnitude) of published agency default-rate tables. Adjusted by each bond's own
// creditScore jitter within its rating band.
const RATING_PD_PCT = { AAA: 0.05, AA: 0.18, A: 0.55, BBB: 1.6 };
const RATING_ANCHOR_SCORE = { AAA: 92, AA: 80, A: 66, BBB: 50 };

function findBond(id) { const b = BOND_UNIVERSE.find((x) => x.id === id); if (!b) throw new Error(`Unknown bond id: ${id}`); return b; }

function computePdLgd(bond, lgdPct) {
  const anchorPD = RATING_PD_PCT[bond.rating];
  const anchorScore = RATING_ANCHOR_SCORE[bond.rating];
  // Below-anchor credit score -> higher-than-rating-implied PD; above-anchor -> lower.
  const scoreDelta = anchorScore - bond.creditScore;
  const pdPct = Math.max(0.02, anchorPD * Math.exp(scoreDelta / 25));
  const expectedLossBps = round2(pdPct / 100 * lgdPct * 100);
  return { pdPct: round2(pdPct), lgdPct, expectedLossBps };
}

function runBondRelativeValue(payload) {
  const p = payload || {};
  const lgdPct = p.lgdPct != null ? p.lgdPct : 45;
  const liquidityWeight = p.liquidityWeight != null ? p.liquidityWeight : 0.3;

  const scored = BOND_UNIVERSE.map((bond) => {
    const { pdPct, expectedLossBps } = computePdLgd(bond, lgdPct);
    const spreadDuration = Math.max(0.5, bond.duration);
    const rawRvScore = (bond.spreadBps - expectedLossBps) / 100 / spreadDuration;
    const liquidityAdjustedRv = round2(rawRvScore * ((1 - liquidityWeight) + liquidityWeight * (bond.liquidityScore / 100)));
    return { ...bond, pdPct, expectedLossBps, rvScore: liquidityAdjustedRv };
  });

  const buckets = {};
  RATINGS.forEach((r) => { buckets[r] = scored.filter((b) => b.rating === r).sort((a, b) => b.rvScore - a.rvScore); });
  Object.values(buckets).forEach((list) => list.forEach((b, i) => { b.bucketRank = i + 1; b.bucketSize = list.length; }));

  const migrationFlags = scored.filter((b) => b.deterioratingFundamentals).map((b) => ({
    id: b.id, name: b.name, rating: b.rating,
    reason: `Fundamentals deteriorating while still rated ${b.rating} — internal credit score ${b.creditScore} vs the rating's typical anchor of ${RATING_ANCHOR_SCORE[b.rating]}.`,
    riskDirection: b.creditScore < RATING_ANCHOR_SCORE[b.rating] ? 'Downgrade risk' : 'Stable',
  }));

  const allRanked = [...scored].sort((a, b) => b.rvScore - a.rvScore);
  return {
    bonds: allRanked, buckets, migrationFlags, gsecNote: 'Spreads computed against a synthetic G-sec par curve (see M5-UC9) matched to each bond\'s tenor.',
    assumptions: { lgdPct, liquidityWeight },
  };
}

module.exports = { runBondRelativeValue };
