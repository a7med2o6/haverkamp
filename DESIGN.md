# Design System & Competitions Surface Direction

## Core Design Principles

1. **Own-World Dark Glass Aesthetic**:
   - Deep navy background surfaces (`#050912`, `#0a1424`, `#0d1f33`).
   - High contrast text (`#f4f8ff` primary, `#b8c8de` secondary).
   - Haverkamp signature blue accent (`#5eb8ff`, `#38bdf8`) & gold celebration accents (`#fbbf24`).
   - Thin glass borders (`rgba(255, 255, 255, 0.08)` to `rgba(94, 184, 255, 0.25)`).
   - Multi-lingual RTL/LTR support using `Tajawal`, `Readex Pro`, and system sans-serif font families.

2. **Branch Display First**:
   - High legibility from a distance on shared in-branch screens.
   - Distinct, large destination cards for each competition mode. Refuses to hide multiple distinct games behind a single confusing canvas stage.
   - Clean, zero-administrative public UI. All staff operational controls remain strictly behind authenticated CMS.

3. **Motion as Functional Feedback**:
   - Fast, immediate interaction feedback under 300ms using `cubic-bezier(0.23, 1, 0.32, 1)`.
   - Motion restricted strictly to `transform` and `opacity` properties to ensure smooth 60fps rendering without layout recalculation.
   - Celebration feedback (confetti/fanfare) triggered only for genuine victory moments or exceptionally precise attempts (difference ≤ 0.050s).
   - Full support for `prefers-reduced-motion` media queries. Hover styles strictly gated behind `@media (hover: hover)`.

4. **Competitions Architecture**:
   - **Typed Registry (`src/lib/competitions.ts`)**: Central single source of truth for public directory and footer links.
   - **Public Presentation (`/competitions`, `/competitions/winner-draw`, `/competitions/stop-at-10`)**: Client-side interactive experiences with browser-based cross-tab synchronization.
   - **Authenticated Management (`/dashboard/competitions/winner-draw`)**: Granular CMS control enforcing server-side authorization (`cms:read` for viewing, `cms:write` for mutations).
