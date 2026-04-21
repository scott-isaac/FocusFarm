import React from 'react';
import { useGameStore } from '../useGameStore';

export const UpgradesPanel: React.FC = () => {
  const { upgrades, minerals, purchaseUpgrade } = useGameStore();
  const groups: Record<string, typeof upgrades> = { mining:[], fishing:[], global:[] };
  upgrades.forEach(u=> { (groups[u.activity] ||= []).push(u); });
  return (
    <div style={{display:'flex', flexDirection:'column', gap:24}}>
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          <h3 style={{margin:'0 0 8px', textTransform:'capitalize'}}>{group} Upgrades</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {list.map(u => {
              const affordable = Object.entries(u.cost).every(([k,v]) => minerals[k as keyof typeof minerals] >= (v||0));
              return (
                <div key={u.id} style={{background:'#161b22', padding:10, border:'1px solid #30363d', borderRadius:8, opacity:u.purchased?0.5:1}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                    <strong>{u.name}</strong>
                    <button disabled={u.purchased || !affordable} onClick={()=>purchaseUpgrade(u.id)} className="test-btn" style={{padding:'4px 10px', fontSize:12}}>
                      {u.purchased ? 'Owned' : affordable ? 'Buy' : '---'}
                    </button>
                  </div>
                  <div style={{fontSize:12, opacity:.8}}>{u.description}</div>
                  <div style={{fontSize:11, marginTop:4, display:'flex', gap:6, flexWrap:'wrap'}}>
                    {Object.entries(u.cost).map(([k,v]) => (
                      <span key={k} style={{background:'#0d1117', padding:'2px 6px', border:'1px solid #30363d', borderRadius:4}}>{k}:{v}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
