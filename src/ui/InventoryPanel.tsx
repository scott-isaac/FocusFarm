import React from 'react';
import { useGameStore } from '../useGameStore';

export const InventoryPanel: React.FC = () => {
  const { minerals } = useGameStore();
  return (
    <div>
      <h3 style={{margin:'0 0 8px'}}>Inventory</h3>
      <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
        {Object.entries(minerals).map(([k,v]) => (
          <div key={k} style={{background:'#161b22', padding:8, border:'1px solid #30363d', borderRadius:6, minWidth:100}}>
            <strong>{k}</strong>: {v}
          </div>
        ))}
      </div>
    </div>
  );
};
