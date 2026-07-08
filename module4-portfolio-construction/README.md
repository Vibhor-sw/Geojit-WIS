# Geojit WIS — Module 4: Portfolio Construction & Financial Planning

Workable model prototype covering all 7 use cases (M4-UC1 to M4-UC7) from the
*Module 4 Model & Data Specification*: goal allocation, Monte Carlo simulation,
mean-variance/factor optimisation, dynamic rebalancing, tax-loss harvesting,
ESG-constrained optimisation, and the robo-advisory orchestration engine.

This is a **deployable review build**, not the production system: it runs real
implementations of the core logic/formulas described in the spec, against
illustrative sample data (see `src/data/sampleData.js`), so every use case can
be exercised end-to-end without a live vendor data licence.

## What's inside

- **Left-nav UI**: click "Module 4" in the sidebar to expand it, then pick any
  of the 7 sub-modules (M4-UC1 … M4-UC7) to open its workable model.
- Each use case screen shows: objective + functional requirements, an editable
  JSON input panel (pre-fillable with bundled sample data), a "Run Model"
  button that calls the backend, and rendered results (tables, metric cards,
  charts) matching the spec's Output Schema for that use case.
- **Backend**: a small Express server exposing one `/api/ucN/run` (POST) and
  `/api/ucN/sample` (GET) pair per use case. Each use case's model logic lives
  in its own file under `src/models/`, independently callable — mirroring the
  spec's "Module 4 is a component library" build note (UC7 orchestrates UC1 &
  UC4; UC6 reuses the UC3 optimiser core).

## Use cases

| # | Use case | Model file | API |
|---|----------|-----------|-----|
| M4-UC1 | Goal-Based Asset Allocation | `src/models/uc1GoalAllocation.js` | `/api/uc1` |
| M4-UC2 | Monte Carlo Retirement & Wealth Simulation | `src/models/uc2MonteCarlo.js` | `/api/uc2` |
| M4-UC3 | Mean-Variance & Factor Optimization | `src/models/uc3Optimizer.js` | `/api/uc3` |
| M4-UC4 | Dynamic Rebalancing Engine | `src/models/uc4Rebalancing.js` | `/api/uc4` |
| M4-UC5 | Tax-Loss Harvesting | `src/models/uc5TaxLossHarvesting.js` | `/api/uc5` |
| M4-UC6 | ESG & Mandate-Constrained Optimization | `src/models/uc6EsgOptimization.js` | `/api/uc6` |
| M4-UC7 | Robo-Advisory Engine | `src/models/uc7RoboAdvisory.js` | `/api/uc7` |

## Run it

Requires Node.js 16+.

```bash
cd module4-portfolio-construction
npm install
npm start
```

Then open **http://localhost:4000**. The port can be changed with the `PORT`
environment variable.

## Project structure

```
module4-portfolio-construction/
├── server.js                  # Express app: static frontend + API routes
├── src/
│   ├── data/sampleData.js     # Illustrative capital-market assumptions, universe, lots, etc.
│   ├── models/                # Pure functions implementing each use case's model spec
│   └── routes/                # Express routers: GET /sample, POST /run per use case
└── public/                    # Frontend: left-nav shell, per-use-case renderers, SVG charts
    ├── index.html
    ├── css/styles.css
    └── js/{app.js, usecases.js, charts.js}
```

## What's real vs. illustrative

- **Real**: the model logic — glide-path allocation & goal-seek (UC1), path-wise
  Monte Carlo simulation with safe-withdrawal-rate bisection (UC2), a
  constrained mean-variance optimiser with Ledoit-Wolf shrinkage and
  Black-Litterman blending (UC3), drift detection with cash-flow-first and
  tax-lot-aware rebalancing (UC4), loss-lot ranking with a wash-sale
  compliance gate (UC5), ESG/carbon/exclusion-constrained optimisation reusing
  the UC3 core (UC6), and end-to-end orchestration of UC1 + UC4 under a risk
  profile (UC7).
- **Illustrative**: the data feeding those models — capital-market assumptions,
  the securities universe, ESG/carbon scores, and sample client holdings/lots
  are placeholders standing in for the licensed vendor feeds named in the
  spec's Data-Source Mapping tables (Accord/Global Datafeeds, AMFI, Capitaline/
  CMIE, MSCI ESG/Sustainalytics, etc.). Swap `src/data/sampleData.js` for real
  feeds at integration time; the model/route layer is unchanged by that swap.

## Next steps for production

1. Replace `sampleData.js` with live data-vendor integrations per the spec's
   Data-Source Mapping and licensing notes.
2. Increase Monte Carlo path counts to the spec's ≥10,000 (currently tuned
   down for interactive response times in this prototype).
3. Wire in Module 9 suitability checks and persist the audit trail (currently
   in-memory / request-scoped) to durable storage with the 5-year retention
   SEBI RA regulations require.
4. Replace the JSON-editor input panel with bespoke field-level forms per use
   case for the client-facing / RM-facing UI.
