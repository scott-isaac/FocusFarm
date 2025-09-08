import { create } from 'zustand';

// Expanded mineral list ordered by rarity (common -> rare)
export type MineralKey = 'copper' | 'iron' | 'silver' | 'gold' | 'sapphire' | 'emerald' | 'ruby' | 'diamond' | 'mythril';
export type FishKey = 'sunfish' | 'bluegill' | 'bass' | 'trout' | 'pike' | 'golden_koi';

const MINERAL_ORDER: MineralKey[] = ['copper','iron','silver','gold','sapphire','emerald','ruby','diamond','mythril'];

// Per-mine randomized unlock depths (threshold at which mineral starts appearing)
interface MineDefinition { id: string; unlockDepth: Record<MineralKey, number>; }

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

interface SessionSummary { activity: Activity; durationMinutes: number; rocksProcessed?: number; minerals?: Record<MineralKey, number>; fishCaught?: Record<FishKey, number>; attempts: number; miningDepth?: number; depthGained?: number; }

interface RatePoint { t: number; rate: number; }

interface GameState { focusActive: boolean; sessionActivity: Activity | null; sessionStart: number | null; sessionEnd: number | null; sessionDurationMinutes: number | null; rateTimeline: RatePoint[]; rocksMined: number; baseMiningRate: number; baseFishingRate: number; minerals: Record<MineralKey, number>; fish: Record<FishKey, number>; upgrades: Upgrade[]; summary: SessionSummary | null; // Mine state
  mineDepth: number; // current deepest achieved (can be fractional)
  currentMine: MineDefinition; sessionMiningDepth: number | null; // chosen depth for current mining session (integer)
  // Actions
  startFocus: (activity: Activity, minutes: number, depth?: number) => void; interruptFocus: () => void; completeNow: () => void; ackSummary: () => void; purchaseUpgrade: (id: string) => void; finalizeIfNeeded: () => void; }

// Depth-weighted mineral roll
function rollMineral(depth: number, mine: MineDefinition, hasLamp: boolean): MineralKey | null {
  // Weight definitions base when first unlocked
  const baseWeights: Record<MineralKey, number> = { copper:40, iron:28, silver:18, gold:8, sapphire:5, emerald:4, ruby:3, diamond:2, mythril:1 };
  let totalWeight = 0;
  const weights: [MineralKey, number][] = [];
  MINERAL_ORDER.forEach(k => {
    const unlock = mine.unlockDepth[k];
    if (depth < unlock) return; // not yet available
    // scale with depth beyond unlock (diminishing)
    const over = Math.max(0, depth - unlock);
    const scale = 1 + over / 50; // every +50 depth ~ double weight
    const w = baseWeights[k] * scale;
    weights.push([k, w]);
    totalWeight += w;
  });
  // Add empty weight so not every rock yields something; empty shrinks slowly with depth
  const emptyWeight = Math.max(10, 120 - depth); // deeper -> fewer empties
  totalWeight += emptyWeight;
  let r = Math.random() * totalWeight;
  // empty branch first
  if ((r -= emptyWeight) < 0) return null;
  for (const [k,w] of weights) { if ((r -= w) < 0) { return k; } }
  return null;
}

// Fishing roll remains unchanged
const rollFish = (): FishKey | null => {
  const r = Math.random();
  if (r < 0.0001) return 'golden_koi';
  if (r < 0.002) return 'pike';
  if (r < 0.01) return 'trout';
  if (r < 0.04) return 'bass';
  if (r < 0.15) return 'bluegill';
  if (r < 0.30) return 'sunfish';
  return null;
};

export const useGameStore = create<GameState>((set, get) => ({
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
  upgrades: [
    // Mining Upgrades
    { id:'pick1', activity:'mining', name:'Sharpened Pick', description:'Mining speed +50%.', cost:{ copper:10 }, apply: (s)=>{ s.baseMiningRate *= 1.5; } },
    { id:'lamp1', activity:'mining', name:'Brighter Lantern', description:'10% chance to improve mining find rarity or create copper.', cost:{ silver:5 }, apply: ()=>{} },
    // Fishing Upgrades
    { id:'rod1', activity:'fishing', name:'Sturdy Rod', description:'Fishing cast speed +50%.', cost:{ copper:12 }, apply:(s)=>{ s.baseFishingRate *= 1.5; } },
    { id:'lure1', activity:'fishing', name:'Lucky Lure', description:'10% chance to upgrade fish rarity or create common fish.', cost:{ silver:4 }, apply:()=>{} },
    { id:'rod2', activity:'fishing', name:'Carbon Rod', description:'+40% fishing speed (stacks).', cost:{ gold:1 }, apply:(s)=>{ s.baseFishingRate *= 1.4; } },
    // Global
    { id:'efficiency1', activity:'global', name:'Efficiency Training', description:'+10% to both mining & fishing speed.', cost:{ copper:20, silver:2 }, apply:(s)=>{ s.baseMiningRate *= 1.1; s.baseFishingRate *= 1.1; } }
  ],
  summary: null,
  // Mine state
  mineDepth: 0,
  currentMine: generateMine(),
  sessionMiningDepth: null,
  startFocus: (activity, minutes, depth) => set((s)=> ({
    focusActive: true,
    sessionActivity: activity,
    sessionStart: Date.now(),
    sessionEnd: Date.now() + minutes * 60000,
    sessionDurationMinutes: minutes,
    rateTimeline: [{ t: Date.now(), rate: activity==='mining'? s.baseMiningRate : s.baseFishingRate }],
    summary: null,
    sessionMiningDepth: activity==='mining'? (depth ?? Math.floor(s.mineDepth)) : null
  })),
  interruptFocus: () => set(()=> ({ focusActive:false, sessionActivity:null, sessionStart:null, sessionEnd:null, sessionDurationMinutes:null, rateTimeline:[], sessionMiningDepth:null })),
  completeNow: () => { const s = get(); if (!s.focusActive) return; finalizeSession(true); },
  ackSummary: () => set({ summary: null }),
  purchaseUpgrade: (id) => { set(s => { const up = s.upgrades.find(u=>u.id===id && !u.purchased); if (!up) return s; for (const [k,v] of Object.entries(up.cost)) if (s.minerals[k as MineralKey] < (v||0)) return s; const newMinerals = { ...s.minerals }; for (const [k,v] of Object.entries(up.cost)) newMinerals[k as MineralKey]-= v||0; const beforeMining = s.baseMiningRate; const beforeFishing = s.baseFishingRate; const clone: GameState = { ...s, minerals:newMinerals, upgrades:s.upgrades.map(u=>u.id===id?{...u,purchased:true}:u) } as any; up.apply(clone); let rateTimeline = s.rateTimeline; if (s.focusActive && s.sessionActivity) { const currentRate = s.sessionActivity==='mining'? beforeMining : beforeFishing; const newRate = s.sessionActivity==='mining'? clone.baseMiningRate : clone.baseFishingRate; if (newRate !== currentRate) rateTimeline = [...rateTimeline, { t: Date.now(), rate: newRate }]; } return { ...clone, rateTimeline }; }); },
  finalizeIfNeeded: () => { const s = get(); if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return; if (Date.now() < s.sessionEnd) return; finalizeSession(false); }
}));

function integrateAttempts(timeline: RatePoint[], end: number): number { const points = [...timeline].sort((a,b)=>a.t-b.t); let total = 0; for (let i=0;i<points.length;i++) { const p = points[i]; const nextT = (i+1<points.length? points[i+1].t : end); const segEnd = Math.min(nextT, end); if (segEnd <= p.t) continue; total += ((segEnd - p.t)/60000) * p.rate; if (nextT > end) break; } return Math.max(0, Math.floor(total)); }

function finalizeSession(force: boolean) {
  const s = useGameStore.getState();
  if (!s.focusActive || !s.sessionStart || !s.sessionEnd || !s.sessionActivity) return;
  const plannedEnd = s.sessionEnd;
  const integrationEnd = force ? plannedEnd : Math.min(Date.now(), plannedEnd);
  const attempts = integrateAttempts(s.rateTimeline, integrationEnd);
  let summary: SessionSummary;
  if (s.sessionActivity === 'mining') {
    const mineralsGained: Record<MineralKey, number> = { copper:0, iron:0, silver:0, gold:0, sapphire:0, emerald:0, ruby:0, diamond:0, mythril:0 };
    const hasLamp = s.upgrades.some(u=>u.id==='lamp1' && u.purchased);
    const depth = s.sessionMiningDepth ?? Math.floor(s.mineDepth);
    for (let i=0;i<attempts;i++) {
      let m = rollMineral(depth, s.currentMine, hasLamp);
      if (hasLamp && Math.random()<0.10) {
        if (m === null) m = 'copper'; else { const idx = MINERAL_ORDER.indexOf(m); if (idx>=0 && idx < MINERAL_ORDER.length-1) m = MINERAL_ORDER[idx+1]; }
      }
      if (m) mineralsGained[m]++;
    }
    const newMinerals: Record<MineralKey, number> = { ...s.minerals } as any;
    (Object.keys(mineralsGained) as MineralKey[]).forEach(k => { newMinerals[k] = (newMinerals[k]||0)+mineralsGained[k]; });
    // Depth increase only if mining at current deepest integer level
    let depthGained = 0; let newMineDepth = s.mineDepth;
    const currentDeepestInt = Math.floor(s.mineDepth);
    if (currentDeepestInt === (s.sessionMiningDepth ?? 0)) {
      // Faster early progression: logarithmic but scaled, ensuring at least 1 meter
      const rawGain = Math.log(1 + attempts) * 5; // scales with attempts; 60 attempts ~ 20 gain
      depthGained = Math.max(1, Math.round(rawGain));
      newMineDepth = Math.min(1000, currentDeepestInt + depthGained); // cap for now
    }
    summary = { activity:'mining', durationMinutes: s.sessionDurationMinutes||0, rocksProcessed: attempts, minerals: mineralsGained, attempts, miningDepth: depth, depthGained };
    useGameStore.setState({ minerals:newMinerals, rocksMined: s.rocksMined + attempts, summary, mineDepth:newMineDepth });
  } else {
    const fishCaught: Record<FishKey, number> = { sunfish:0, bluegill:0, bass:0, trout:0, pike:0, golden_koi:0 };
    const hasLure = s.upgrades.some(u=>u.id==='lure1' && u.purchased);
    for (let i=0;i<attempts;i++) { let f = rollFish(); if (hasLure && Math.random()<0.10) { if (f === null) f = 'sunfish'; else if (f==='sunfish') f='bluegill'; else if (f==='bluegill') f='bass'; else if (f==='bass') f='trout'; else if (f==='trout') f='pike'; else if (f==='pike') f='golden_koi'; } if (f) fishCaught[f]++; }
    const newFish: Record<FishKey, number> = { ...s.fish } as any;
    (Object.keys(fishCaught) as FishKey[]).forEach(k => { newFish[k] = (newFish[k]||0)+fishCaught[k]; });
    summary = { activity:'fishing', durationMinutes: s.sessionDurationMinutes||0, fishCaught, attempts };
    useGameStore.setState({ fish:newFish, summary });
  }
  useGameStore.setState({ focusActive:false, sessionActivity:null, sessionStart:null, sessionEnd:null, sessionDurationMinutes:null, rateTimeline:[], sessionMiningDepth:null });
}

if (typeof window !== 'undefined') { setInterval(()=>{ useGameStore.getState().finalizeIfNeeded(); }, 5000); }
