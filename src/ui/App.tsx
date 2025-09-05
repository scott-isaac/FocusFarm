import React from 'react';
import { FocusSession } from './FocusSession';
import { InventoryPanel } from './InventoryPanel';
import { UpgradesPanel } from './UpgradesPanel';
import { useGameStore } from '../useGameStore';

export const App: React.FC = () => {
  const { minerals, rocksMined } = useGameStore();
  return (
    <div style={{display:'grid', gridTemplateColumns:'260px 1fr 300px', gap:16, height:'100%'}}>
      <div style={{borderRight:'1px solid #30363d', padding:16}}>
        <h1 style={{marginTop:0, fontSize:20}}>⛏️ Focus Farm</h1>
        <FocusSession />
      </div>
      <div style={{padding:16, overflowY:'auto'}}>
        <h2 style={{marginTop:0}}>Mine</h2>
        <p>Total Rocks Mined (lifetime committed): {rocksMined}</p>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          {Object.entries(minerals).map(([k,v]) => (
            <div key={k} style={{background:'#161b22', padding:8, border:'1px solid #30363d', borderRadius:6, minWidth:80}}>
              <div style={{fontSize:12, opacity:.7}}>{k}</div>
              <div style={{fontWeight:600}}>{v as number}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{borderLeft:'1px solid #30363d', padding:16, display:'flex', flexDirection:'column', gap:24}}>
        <InventoryPanel />
        <UpgradesPanel />
      </div>
    </div>
  );
};
