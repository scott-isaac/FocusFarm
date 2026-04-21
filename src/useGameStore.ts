import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Expanded mineral list ordered by rarity (common -> rare)
export type MineralKey = 'copper' | 'iron' | 'silver' | 'gold' | 'sapphire' | 'emerald' | 'ruby' | 'diamond' | 'mythril';
export type FishKey = 'sunfish' | 'bluegill' | 'bass' | 'trout' | 'pike' | 'golden_koi';

const MINERAL_ORDER: MineralKey[] = ['copper','iron','silver','gold','sapphire','emerald','ruby','diamond','mythril'];

// Per-mine randomized unlock depths (threshold at which mineral starts appearing)
export interface MineDefinition { id: string; unlockDepth: Record<MineralKey, number>; }

// Ranges used when generating a mine (approx increasing depth requirements)
const MINE_DEPTH_RANGES: Record<MineralKey, [number,number]> = {
  copper:[0,0],
  iron:[50,90],
  silver:[120,180],
  gold:[220,300],
  sapphire:[320,420],
  emerald:[430,550],
  ruby:[560,700],
  diamond:[720,850],
  mythril:[870,1000]
};

function generateMine(): MineDefinition {
  const unlockDepth: Record<MineralKey, number> = {} as any;
  MINERAL_ORDER.forEach(k => {
    const [a,b] = MINE_DEPTH_RANGES[k];
    unlockDepth[k] = a===b? a : Math.round(a + Math.random()*(b-a));
  });
  return { id: 'mine-'+Math.random().toString(36).slice(2), unlockDepth };
}

// Activity & upgrades kept
type Activity = 'mining' | 'fishing';

interface Upgrade { id: string; name: string; description: string; cost: Partial<Record<MineralKey, number>>; apply: (s: GameState) => void; purchased?: boolean; activity: Activity | 'global'; }

interface SessionSummary { activity: Activity; durationMinutes: number; rocksProcessed?: number; minerals?: Record<MineralKey, number>; fishCaught?: Record<FishKey, number>; attempts: number; miningDepth?: number; depthGained?: number; travelMinutes?: number; effectiveMiningMinutes?: number; potentialAttempts?: number; }

interface RatePoint { t: number; rate: number; }

interface GameState { focusActive: boolean; sessionActivity: Activity | null; sessionStart: number | null; sessionEnd: number | null; sessionDurationMinutes: number | null; rateTimeline: RatePoint[]; rocksMined: number; baseMiningRate: number; baseFishingRate: number; minerals: Record<MineralKey, number>; fish: Record<FishKey, number>; upgrades: Upgrade[]; summary: SessionSummary | null; mineDepth: number; currentMine: MineDefinition; sessionMiningDepth: number | null; travelSpeed: number; maxSessionMinutes: number; sessionTravelMinutes?: number; // Actions
  startFocus: (activity: Activity, minutes: number, depth?: number) => void; interruptFocus: () => void; completeNow: () => void; ackSummary: () => void; purchaseUpgrade: (id: string) => void; finalizeIfNeeded: () => void; }

// --- Shared probability helpers (used by both rolls and EV previews) ---

const BASE_MINERAL_WEIGHTS: Record<MineralKey, number> = { copper:40, iron:28, silver:18, gold:8, sapphire:5, emerald:4, ruby:3, diamond:2, mythril:1 };

function computeMineralDistribution(depth: number, mine: MineDefinition) {
  const weights: Array<[MineralKey, number]> = [];
  let totalWeight = 0;
  for (const k of MINERAL_ORDER) {
    const unlock = mine.unlockDepth[k];
    if (depth < unlock) continue;
    const over = Math.max(0, depth - unlock);
    const scale = 1 + over / 50; // every +50 depth ~ double weight
    const w = BASE_MINERAL_WEIGHTS[k] * scale;
    weights.push([k, w]);
    totalWeight += w;
  }
  const emptyWeight = Math.max(10, 120 - depth);
  totalWeight += emptyWeight;
  return { weights, emptyWeight, totalWeight };
}

function rollMineral(depth: number, mine: MineDefinition): MineralKey | null {
  const { weights, emptyWeight, totalWeight } = computeMineralDistribution(depth, mine);
  let r = Math.random() * totalWeight;
  if ((r -= emptyWeight) < 0) return null;
  for (const [k, w] of weights) { if ((r -= w) < 0) return k; }
  return null;
}

// Cumulative thresholds for fishing roll; single source of truth for roll + EV
const FISH_CUMULATIVE: Array<[FishKey, number]> = [
  ['golden_koi', 0.0001],
  ['pike',       0.002],
  ['trout',      0.01],
  ['bass',       0.04],
  ['bluegill',   0.15],
  ['sunfish',    0.30],
];

const rollFish = (): FishKey | null => {
  const r = Math.random();
  for (const [k, cutoff] of FISH_CUMULATIVE) if (r < cutoff) return k;
  return null;
};

// --- EV helpers exported for the session picker tooltip ---

export interface MiningEVResult { attempts: number; travelMinutes: number; effectiveMinutes: number; ev: Partial<Record<MineralKey, number>>; }

export function computeMiningEV(opts: { depth: number; mine: MineDefinition; minutes: number; baseRate: number; travelSpeed: number; }): MiningEVResult {
  const { depth, mine, minutes, baseRate, travelSpeed } = opts;
  const rawTravel = (depth * 0.02 * 2) / travelSpeed;
  const travelMinutes = Math.min(rawTravel, minutes);
  const effectiveMinutes = Math.max(0, minutes - travelMinutes);
  const attempts = Math.floor(baseRate * effectiveMinutes);
  const { weights, totalWeight } = computeMineralDistribution(depth, mine);
  const ev: Partial<Record<MineralKey, number>> = {};
  for (const [k, w] of weights) ev[k] = attempts * (w / totalWeight);
  return { attempts, travelMinutes, effectiveMinutes, ev };
}

export interface FishingEVResult { attempts: number; ev: Partial<Record<FishKey, number>>; }

export function computeFishingEV(opts: { minutes: number; baseRate: number; }): FishingEVResult {
  const attempts = Math.floor(opts.baseRate * opts.minutes);
  const ev: Partial<Record<FishKey, number>> = {};
  let prev = 0;
  for (const [k, cutoff] of FISH_CUMULATIVE) {
    ev[k] = attempts * (cutoff - prev);
    prev = cutoff;
  }
  return { attempts, ev };
}

// --- Default upgrades (rebuilt on rehydrate so `apply` functions survive) ---

const DEFAULT_UPGRADES: Upgrade[] = [
  // Mining
  { id:'pick1', activity:'mining', name:'Sharpened Pick', description:'Mining speed +50%.', cost:{ copper:10 }, apply:(s)=>{ s.baseMiningRate *= 1.5; } },
  { id:'lamp1', activity:'mining', name:'Brighter Lantern', description:'10% chance to improve mining find rarity or create copper.', cost:{ silver:5 }, apply:()=>{} },
  { id:'elevator1', activity:'mining', name:'Rope & Pulley', description:'Travel speed +50%.', cost:{ copper:30, iron:20 }, apply:(s)=>{ s.travelSpeed *= 1.5; } },
  { id:'elevator2', activity:'mining', name:'Mechanical Lift', description:'Travel speed +100%.', cost:{ iron:40, silver:10 }, apply:(s)=>{ s.travelSpeed *= 2; } },
  // Fishing
  { id:'rod1', activity:'fishing', name:'Sturdy Rod', description:'Fishing cast speed +50%.', cost:{ copper:12 }, apply:(s)=>{ s.baseFishingRate *= 1.5; } },
  { id:'lure1', activity:'fishing', name:'Lucky Lure', description:'10% chance to upgrade fish rarity or create common fish.', cost:{ silver:4 }, apply:()=>{} },
  { id:'rod2', activity:'fishing', name:'Carbon Rod', description:'+40% fishing speed (stacks).', cost:{ gold:1 }, apply:(s)=>{ s.baseFishingRate *= 1.4; } },
  // Global
  { id:'efficiency1', activity:'global', name:'Efficiency Training', description:'+10% to both mining & fishing speed.', cost:{ copper:20, silver:2 }, apply:(s)=>{ s.baseMiningRate *= 1.1; s.baseFishingRate *= 1.1; } },
  { id:'endurance1', activity:'global', name:'Stamina Training', description:'Max session length +15m.', cost:{ copper:50, iron:25 }, apply:(s)=>{ s.maxSessionMinutes += 15; } },
  { id:'endurance2', activity:'global', name:'Deep Focus Ritual', description:'Max session length +30m.', cost:{ silver:40, gold:5 }, apply:(s)=>{ s.maxSessionMinutes += 30; } },
];

const buildDefaultUpgrades = (): Upgrade[] => DEFAULT_UPGRADES.map(u => ({ ...u }));

// --- Store ---

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      focusActive: false,
      sessionActivity: null,
      sessionStart: null,
      sessionEnd: null,
      sessionDurationMinutes: null,
      rateTimeline: [],
      rocksMined: 0,
      baseMiningRate: 3,
      baseFishingRate: 2,
      minerals: { copper:0, iron:0, silver:0, gold:0, sapphire:0, emerald:0, ruby:0, diamond:0, mythril:0 },
      fish: { sunfish:0, bluegill:0, bass:0, trout:0, pike:0, golden_koi:0 },
      upgrades: buildDefaultUpgrades(),
      summary: null,
      mineDepth: 0,
      currentMine: generateMine(),
      sessionMiningDepth: null,
      travelSpeed: 1,
      maxSessionMinutes: 60,
      startFocus: (activity, minutes, depth) => set((s)=> {
        const clampedMinutes = Math.min(minutes, s.maxSessionMinutes);
        let sessionTravelMinutes: number | undefined = undefined;
        let chosenDepth: number | null = null;
        if (activity==='mining') {
          chosenDepth = depth ?? Math.floor(s.mineDepth);
          const oneWay = chosenDepth * 0.02 / s.travelSpeed;
          sessionTravelMinutes = +(oneWay*2).toFixed(2);
          if (sessionTravelMinutes > clampedMinutes) sessionTravelMinutes = clampedMinutes;
        }
        return ({
          focusActive: true,
          sessionActivity: activity,
          sessionStart: Date.now(),
          sessionEnd: Date.now() + clampedMinutes * 60000,
          sessionDurationMinutes: clampedMinutes,
          rateTimeline: [{ t: Date.now(), rate: activity==='mining'? s.baseMiningRate : s.baseFishingRate }],
          summary: null,
          sessionMiningDepth: chosenDepth,
          sessionTravelMinutes
        });
      }),
      interruptFocus: () => set(()=> ({ focusActive:false, sessionActivity:null, sessionStart:null, sessionEnd:null, sessionDurationMinutes:null, rateTimeline:[], sessionMiningDepth:null })),
      completeNow: () => { const s = get(); if (!s.focusActive) return; finalizeSession(true); },
      ackSummary: () => set({ summary: null }),
      purchaseUpgrade: (id) => { set(s => { const up = s.upgrades.find(u=>u.id===id && !u.purchased); if (!up) return s; for (const [k,v] of Object.entries(up.cost)) if (s.minerals[k as MineralKey] < (v||0)) return s; const newMinerals = { ...s.minerals }; for (const [k,v] of Object.entries(up.cost)) newMinerals[k as MineralKey]-= v||0; const beforeMining = s.baseMiningRate; const beforeFishing = s.baseFishingRate; const clone: GameState = { ...s, minerals:newMinerals, upgrades:s.upgrades.map(u=>u.id===id?{...u,purchased:true}:u) } as any; up.apply(clone); let rateTimeline = s.rateTimeline; if (s.focusActive && s.sessionActivity) { const currentRate = s.sessionActivity==='mining'? beforeMining : beforeFishing; const newRate = s.sessionActivity==='mining'? clone.baseMiningRate : clone.baseFishingRate; if (newRate !== currentRate) rateTimeline = [...rateTimeline, { t: Date.now(), rate: newRate }]; }
        return { ...clone, rateTimeline }; }); },
      finalizeIfNeeded: () => { const s = get(); if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return; if (Date.now() < s.sessionEnd) return; finalizeSession(false); }
    }),
    {
      name: 'focus-farm-v1',
      version: 1,
      partialize: (state) => ({
        minerals: state.minerals,
        fish: state.fish,
        mineDepth: state.mineDepth,
        rocksMined: state.rocksMined,
        currentMine: state.currentMine,
        baseMiningRate: state.baseMiningRate,
        baseFishingRate: state.baseFishingRate,
        travelSpeed: state.travelSpeed,
        maxSessionMinutes: state.maxSessionMinutes,
        purchasedUpgradeIds: state.upgrades.filter(u => u.purchased).map(u => u.id),
      }) as any,
      merge: (persistedAny, currentState) => {
        const persisted = (persistedAny || {}) as any;
        const purchased = new Set<string>(persisted.purchasedUpgradeIds || []);
        const upgrades = currentState.upgrades.map(u => ({ ...u, purchased: purchased.has(u.id) }));
        const { purchasedUpgradeIds: _drop, ...rest } = persisted;
        return {
          ...currentState,
          ...rest,
          upgrades,
          // Always start clean — sessions don't persist across reloads
          focusActive: false,
          sessionActivity: null,
          sessionStart: null,
          sessionEnd: null,
          sessionDurationMinutes: null,
          rateTimeline: [],
          summary: null,
          sessionMiningDepth: null,
          sessionTravelMinutes: undefined,
        };
      },
    }
  )
);

function integrateAttempts(timeline: RatePoint[], end: number): number { const points = [...timeline].sort((a,b)=>a.t-b.t); let total = 0; for (let i=0;i<points.length;i++) { const p = points[i]; const nextT = (i+1<points.length? points[i+1].t : end); const segEnd = Math.min(nextT, end); if (segEnd <= p.t) continue; total += ((segEnd - p.t)/60000) * p.rate; if (nextT > end) break; } return Math.max(0, Math.floor(total)); }

function finalizeSession(force: boolean) {
  const s = useGameStore.getState();
  if (!s.focusActive || !s.sessionStart || !s.sessionEnd || !s.sessionActivity) return;
  const plannedEnd = s.sessionEnd;
  const integrationEnd = force ? plannedEnd : Math.min(Date.now(), plannedEnd);
  const potentialAttempts = integrateAttempts(s.rateTimeline, integrationEnd);
  let summary: SessionSummary;
  if (s.sessionActivity === 'mining') {
    const travelMinutes = s.sessionTravelMinutes || 0;
    const effectiveMiningMinutes = Math.max(0, (s.sessionDurationMinutes||0) - travelMinutes);
    const fraction = (s.sessionDurationMinutes? (effectiveMiningMinutes / s.sessionDurationMinutes) : 1);
    const attempts = Math.floor(potentialAttempts * fraction);
    const mineralsGained: Record<MineralKey, number> = { copper:0, iron:0, silver:0, gold:0, sapphire:0, emerald:0, ruby:0, diamond:0, mythril:0 };
    const hasLamp = s.upgrades.some(u=>u.id==='lamp1' && u.purchased);
    const depth = s.sessionMiningDepth ?? Math.floor(s.mineDepth);
    for (let i=0;i<attempts;i++) {
      let m = rollMineral(depth, s.currentMine);
      if (hasLamp && Math.random()<0.10) { if (m === null) m = 'copper'; else { const idx = MINERAL_ORDER.indexOf(m); if (idx>=0 && idx < MINERAL_ORDER.length-1) m = MINERAL_ORDER[idx+1]; } }
      if (m) mineralsGained[m]++;
    }
    const newMinerals: Record<MineralKey, number> = { ...s.minerals } as any;
    (Object.keys(mineralsGained) as MineralKey[]).forEach(k => { newMinerals[k] = (newMinerals[k]||0)+mineralsGained[k]; });
    let depthGained = 0; let newMineDepth = s.mineDepth; const currentDeepestInt = Math.floor(s.mineDepth);
    if (currentDeepestInt === (s.sessionMiningDepth ?? 0)) { const rawGain = Math.log(1 + attempts) * 5; depthGained = Math.max(1, Math.round(rawGain)); newMineDepth = Math.min(1000, currentDeepestInt + depthGained); }
    summary = { activity:'mining', durationMinutes: s.sessionDurationMinutes||0, rocksProcessed: attempts, minerals: mineralsGained, attempts, miningDepth: depth, depthGained, travelMinutes, effectiveMiningMinutes: +effectiveMiningMinutes.toFixed(2), potentialAttempts };
    useGameStore.setState({ minerals:newMinerals, rocksMined: s.rocksMined + attempts, summary, mineDepth:newMineDepth });
  } else {
    const fishCaught: Record<FishKey, number> = { sunfish:0, bluegill:0, bass:0, trout:0, pike:0, golden_koi:0 };
    const hasLure = s.upgrades.some(u=>u.id==='lure1' && u.purchased);
    for (let i=0;i<potentialAttempts;i++) { let f = rollFish(); if (hasLure && Math.random()<0.10) { if (f === null) f = 'sunfish'; else if (f==='sunfish') f='bluegill'; else if (f==='bluegill') f='bass'; else if (f==='bass') f='trout'; else if (f==='trout') f='pike'; else if (f==='pike') f='golden_koi'; } if (f) fishCaught[f]++; }
    const newFish: Record<FishKey, number> = { ...s.fish } as any;
    (Object.keys(fishCaught) as FishKey[]).forEach(k => { newFish[k] = (newFish[k]||0)+fishCaught[k]; });
    summary = { activity:'fishing', durationMinutes: s.sessionDurationMinutes||0, fishCaught, attempts: potentialAttempts };
    useGameStore.setState({ fish:newFish, summary });
  }
  useGameStore.setState({ focusActive:false, sessionActivity:null, sessionStart:null, sessionEnd:null, sessionDurationMinutes:null, rateTimeline:[], sessionMiningDepth:null, sessionTravelMinutes: undefined });
}

if (typeof window !== 'undefined') { setInterval(()=>{ useGameStore.getState().finalizeIfNeeded(); }, 5000); }
