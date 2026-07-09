// M3-UC8 — Platform & Administration (SDK). Cross-cutting platform substrate: token auth/RBAC
// resolution, per-user watchlists, a unified notification centre and global search — the services
// every act depends on. This prototype mocks the token/identity layer (no real OAuth2/JWT issuer
// wired in) but implements the actual RBAC entitlement resolution and search-ranking logic.
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');
const { runDiscovery } = require('./m3Act4Discovery');

const RBAC_MATRIX = {
  'Retail Investor': { features: ['marketIntel', 'sixPillar', 'screener', 'watchlist', 'search'], dataScope: 'own-portfolio-only' },
  'Research Analyst': { features: ['marketIntel', 'sixPillar', 'riskQuant', 'discovery', 'conviction', 'screener', 'watchlist', 'search'], dataScope: 'full-universe' },
  'Relationship Manager': { features: ['marketIntel', 'sixPillar', 'riskQuant', 'discovery', 'conviction', 'screener', 'personalisation', 'watchlist', 'search'], dataScope: 'assigned-clients' },
  Admin: { features: ['*'], dataScope: 'all' },
};

function mockValidateToken(token) {
  // No real JWT issuer in this prototype — accepts a role name as a stand-in "token" and resolves
  // entitlements from the RBAC matrix, which is the part FR-PL-02/03 actually specify.
  const role = RBAC_MATRIX[token] ? token : 'Retail Investor';
  return { valid: true, role, expiresInSec: 3600 };
}
function resolveEntitlements(role) {
  return RBAC_MATRIX[role] || RBAC_MATRIX['Retail Investor'];
}

// In-memory per-process watchlist store (per user id) — a production build persists this in the
// WIS platform store.
const WATCHLISTS = {};
function getWatchlist(userId) { return WATCHLISTS[userId] || []; }
function addToWatchlist(userId, stockId, alertRule) {
  if (!WATCHLISTS[userId]) WATCHLISTS[userId] = [];
  if (!WATCHLISTS[userId].find((w) => w.stockId === stockId)) WATCHLISTS[userId].push({ stockId, alertRule: alertRule || null, addedAt: new Date().toISOString() });
  return WATCHLISTS[userId];
}
function removeFromWatchlist(userId, stockId) {
  WATCHLISTS[userId] = getWatchlist(userId).filter((w) => w.stockId !== stockId);
  return WATCHLISTS[userId];
}

function unifiedNotifications() {
  const discovery = runDiscovery({});
  const highRiskEvents = discovery.eventRisk.filter((e) => e.riskLevel === 'High').slice(0, 5).map((e) => ({ source: 'Platform', type: 'Event Risk', message: `${e.name}: ${e.eventType} on ${e.date}`, severity: 'High' }));
  const module2Style = [{ source: 'Module 2 (illustrative)', type: 'Portfolio Alert', message: 'Portfolio drift exceeds 5% band on 2 holdings — see Module 4 Dynamic Rebalancing', severity: 'Medium' }];
  return [...highRiskEvents, ...module2Style];
}

function globalSearch(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const entityWeights = { instrument: 3, report: 2, theme: 1.5, idea: 1 };
  const instrumentMatches = STOCK_UNIVERSE.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)).map((s) => ({ type: 'instrument', id: s.id, label: s.name, rank: entityWeights.instrument * (s.id.toLowerCase() === q ? 2 : 1) }));
  const themeMatches = ['PLI', 'China+1', 'EV', 'Digital India'].filter((t) => t.toLowerCase().includes(q)).map((t) => ({ type: 'theme', id: t, label: t, rank: entityWeights.theme }));
  return [...instrumentMatches, ...themeMatches].sort((a, b) => b.rank - a.rank).slice(0, 10);
}

function runPlatform(payload) {
  const p = payload || {};
  const auth = mockValidateToken(p.token);
  const entitlements = resolveEntitlements(auth.role);
  const userId = p.userId || 'demo-user';
  if (p.watchlistAction === 'add') addToWatchlist(userId, p.stockId, p.alertRule);
  if (p.watchlistAction === 'remove') removeFromWatchlist(userId, p.stockId);
  return {
    authResult: { ...auth, entitlements },
    endpointCatalogue: { version: 'v1', endpoints: ['/m3/uc1/market-intelligence', '/m3/uc2/six-pillar', '/m3/uc3/risk-quant', '/m3/uc4/discovery', '/m3/uc5/conviction', '/m3/uc6/screener', '/m3/uc7/personalisation', '/m3/uc8/platform'], paginationDefault: 25 },
    watchlist: getWatchlist(userId),
    notifications: unifiedNotifications(),
    searchResults: globalSearch(p.searchQuery),
  };
}

module.exports = { runPlatform, RBAC_MATRIX };
