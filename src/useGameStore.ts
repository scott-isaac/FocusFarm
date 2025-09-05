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

interface GameState {
  focusActive: boolean;
  sessionStart: number | null;
  rocksMined: number;
  baseRate: number; // rocks per minute
  minerals: Record<MineralKey, number>;
  upgrades: Upgrade[];
  startFocus: () => void;
  stopFocus: () => void;
  tick: () => void;
  purchaseUpgrade: (id: string) => void;
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
  rocksMined: 0,
  baseRate: 3,
  minerals: { rock:0, copper:0, silver:0, gold:0 },
  upgrades: [
    {
      id:'pick1',
      name:'Sharpened Pick',
      description:'Increase mining speed by 50%.' ,
      cost:{ rock:50 },
      apply: (s) => { s.baseRate *= 1.5; }
    },
    {
      id:'lamp1',
      name:'Brighter Lantern',
      description:'+10% chance tier upgrade (rock->copper etc).',
      cost:{ copper:20 },
      apply: (s) => {
        // implement by transforming some rocks into next tier on each tick handled in tick
      }
    }
  ],
  startFocus: () => set({ focusActive:true, sessionStart: Date.now() }),
  stopFocus: () => set({ focusActive:false, sessionStart: null }),
  tick: () => {
    const state = get();
    if (!state.focusActive || !state.sessionStart) return;
    // compute elapsed minutes since last tick distribution stored in sessionStart update
    const now = Date.now();
    const elapsedMs = now - state.sessionStart;
    // Mine continuously at baseRate per minute
    const rocksToAddFloat = (elapsedMs / 60000) * state.baseRate;
    const alreadyCounted = state.rocksMinedSinceSessionStart ?? 0;
    const newRocksWhole = Math.floor(rocksToAddFloat - alreadyCounted);
    if (newRocksWhole <= 0) return;
    const mineralsGained: Partial<Record<MineralKey, number>> = {};
    for (let i=0;i<newRocksWhole;i++) {
      let m = rollMineral();
      // Check lantern upgrade effect (simple 10% chance to bump tier except gold)
      const hasLamp = state.upgrades.find(u=>u.id==='lamp1' && u.purchased);
      if (hasLamp && Math.random()<0.10) {
        if (m==='rock') m='copper'; else if (m==='copper') m='silver'; else if (m==='silver') m='gold';
      }
      mineralsGained[m] = (mineralsGained[m]||0) + 1;
    }
    set(s=> ({
      rocksMined: s.rocksMined + newRocksWhole,
      minerals: { ...s.minerals, ...Object.fromEntries(Object.entries(mineralsGained).map(([k,v])=>[k, (s.minerals as any)[k]+v])) },
      // @ts-ignore store session fractional progress
      rocksMinedSinceSessionStart: alreadyCounted + newRocksWhole
    }));
  },
  purchaseUpgrade: (id) => {
    set(s => {
      const up = s.upgrades.find(u=>u.id===id && !u.purchased);
      if (!up) return s;
      // check cost
      for (const [k,v] of Object.entries(up.cost)) {
        if (s.minerals[k as MineralKey] < (v||0)) return s;
      }
      // deduct
      const newMinerals = { ...s.minerals };
      for (const [k,v] of Object.entries(up.cost)) newMinerals[k as MineralKey]-= v||0;
      const clone: GameState = { ...s,
        minerals: newMinerals,
        upgrades: s.upgrades.map(u=>u.id===id?{...u,purchased:true}:u)
      } as any;
      up.apply(clone);
      return clone;
    });
  }
}));

// background interval
if (typeof window !== 'undefined') {
  setInterval(()=>{
    useGameStore.getState().tick();
  }, 1000);
}
