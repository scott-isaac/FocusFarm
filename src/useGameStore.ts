import { create } from 'zustand';

export type MineralKey = 'rock' | 'copper' | 'silver' | 'gold';

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
  rocks: number;
  durationMinutes: number;
}

interface RatePoint { t: number; rate: number; }

interface GameState {
  focusActive: boolean;
  sessionStart: number | null;
  sessionEnd: number | null;
  sessionDurationMinutes: number | null;
  rateTimeline: RatePoint[]; // changes in mining rate during session
  rocksMined: number; // committed lifetime
  baseRate: number; // rocks per minute (current live rate)
  minerals: Record<MineralKey, number>; // committed lifetime
  upgrades: Upgrade[];
  summary: SessionSummary | null;
  startFocus: (minutes: number) => void;
  interruptFocus: () => void;
  completeNow: () => void;
  ackSummary: () => void;
  purchaseUpgrade: (id: string) => void;
  finalizeIfNeeded: () => void; // called to check natural completion
  // helper not exposed in type but used internally
}

const rollMineral = (): MineralKey => {
  const r = Math.random();
  if (r < 0.0001) return 'gold';
  if (r < 0.02) return 'silver';
  if (r < 0.12) return 'copper';
  return 'rock';
};

export const useGameStore = create<GameState>((set, get) => ({
  focusActive: false,
  sessionStart: null,
  sessionEnd: null,
  sessionDurationMinutes: null,
  rateTimeline: [],
  rocksMined: 0,
  baseRate: 3,
  minerals: { rock:0, copper:0, silver:0, gold:0 },
  upgrades: [
    {
      id:'pick1',
      name:'Sharpened Pick',
      description:'Increase mining speed by 50%.',
      cost:{ rock:50 },
      apply: (s) => { s.baseRate *= 1.5; }
    },
    {
      id:'lamp1',
      name:'Brighter Lantern',
      description:'+10% chance tier upgrade (rock->copper etc).',
      cost:{ copper:20 },
      apply: () => { /* effect applied probabilistically at session finalize */ }
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
    finalizeSession(true); // force full yield of scheduled session
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
      // if rate changed during active session, append new rate point
      let rateTimeline = s.rateTimeline;
      if (s.focusActive && s.sessionStart) {
        if (clone.baseRate !== beforeRate) {
          rateTimeline = [...rateTimeline, { t: Date.now(), rate: clone.baseRate }];
        }
      }
      return { ...clone, rateTimeline };
    });
  },
  finalizeIfNeeded: () => {
    const s = get();
    if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return;
    const now = Date.now();
    if (now < s.sessionEnd) return; // not yet
    finalizeSession(false);
  }
}));

function finalizeSession(force: boolean) {
  const s = useGameStore.getState();
  if (!s.focusActive || !s.sessionStart || !s.sessionEnd) return;
  const plannedEnd = s.sessionEnd;
  const effectiveEnd = force ? plannedEnd : Math.min(Date.now(), plannedEnd);

  // Calculate total rocks using rate timeline integration up to effectiveEnd
  const end = plannedEnd; // always integrate over full planned time for force; for natural completion end === plannedEnd
  const useFullPlanned = force; // clarify intent
  const integrationEnd = useFullPlanned ? plannedEnd : effectiveEnd;
  const points = [...s.rateTimeline];
  points.sort((a,b)=>a.t-b.t);
  let totalRocksFloat = 0;
  for (let i=0;i<points.length;i++) {
    const p = points[i];
    const nextT = (i+1<points.length ? points[i+1].t : integrationEnd);
    const segEnd = Math.min(nextT, integrationEnd);
    if (segEnd <= p.t) continue;
    const durMs = segEnd - p.t;
    totalRocksFloat += (durMs/60000) * p.rate;
    if (nextT > integrationEnd) break;
  }
  const rocksWhole = Math.max(0, Math.floor(totalRocksFloat));

  const mineralsGained: Record<MineralKey, number> = { rock:0, copper:0, silver:0, gold:0 };
  const hasLamp = s.upgrades.some(u=>u.id==='lamp1' && u.purchased);
  for (let i=0;i<rocksWhole;i++) {
    let m = rollMineral();
    if (hasLamp && Math.random()<0.10) {
      if (m==='rock') m='copper'; else if (m==='copper') m='silver'; else if (m==='silver') m='gold';
    }
    mineralsGained[m]++;
  }
  const newMinerals: Record<MineralKey, number> = { ...s.minerals } as any;
  (Object.keys(mineralsGained) as MineralKey[]).forEach(k => { newMinerals[k] = (newMinerals[k]||0) + mineralsGained[k]; });
  const summary: SessionSummary = {
    minerals: { ...mineralsGained },
    rocks: rocksWhole,
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

// Passive check interval for session completion only (no resource accrual mid-session)
if (typeof window !== 'undefined') {
  setInterval(()=>{
    useGameStore.getState().finalizeIfNeeded();
  }, 5000); // coarse; no need fine-grained
}
