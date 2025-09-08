import React from 'react';
import { useGameStore } from '../useGameStore';

export const InventoryPanel: React.FC = () => {
  const { minerals, fish, mineDepth, currentMine } = useGameStore();
  return (
    <div style={{display:'flex', flexDirection:'column', gap:24}}>
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
      <div>
        <h3 style={{margin:'0 0 4px'}}>Current Mine</h3>
        <div style={{fontSize:12, opacity:.7, marginBottom:8}}>Deepest Depth: {Math.floor(mineDepth)} m</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          {Object.entries(currentMine.unlockDepth).map(([k, d]) => {
            const known = mineDepth >= d;
            return (
              <div key={k} style={{background:'#161b22', padding:8, border:'1px solid #30363d', borderRadius:6, minWidth:120}}>
                <strong>{known? k : '???'}</strong>
                <div style={{fontSize:11, opacity:.7}}>≥ depth {known? d : '??'}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:11, opacity:.55, marginTop:6}}>Mine stats reroll will be added later.</div>
      </div>
    </div>
  );
};
