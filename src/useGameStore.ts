import { create } from 'zustand';

export type MineralKey = 'copper' | 'silver' | 'gold';
export type FishKey = 'sunfish' | 'bluegill' | 'bass' | 'trout' | 'pike' | 'golden_koi';

type Activity = 'mining' | 'fishing';

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: Partial<Record<MineralKey, number>>; // paid in minerals
  apply: (s: GameState) => void;
  purchased?: boolean;
  activity: Activity | 'global';
}

interface SessionSummary {
  activity: Activity;
  durationMinutes: number;
  rocksProcessed?: number; // mining
  minerals?: Record<MineralKey, number>;
  fishCaught?: Record<FishKey, number>;
  attempts: number; // generic attempts (rocks or casts)
}

interface RatePoint { t: number; rate: number; }

interface GameState {
  focusActive: boolean;
  sessionActivity: Activity | null;
  sessionStart: number | null;
  sessionEnd: number | null;
  sessionDurationMinutes: number | null;
  rateTimeline: RatePoint[];
  // Lifetime stats
  rocksMined: number;
  baseMiningRate: number; // rocks per minute
  baseFishingRate: number; // casts per minute
  minerals: Record<MineralKey, number>;
  fish: Record<FishKey, number>;
  upgrades: Upgrade[];
  summary: SessionSummary | null;
  // Actions
  startFocus: (activity: Activity, minutes: number) => void;
  interruptFocus: () => void;
  completeNow: () => void;
  ackSummary: () => void;
  purchaseUpgrade: (id: string) => void;
  finalizeIfNeeded: () => void;
}

// Mining roll -> mineral or null
const rollMineral = (): MineralKey | null => {
  const r = Math.random();
  if (r < 0.0001) return 'gold';      // 0.01%
  if (r < 0.02) return 'silver';      // 2%
  if (r < 0.12) return 'copper';      // +10%
  return null;                        // rest empty
};

// Fishing roll -> fish or null (freshwater pond)
const rollFish = (): FishKey | null => {
  const r = Math.random();
  if (r < 0.0001) return 'golden_koi'; // 0.01%
  if (r < 0.002) return 'pike';        // 0.2%
  if (r < 0.01) return 'trout';        // 0.8%
  if (r < 0.04) return 'bass';         // 3%
  if (r < 0.15) return 'bluegill';     // 11%
  if (r < 0.30) return 'sunfish';      // 15%
  return null;                         // 70% empty
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
  minerals: { copper:0, silver:0, gold:0 },
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
  startFocus: (activity, minutes) => set((s)=> ({
    focusActive: true,
    sessionActivity: activity,
    sessionStart: Date.now(),
    sessionEnd: Date.now() + minutes * 60000,
    sessionDurationMinutes: minutes,
    rateTimeline: [{ t: Date.now(), rate: activity==='mining'? s.baseMiningRate : s.baseFishingRate }],
    summary: null
  })),
  interruptFocus: () => set(()=> ({
    focusActive: false,
    sessionActivity: null,
    sessionStart: null,
    sessionEnd: null,
    sessionDurationMinutes: null,
    rateTimeline: []
  })),
  completeNow: () => { const s = get(); if (!s.focusActive) return; finalizeSession(true); },
  ackSummary: () => set({ summary: null }),
  purchaseUpgrade: (id) => {
    set(s => {
      const up = s.upgrades.find(u=>u.id===id && !u.purchased);
      if (!up) return s;
      for (const [k,v] of Object.entries(up.cost)) if (s.minerals[k as MineralKey] < (v||0)) return s;
      const newMinerals = { ...s.minerals }; for (const [k,v] of Object.entries(up.cost)) newMinerals[k as MineralKey]-= v||0;
      const beforeMining = s.baseMiningRate; const beforeFishing = s.baseFishingRate;
      const clone: GameState = { ...s, minerals:newMinerals, upgrades:s.upgrades.map(u=>u.id===id?{...u,purchased:true}:u) } as any;
      up.apply(clone);
      let rateTimeline = s.rateTimeline;
      if (s.focusActive && s.sessionActivity) {
        const currentRate = s.sessionActivity==='mining'? beforeMining : beforeFishing;
        const newRate = s.sessionActivity==='mining'? clone.baseMiningRate : clone.baseFishingRate;
        if (newRate !== currentRate) rateTimeline = [...rateTimeline, { t: Date.now(), rate: newRate }];
      }
      return { ...clone, rateTimeline };
    });
  },
  finalizeIfNeeded: () => { const s = get(); if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return; if (Date.now() < s.sessionEnd) return; finalizeSession(false); }
}));

function integrateAttempts(timeline: RatePoint[], end: number): number {
  const points = [...timeline].sort((a,b)=>a.t-b.t);
  let total = 0;
  for (let i=0;i<points.length;i++) {
    const p = points[i];
    const nextT = (i+1<points.length? points[i+1].t : end);
    const segEnd = Math.min(nextT, end);
    if (segEnd <= p.t) continue;
    total += ((segEnd - p.t)/60000) * p.rate;
    if (nextT > end) break;
  }
  return Math.max(0, Math.floor(total));
}

function finalizeSession(force: boolean) {
  const s = useGameStore.getState();
  if (!s.focusActive || !s.sessionStart || !s.sessionEnd || !s.sessionActivity) return;
  const plannedEnd = s.sessionEnd;
  const integrationEnd = force ? plannedEnd : Math.min(Date.now(), plannedEnd);
  const attempts = integrateAttempts(s.rateTimeline, integrationEnd);

  let summary: SessionSummary;
  if (s.sessionActivity === 'mining') {
    const mineralsGained: Record<MineralKey, number> = { copper:0, silver:0, gold:0 };
    const hasLamp = s.upgrades.some(u=>u.id==='lamp1' && u.purchased);
    for (let i=0;i<attempts;i++) {
      let m = rollMineral();
      if (hasLamp && Math.random()<0.10) {
        if (m === null) m = 'copper';
        else if (m==='copper') m='silver';
        else if (m==='silver') m='gold';
      }
      if (m) mineralsGained[m]++;
    }
    const newMinerals: Record<MineralKey, number> = { ...s.minerals } as any;
    (Object.keys(mineralsGained) as MineralKey[]).forEach(k => { newMinerals[k] = (newMinerals[k]||0)+mineralsGained[k]; });
    summary = { activity:'mining', durationMinutes: s.sessionDurationMinutes||0, rocksProcessed: attempts, minerals: mineralsGained, attempts };
    useGameStore.setState({ minerals:newMinerals, rocksMined: s.rocksMined + attempts, summary });
  } else {
    const fishCaught: Record<FishKey, number> = { sunfish:0, bluegill:0, bass:0, trout:0, pike:0, golden_koi:0 };
    const hasLure = s.upgrades.some(u=>u.id==='lure1' && u.purchased);
    for (let i=0;i<attempts;i++) {
      let f = rollFish();
      if (hasLure && Math.random()<0.10) {
        if (f === null) f = 'sunfish';
        else if (f==='sunfish') f='bluegill';
        else if (f==='bluegill') f='bass';
        else if (f==='bass') f='trout';
        else if (f==='trout') f='pike';
        else if (f==='pike') f='golden_koi';
      }
      if (f) fishCaught[f]++;
    }
    const newFish: Record<FishKey, number> = { ...s.fish } as any;
    (Object.keys(fishCaught) as FishKey[]).forEach(k => { newFish[k] = (newFish[k]||0)+fishCaught[k]; });
    summary = { activity:'fishing', durationMinutes: s.sessionDurationMinutes||0, fishCaught, attempts };
    useGameStore.setState({ fish:newFish, summary });
  }

  useGameStore.setState({
    focusActive:false,
    sessionActivity:null,
    sessionStart:null,
    sessionEnd:null,
    sessionDurationMinutes:null,
    rateTimeline:[]
  });
}

if (typeof window !== 'undefined') {
  setInterval(()=>{ useGameStore.getState().finalizeIfNeeded(); }, 5000);
}
