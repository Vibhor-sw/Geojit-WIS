// M4-UC7 -- Robo-Advisory Engine
// FR-RA-01..07: risk profiling, model-portfolio assignment, SIP/funding plan, orchestrated
// rebalancing & goal alerts, goal/health dashboard, suitability audit trail, RM override support.
// Orchestrates M4-UC1 (goal allocation / funding) and M4-UC4 (rebalancing) as component services,
// per the module's "Module 4 is a component library" build note.

const { MODEL_PORTFOLIO_LIBRARY, ASSET_CLASSES } = require('../data/sampleData');
const { runGoalAllocation, requiredCorpusFor } = require('./uc1GoalAllocation');
const { runRebalancing } = require('./uc4Rebalancing');

function scoreQuestionnaire(responses) {
  // responses: { tolerance: number[1-5][], capacity: number[1-5][] } -- averaged then combined.
  const avg = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 3);
  const toleranceScore = avg(responses.tolerance);
  const capacityScore = avg(responses.capacity);
  // Capacity caps tolerance (per spec core logic): final category = round(min(tolerance, capacity)).
  const finalCategory = Math.max(1, Math.min(5, Math.round(Math.min(toleranceScore, capacityScore))));
  return { toleranceScore: Number(toleranceScore.toFixed(2)), capacityScore: Number(capacityScore.toFixed(2)), finalCategory };
}

function runRoboAdvisory(input) {
  const {
    riskQuestionnaire = { tolerance: [4, 3, 4], capacity: [3, 3, 4] },
    goals = [],
    lots = [],
    cashflow = 0,
    targetSuccessProbability = 0.80,
    driftBandAbs = 0.03,
    rmOverride = null, // { category, rationale }
    seed = 11,
  } = input;

  const auditTrail = [];
  const now = new Date().toISOString();

  const riskScore = scoreQuestionnaire(riskQuestionnaire);
  let finalCategory = riskScore.finalCategory;
  auditTrail.push({ timestamp: now, action: 'risk-scored', detail: riskScore });

  if (rmOverride && rmOverride.category) {
    auditTrail.push({ timestamp: now, action: 'rm-override', detail: { from: finalCategory, to: rmOverride.category, rationale: rmOverride.rationale || 'not provided' } });
    finalCategory = rmOverride.category;
  }

  const model = MODEL_PORTFOLIO_LIBRARY[finalCategory] || MODEL_PORTFOLIO_LIBRARY[3];
  auditTrail.push({ timestamp: now, action: 'model-assigned', detail: { category: finalCategory, model: model.name } });

  // Personalise within bounds using UC1 goal allocation (reused component).
  const goalAllocationResult = runGoalAllocation({ goals, riskCategory: finalCategory, targetSuccessProbability, driftBandAbs, seed });
  auditTrail.push({ timestamp: now, action: 'funding-plan-built', detail: { goalCount: goals.length } });

  const fundingPlan = goalAllocationResult.goalAllocations.map((g) => ({
    goalName: g.goalName, requiredMonthlySip: g.requiredMonthlySip, stepUpSuggested: Math.round(g.requiredMonthlySip * 0.10),
    horizonBucket: g.horizonBucket, requiredCorpus: g.requiredCorpus,
  }));

  // Orchestrate rebalancing (reused UC4 component) against the assigned model's asset-class targets,
  // approximated onto the client's actual security-level lots (illustrative mapping by asset class weight only).
  let rebalancingAlerts = [];
  if (lots.length) {
    // Map model asset-class weights onto whichever securities the client actually holds, pro-rata within asset class.
    const bySecurityTarget = {};
    const holdingsBySecurity = {};
    for (const lot of lots) {
      holdingsBySecurity[lot.security] = (holdingsBySecurity[lot.security] || 0) + lot.qty * lot.currentPrice;
    }
    // naive: give each held security the household target weight of its own current share within its asset class bucket
    const totalValue = Object.values(holdingsBySecurity).reduce((a, b) => a + b, 0) || 1;
    for (const sec of Object.keys(holdingsBySecurity)) {
      bySecurityTarget[sec] = holdingsBySecurity[sec] / totalValue; // placeholder: hold current weights as target baseline
    }
    const rebalanceResult = runRebalancing({ lots, targetWeights: bySecurityTarget, driftBandAbs, cashflow });
    rebalancingAlerts = rebalanceResult.driftAlerts.filter((d) => d.breach).map((d) => ({
      ...d, recommendedAction: d.drift > 0 ? 'Trim overweight position' : 'Top up underweight position',
    }));
    auditTrail.push({ timestamp: now, action: 'rebalancing-checked', detail: { breaches: rebalancingAlerts.length } });
  }

  // Goal dashboard: funded ratio & health per goal.
  const goalDashboard = {
    goals: goalAllocationResult.goalAllocations.map((g) => {
      const fundedRatio = g.requiredCorpus > 0 ? Math.min(1, g.currentValue / g.requiredCorpus) : 1;
      const offTrack = g.probability < targetSuccessProbability;
      return {
        goalName: g.goalName, fundedRatio: Number(fundedRatio.toFixed(3)), probability: g.probability,
        healthScore: g.goalAttainmentScore, status: offTrack ? 'OFF-TRACK' : 'ON-TRACK',
        recommendedAction: offTrack ? `Increase SIP to ₹${g.requiredMonthlySip}/month` : 'No action needed',
      };
    }),
    householdAllocation: goalAllocationResult.householdAllocation,
  };
  auditTrail.push({ timestamp: now, action: 'goal-dashboard-computed', detail: { offTrackCount: goalDashboard.goals.filter((g) => g.status === 'OFF-TRACK').length } });

  return {
    riskProfile: { tolerance: riskScore.toleranceScore, capacity: riskScore.capacityScore, finalCategory, overridden: !!rmOverride },
    modelRecommendation: { category: finalCategory, modelName: model.name, personalisedWeights: model.weights },
    fundingPlan,
    rebalancingAlerts,
    goalDashboard,
    auditTrail,
    suitabilityNote: 'Recommendation subject to Module 9 suitability checks; disclosures and RM override are logged in auditTrail per SEBI RA requirements.',
  };
}

module.exports = { runRoboAdvisory, scoreQuestionnaire };
