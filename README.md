# Focus Farm

A minimalist focus-session idle game built with React + TypeScript (Vite). Start a timed focus session, pick an activity, and your character works in the background. Rewards are only calculated when the session ends — so there's nothing to watch, and the app doesn't compete with your real work.

**Play it:** https://scott-isaac.github.io/FocusFarm/

## Concept

Focus Farm is designed to reward *real* focus time rather than tab-watching:

- You commit to a session length up front (15–60 minutes by default).
- During the session, the app stays idle. No numbers tick up, no notifications.
- When the session ends (or you end it early), the game rolls your rewards all at once and shows a summary.
- Loot is spent on upgrades that let you go faster, deeper, or longer on future sessions.

## Current State

### Activities

Two activities are implemented; you pick one per session.

**Mining**
- Base rate: 3 rocks/min (modified by upgrades).
- Depth progression: each session at your current max depth pushes the floor a little deeper (≈ `log(1 + attempts) * 5`, min 1).
- Procedural mine: each mine randomizes the unlock depth for each mineral within a fixed range. Unknown minerals show as `???` until reached.
- Travel penalty: round-trip travel time is subtracted from the session, so deeper runs get fewer swings unless you upgrade travel speed.
- Minerals (in order): copper, iron, silver, gold, sapphire, emerald, ruby, diamond, mythril.

**Fishing**
- No depth, no travel — the whole session is casting time.
- Fish rarity table: sunfish, bluegill, bass, trout, pike, golden koi.

### Systems

- **Rate timeline.** Speed upgrades purchased mid-session only apply to the *remaining* time; attempts are an integral over the timeline.
- **Upgrade tree.** Split across mining, fishing, and global. Speed boosts, rarity bumps, travel speed, and max session length.
- **Session summary.** Shows duration, attempts, travel time (mining), depth gained (mining), and a loot breakdown.
- **Mobile-first UI.** Responsive layout, modal session picker, animated avatar with activity-specific states.

### Tech

- React 18 + TypeScript + Vite
- Zustand for state (with `persist` middleware → `localStorage`)
- Single global CSS file
- No backend — fully static. Progress (inventory, depth, upgrades, mine layout) is saved to `localStorage`; in-flight sessions are intentionally *not* persisted, so closing the tab cancels the run.

## Running Locally

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev:host         # exposed on LAN for mobile testing
npm run build            # production build into dist/
npm run preview          # serve the production build locally
```

## Deployment

Deployed to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`. The build publishes the `dist/` folder; `vite.config.ts` sets `base: '/FocusFarm/'` so asset paths resolve correctly under the repo subpath.

## Planned / Roadmap

Near-term:
- **Balancing pass.** Unlock depths, mineral weights, and upgrade costs want tuning.
- **Accessibility.** ARIA roles and keyboard nav for the session picker (reduced-motion is already respected via `prefers-reduced-motion`).
- **OG image.** Current Open Graph card falls back to title/description only; a real 1200×630 PNG would make shared links look better.

Medium-term:
- **Multiple mine slots.** Choose or reroll mines with different mineral layouts.
- **More upgrade tiers.** Higher-tier upgrades gated behind advanced minerals.
- **Cosmetic shop.** Visual-only sinks for common minerals (avatar outfits, mine skins).
- **Sound & particles.** Subtle audio cues on session end; light particle polish on the avatar.

Longer-term / speculative:
- **Prestige / rebirth loop.** Reset for permanent modifiers (new biomes, new activities).
- **More activities.** Foraging, crafting, or a farm loop to match the name.
- **Shareable summaries.** Export a session card for bragging rights.

## Project Layout

```
src/
  main.tsx              entry point
  global.css            theme + layout + animations
  useGameStore.ts       Zustand store, mine generation, roll logic
  ui/
    App.tsx
    Avatar.tsx
    FocusSession.tsx    timer + activity picker + summary modal
    InventoryPanel.tsx
    UpgradesPanel.tsx
```

## Extending

- **New activity:** extend the `Activity` union, add a roll function, wire it into the session flow and summary panel.
- **New upgrade:** push into the `upgrades` array with an `apply()` that mutates the relevant rate or limit.
- **New mineral tier:** append to `MINERAL_ORDER`, add an unlock range in `MINE_DEPTH_RANGES`, and a base weight in `rollMineral`.

## License

Prototype, no explicit license yet.
