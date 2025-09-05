import { create } from 'zustand';

export type MineralKey = 'copper' | 'silver' | 'gold';

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: Partial<Record<MineralKey, number>>;
  apply: (s: GameState) => void;
  purchased?: boolean;
}

interface SessionSummary {
  minerals: Record<MineralKey, number>;
  rocksProcessed: number; // total rocks processed this session
  durationMinutes: number;
}

interface RatePoint { t: number; rate: number; }

interface GameState {
  focusActive: boolean;
  sessionStart: number | null;
  sessionEnd: number | null;
  sessionDurationMinutes: number | null;
  rateTimeline: RatePoint[];
  rocksMined: number; // lifetime rocks processed
  baseRate: number; // rocks per minute
  minerals: Record<MineralKey, number>; // lifetime minerals
  upgrades: Upgrade[];
  summary: SessionSummary | null;
  startFocus: (minutes: number) => void;
  interruptFocus: () => void;
  completeNow: () => void;
  ackSummary: () => void;
  purchaseUpgrade: (id: string) => void;
  finalizeIfNeeded: () => void;
}

// Returns a mineral or null (nothing found in that rock)
const rollMineral = (): MineralKey | null => {
  const r = Math.random();
  if (r < 0.0001) return 'gold';      // 0.01%
  if (r < 0.02) return 'silver';      // 2%
  if (r < 0.12) return 'copper';      // next 10%
  return null;                        // remaining 88% empty
};

export const useGameStore = create<GameState>((set, get) => ({
  focusActive: false,
  sessionStart: null,
  sessionEnd: null,
  sessionDurationMinutes: null,
  rateTimeline: [],
  rocksMined: 0,
  baseRate: 3,
  minerals: { copper:0, silver:0, gold:0 },
  upgrades: [
    {
      id:'pick1',
      name:'Sharpened Pick',
      description:'Increase mining speed by 50%.',
      cost:{ copper:10 },
      apply: (s) => { s.baseRate *= 1.5; }
    },
    {
      id:'lamp1',
      name:'Brighter Lantern',
      description:'10% chance to bump a find up one rarity tier (or create copper from empty).',
      cost:{ silver:5 },
      apply: () => { /* handled in finalize */ }
    }
  ],
  summary: null,
  startFocus: (minutes) => set((s) => ({
    focusActive: true,
    sessionStart: Date.now(),
    sessionEnd: Date.now() + minutes * 60000,
    sessionDurationMinutes: minutes,
    rateTimeline: [{ t: Date.now(), rate: s.baseRate }],
    summary: null
  })),
  interruptFocus: () => set(() => ({
    focusActive: false,
    sessionStart: null,
    sessionEnd: null,
    sessionDurationMinutes: null,
    rateTimeline: []
  })),
  completeNow: () => {
    const s = get();
    if (!s.focusActive) return;
    finalizeSession(true);
  },
  ackSummary: () => set({ summary: null }),
  purchaseUpgrade: (id) => {
    set(s => {
      const up = s.upgrades.find(u=>u.id===id && !u.purchased);
      if (!up) return s;
      for (const [k,v] of Object.entries(up.cost)) {
        if (s.minerals[k as MineralKey] < (v||0)) return s;
      }
      const newMinerals = { ...s.minerals };
      for (const [k,v] of Object.entries(up.cost)) newMinerals[k as MineralKey] -= v||0;
      const beforeRate = s.baseRate;
      const clone: GameState = { ...s,
        minerals: newMinerals,
        upgrades: s.upgrades.map(u=>u.id===id?{...u,purchased:true}:u)
      };
      up.apply(clone);
      let rateTimeline = s.rateTimeline;
      if (s.focusActive && s.sessionStart && clone.baseRate !== beforeRate) {
        rateTimeline = [...rateTimeline, { t: Date.now(), rate: clone.baseRate }];
      }
      return { ...clone, rateTimeline };
    });
  },
  finalizeIfNeeded: () => {
    const s = get();
    if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return;
    const now = Date.now();
    if (now < s.sessionEnd) return;
    finalizeSession(false);
  }
}));

function finalizeSession(force: boolean) {
  const s = useGameStore.getState();
  if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return;
  const plannedEnd = s.sessionEnd;
  const effectiveEnd = force ? plannedEnd : Math.min(Date.now(), plannedEnd);
  const integrationEnd = force ? plannedEnd : effectiveEnd;

  const points = [...s.rateTimeline].sort((a,b)=>a.t-b.t);
  let totalRocksFloat = 0;
  for (let i=0;i<points.length;i++) {
    const p = points[i];
    const nextT = (i+1<points.length ? points[i+1].t : integrationEnd);
    const segEnd = Math.min(nextT, integrationEnd);
    if (segEnd <= p.t) continue;
    totalRocksFloat += ((segEnd - p.t)/60000) * p.rate;
    if (nextT > integrationEnd) break;
  }
  const rocksWhole = Math.max(0, Math.floor(totalRocksFloat));

  const mineralsGained: Record<MineralKey, number> = { copper:0, silver:0, gold:0 };
  const hasLamp = s.upgrades.some(u=>u.id==='lamp1' && u.purchased);
  for (let i=0;i<rocksWhole;i++) {
    let m = rollMineral();
    if (hasLamp && Math.random()<0.10) {
      // bump tier or create copper from empty
      if (m === null) m = 'copper';
      else if (m==='copper') m='silver';
      else if (m==='silver') m='gold';
    }
    if (m) mineralsGained[m]++;
  }

  const newMinerals: Record<MineralKey, number> = { ...s.minerals } as any;
  (Object.keys(mineralsGained) as MineralKey[]).forEach(k => { newMinerals[k] = (newMinerals[k]||0) + mineralsGained[k]; });

  const summary: SessionSummary = {
    minerals: { ...mineralsGained },
    rocksProcessed: rocksWhole,
    durationMinutes: s.sessionDurationMinutes || 0
  };

  useGameStore.setState({
    focusActive: false,
    sessionStart: null,
    sessionEnd: null,
    sessionDurationMinutes: null,
    rateTimeline: [],
    minerals: newMinerals,
    rocksMined: s.rocksMined + rocksWhole,
    summary
  });
}

if (typeof window !== 'undefined') {
  setInterval(()=>{
    useGameStore.getState().finalizeIfNeeded();
  }, 5000);
}
