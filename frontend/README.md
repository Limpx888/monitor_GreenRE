# GoGreen frontend

React 19 · Vite 8 · Tailwind v4 · react-three-fiber · GSAP + Lenis · recharts · zustand

```powershell
npm install
npm run dev        # http://127.0.0.1:5173 (backend expected on :5000)
npm run build      # production build in dist/
```

| URL | What it is |
|---|---|
| `/` | **Home dashboard**: the 3D waterfront scene with the story sections and one live card per module. The logo on every page links here. `/welcome` redirects here. |
| `/indoor` | Indoor environment: live CO₂ / PM2.5 per floor vs. GreenRE EQ-3 (`/api/v1/dashboard/ieq-live`) |
| `/carbon` | Carbon dioxide: CO₂e, energy, cost and EEI savings (`/api/v1/sustainability/experiment`) |
| `/water/*`, `/waste/*`, `/reservations` | Water, waste and reserve management |
| `/twin` | Digital twin (3D tower, NILM, zone drill-down). Was `/` before. |
| `/design` | Living style guide: every token and component in both themes |

URL flags for `/`: `?fps` shows a frame-rate meter, and `?clean` hides the overlay UI (used to capture `public/landing-poster.jpg`).

---

## Design system

### Tokens: `src/design/tokens.css`

Raw values are CSS variables (`--gg-*`), mapped onto Tailwind utilities with `@theme inline`. The theme switches at runtime through `<html data-theme="light|dark">`, and any subtree can force a theme with `data-theme="dark"` (the landing page does this).

| Group | Utilities |
|---|---|
| Surfaces | `bg-bg` `bg-surface` `bg-surface-2` `bg-surface-3` `border-line` `border-line-strong` |
| Text | `text-fg` `text-muted` `text-subtle` |
| Actions | `bg-primary` `hover:bg-primary-hover` `text-on-brand` `bg-primary-soft` `text-primary-soft-fg` |
| Status | `text-success` `bg-success-bg` (also `warning`, `danger`, `info`) |
| Module accents | `text-energy` `text-water` `text-waste` `text-reserve` |
| Brand scale | `bg-brand-50` … `bg-brand-900` |
| Type | `text-xs` … `text-6xl` (1.25 ratio), `font-mono` + `tabular` for metrics |
| Radius / shadow | `rounded-sm/md/lg/xl`, `shadow-xs/sm/md/lg`, `shadow-ring` |
| Motion | `duration-fast/base/slow` (120/200/320 ms, 0 under reduced motion), `ease-standard/emphasized/exit` |

Every text/background pair was checked against WCAG AA (4.5:1) in both themes. Primary buttons use white on brand-700 (5.5:1) in light mode and near-black on brand-400 (9.9:1) in dark mode.

**Rule:** no raw hex colours or inline `style={{}}` for colour, spacing or type in new code. Use the tokens.

### Theme: `src/design/theme.js`

A zustand store holding `preference: 'system' | 'light' | 'dark'`, persisted to `localStorage['gg-theme']`. An inline script in `index.html` applies it before first paint, so there's no flash. `ThemeToggle` in the top bar cycles system → light → dark.

### Components: `src/ui` (import from `'../ui'`)

| Component | Notes |
|---|---|
| `Button`, `IconButton` | primary / secondary / soft / ghost / danger · sm / md / lg · `loading` · `as={Link}` |
| `Card`, `CardHeader`, `StatCard`, `ChartCard` | StatCard = KPI tile with skeleton loading state |
| `Badge`, `StatusPill` | tones: neutral, brand, success, warning, danger, info; `pulse` for live |
| `Tabs`, `NavTabs` | WAI-ARIA tabs with arrow keys · router-aware module sub-nav |
| `Modal` | native `<dialog>`: focus trap, Esc, inert background |
| `SidePanel` | non-modal slide-in panel; Esc closes it and focus returns to the opener |
| `Table` | built-in loading / empty / error states, keyboard-clickable rows |
| `Field`, `Input`, `Select`, `Textarea`, `Toggle` | labels, hints and errors wired with `aria-describedby` |
| `UploadDropzone` | drag-and-drop, click or keyboard; size validation |
| `Toaster`, `toast` | `toast.success('Saved')` from anywhere |
| `Spinner`, `Skeleton`, `LoadingState`, `EmptyState`, `ErrorState`, `DataState` | `DataState` picks the right one |
| `PageHeader` | eyebrow, title, description, meta, actions |
| `chart`, `SERIES`, `PALETTE` | shared recharts props: `<CartesianGrid {...chart.grid} />` |

Layout: `src/layouts/AppShell.jsx` provides the sticky nav, module links, theme toggle, mobile menu, skip link and page-enter transition.

---

## Landing page and 3D scene

* `src/features/landing/` contains the story sections, the GSAP ScrollTrigger + Lenis setup (`useScrollStory`) and the first-visit gate.
* `src/features/building3d/` contains a procedural model of the waterfront development, in a teal/emerald dusk palette:
  * `textures.js`: canvas-generated facades (thousands of warm windows, mullions, slabs), shopfronts and water noise
  * `Towers.jsx`: four towers with crowns and emerald LED lines, the retail podium, roof garden and annex
  * `Landscape.jsx`: curved shoreline, promenade, seawall, lamps and palms (instanced), tree canopy, layered mountains, distant skyline
  * `Sky.jsx`: gradient dome with sun glow and clouds; it's also rendered into the environment map for glass reflections
  * `Water.jsx`: blurred planar reflection with ripple distortion
  * `CameraRig.jsx`: intro fly-in, a scroll-driven spline through 5 shots, idle drift, pointer parallax, and the "enter building" move
  * `capabilities.js`: render tier `high` / `low` / `none`
* Accessibility: under `prefers-reduced-motion` there's no Lenis, no reveal or parallax animation, no camera movement, and "Enter dashboard" navigates instantly.

---

## Migration checklist

| Page | Shared components | Notes |
|---|---|---|
| `/design` style guide | ✅ | |
| `/` home dashboard | ✅ | |
| `/indoor` indoor environment | ✅ | new |
| `/carbon` carbon dioxide | ✅ | new |
| `/water/*` layout (nav, building picker, errors) | ✅ | AppShell + NavTabs |
| `/water/*` page bodies (4) | 🟡 | legacy styles in a forced-light island (`data-theme="light"`) |
| `/waste/*` layout (nav, site picker) | ✅ | AppShell + NavTabs |
| `/waste/*` page bodies (6, incl. live camera scan) | 🟡 | legacy styles in a forced-light island |
| `/reservations` | 🟡 | logo links home; own header and 231 inline styles remain |
| `/twin` digital twin | 🟡 | logo links home; Phase 4 (building interaction) + Phase 5 |
| `/zone/:id`, `/floor/:id` | ⬜ | Phase 5 |

---

## Performance report: home page (`/`, formerly `/welcome`)

Measured on the production build (`vite build` + `vite preview`), desktop viewport 1440×900, 9 Nov 2026.

| Metric | Before | After |
|---|---|---|
| Initial JS (gzip) | 554 KB (one bundle with every page) | **72 KB** app + **54 KB** landing |
| 3D chunk (gzip, lazy) | n/a | 132 KB scene + 233 KB three.js (shared) |
| Images | 1.43 MB (2048 px logo shown at 36 px) | **199 KB** (poster only; logo now 3.7 KB) |
| CSS (gzip) | 19 KB | 19 KB |
| First / Largest Contentful Paint | LCP 7.7 s | **FCP 695 ms / LCP 695 ms** |

How this was achieved:
* Route-level code splitting: every page is `React.lazy`, so three.js loads only on 3D views.
* The poster image paints immediately (`fetchpriority="high"`) and cross-fades to the live scene.
* All windows come from shared canvas textures; palms, lamps, trees and the skyline are `InstancedMesh`.
* DPR is capped at 2, and the `low` tier (phones, ≤4 cores, ≤4 GB RAM) drops AO and planar reflection.
* `PerformanceMonitor` lowers DPR and turns off effects at runtime if FPS drops.
* Textures, geometries and materials are disposed on unmount.

**FPS:** not measurable in this environment. Headless Chromium uses software WebGL (SwiftShader), where a frame takes over a second. To measure on real hardware, open `/?fps`; the meter shows a 1 s rolling average. The 60 FPS target applies to the `high` tier on a mid-range laptop with a discrete or recent integrated GPU. If it falls short, `PerformanceMonitor` degrades the scene automatically.
