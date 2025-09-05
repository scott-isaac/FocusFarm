import React from 'react';
import { FocusSession } from './FocusSession';
import { InventoryPanel } from './InventoryPanel';
import { UpgradesPanel } from './UpgradesPanel';
import { useGameStore } from '../useGameStore';
import { Avatar } from './Avatar';

export const App: React.FC = () => {
  const { minerals, rocksMined } = useGameStore();
  return (
    <div className="app-shell">
      <header className="header">
        <h1>⛏️ Focus Farm</h1>
      </header>
      <main className="content">
        <section className="section-card">
          <Avatar />
          <FocusSession />
        </section>
        <section className="section-card">
            <h2 style={{margin:'0 0 4px', fontSize:18}}>Resources</h2>
            <p style={{margin:'0 0 12px', fontSize:13, opacity:.8}}>Total Rocks Processed: {rocksMined}</p>
            <div className="minerals-grid">
              {Object.entries(minerals).map(([k,v]) => (
                <div key={k} className="mineral">
                  <label>{k}</label>
                  <div className="value">{v as number}</div>
                </div>
              ))}
            </div>
        </section>
        <details className="collapsible" open>
          <summary>Inventory</summary>
          <div className="inner">
            <InventoryPanel />
          </div>
        </details>
        <details className="collapsible" open>
          <summary>Upgrades</summary>
          <div className="inner">
            <UpgradesPanel />
          </div>
        </details>
      </main>
      <div className="sticky-actions">
        <a href="#top" style={{textDecoration:'none'}}><button className="secondary-btn" style={{flex:1}}>Top</button></a>
        <button className="secondary-btn" onClick={()=>window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'})}>Bottom</button>
      </div>
    </div>
  );
};
