import React from 'react';
import { useGameStore } from '../useGameStore';

export const InventoryPanel: React.FC = () => {
  const { minerals, fish } = useGameStore();
  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div>
        <h3 style={{margin:'0 0 8px'}}>Minerals</h3>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          {Object.entries(minerals).map(([k,v]) => (
            <div key={k} style={{background:'#161b22', padding:8, border:'1px solid #30363d', borderRadius:6, minWidth:90}}>
              <strong>{k}</strong>: {v as number}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{margin:'0 0 8px'}}>Fish</h3>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          {Object.entries(fish).map(([k,v]) => (
            <div key={k} style={{background:'#161b22', padding:8, border:'1px solid #30363d', borderRadius:6, minWidth:120}}>
              <strong>{k.replace('_',' ')}</strong>: {v as number}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
