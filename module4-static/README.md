# Geojit WIS — Module 4: Portfolio Construction & Financial Planning (Static Build)

This is a **fully static, client-side** build of the Module 4 prototype (all 7
use cases, M4-UC1 to M4-UC7). All model logic runs in the browser — there is
no backend, no build step, and no server-side dependency. This is what makes
it deployable via drag-and-drop hosts like **Netlify Drop**
(https://app.netlify.com/drop), GitHub Pages, or any static file host.

## Deploy

**Netlify Drop**: go to https://app.netlify.com/drop and drag this entire
folder (or a zip of it) onto the page. That's it — no build command, no
config needed.

**Locally**: any static file server works, e.g.:
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open the printed URL. (Opening `index.html` directly via `file://` also
works in most browsers since there are no fetch/CORS calls.)

## How it differs from the Node/Express version

The `module4-portfolio-construction/` sibling project has the same model
logic split across `src/models/*.js` files served via an Express API. This
static build inlines that same logic into a single browser bundle,
`js/models.js`, exposed as `window.WISModels.ucN.run(input)` /
`window.WISModels.ucN.sample`. `js/app.js` calls those functions directly
instead of `fetch()`-ing a backend. `js/charts.js` and `js/usecases.js`
(the chart helpers and per-use-case result renderers) are unchanged between
the two builds.

If you need to run real numeric workloads at scale (path counts far beyond
this prototype's defaults, larger optimisation universes, etc.), prefer the
Node/Express build so the computation happens server-side.
