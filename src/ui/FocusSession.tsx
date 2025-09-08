import React, { useState, useEffect } from 'react';
import { useGameStore } from '../useGameStore';

const LAST_DURATION_KEY = 'ff:lastDuration';
const LAST_ACTIVITY_KEY = 'ff:lastActivity';
const LAST_DEPTH_KEY = 'ff:lastDepth';

export const FocusSession: React.FC = () => {
  const { focusActive, startFocus, interruptFocus, completeNow, summary, ackSummary, sessionEnd, sessionStart, sessionDurationMinutes, mineDepth } = useGameStore();
  const [showPicker, setShowPicker] = useState(false);
  const [minutes, setMinutes] = useState<number>(() => { const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_DURATION_KEY) : null; return saved ? parseInt(saved,10) : 25; });
  const [activity, setActivity] = useState<'mining'|'fishing'>(()=> (localStorage.getItem(LAST_ACTIVITY_KEY) as any)||'mining');
  const [depth, setDepth] = useState<number>(()=> { const d = localStorage.getItem(LAST_DEPTH_KEY); return d? parseInt(d,10): 0; });
  const [now, setNow] = useState(Date.now());

  useEffect(()=>{ const id = setInterval(()=> setNow(Date.now()), 1000); return ()=> clearInterval(id); }, []);

  const remainingMs = focusActive && sessionEnd ? Math.max(0, sessionEnd - now) : 0;
  const totalMinutes = sessionDurationMinutes || minutes;
  const pct = focusActive && sessionEnd && sessionStart ? Math.min(1, 1 - remainingMs/(totalMinutes*60000)) : 0;

  const openPickerFor = (act: 'mining'|'fishing') => { setActivity(act); setShowPicker(true); if (act==='mining') { setDepth(Math.floor(mineDepth)); } };
  const begin = () => { startFocus(activity, minutes, activity==='mining'? depth : undefined); localStorage.setItem(LAST_DURATION_KEY, String(minutes)); localStorage.setItem(LAST_ACTIVITY_KEY, activity); if (activity==='mining') localStorage.setItem(LAST_DEPTH_KEY, String(depth)); setShowPicker(false); };

  const maxSelectableDepth = Math.floor(mineDepth); // can only choose depths up to current deepest integer

  return (
    <div className="flex flex-col gap-4">
      {!focusActive && !summary && (
        <div style={{display:'flex', gap:8}}>
          <button onClick={()=>openPickerFor('mining')} className="primary-btn" style={{flex:1}}>Start Mining</button>
          <button onClick={()=>openPickerFor('fishing')} className="test-btn" style={{flex:1}}>Start Fishing</button>
        </div>
      )}
      {focusActive && (
        <div className="flex flex-col gap-3">
          <div className="font-semibold text-lg">{activity==='mining'? '⛏️ Mining...':'🎣 Fishing...'}</div>
          <div className="timer-bar"><div style={{width:`${pct*100}%`}} /></div>
            {activity==='mining' && (
              <div style={{fontSize:12, opacity:.75}}>Depth: {depth} m</div>
            )}
          <div className="text-sm opacity-80">Time Left: {formatTime(remainingMs)} / {totalMinutes}m</div>
          <div className="flex gap-2">
            <button onClick={completeNow} className="test-btn flex-1">Instant Complete</button>
            <button onClick={()=>{ if (confirm('Interrupting loses all progress. Continue?')) interruptFocus(); }} className="danger-btn flex-1">Interrupt</button>
          </div>
        </div>
      )}
      {showPicker && !focusActive && !summary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 style={{margin:'0 0 4px'}}>{activity==='mining'? 'Mining Session':'Fishing Session'}</h3>
            <div style={{fontSize:12, opacity:.7}}>Length: 15 - 60 minutes</div>
            <input className="range-input" type="range" min={15} max={60} step={1} value={minutes} onChange={e=> setMinutes(parseInt(e.target.value,10))} />
            <div style={{fontSize:36, fontWeight:600, textAlign:'center'}}>{minutes}m</div>
            {activity==='mining' && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:12, opacity:.7, display:'flex', justifyContent:'space-between'}}>
                  <span>Select Depth (0 - {maxSelectableDepth})</span>
                  <span>Deepest: {Math.floor(mineDepth)} m</span>
                </div>
                <input className="range-input" type="range" min={0} max={maxSelectableDepth} step={1} value={depth} onChange={e=> setDepth(parseInt(e.target.value,10))} />
                <div style={{textAlign:'center', fontWeight:600}}>{depth} m</div>
                <div style={{fontSize:11, opacity:.6, marginTop:4}}>
                  Only mining at your current deepest depth (floor) can push deeper.
                </div>
              </div>
            )}
            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button onClick={begin} className="primary-btn" style={{flex:1}}>Begin</button>
              <button onClick={()=>setShowPicker(false)} className="secondary-btn" style={{flex:1}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 style={{margin:'0 0 6px'}}>Session Complete</h3>
            <div style={{fontSize:12, opacity:.75}}>Activity: {summary.activity}</div>
            <div style={{fontSize:12, opacity:.75}}>Focused {summary.durationMinutes} min</div>
            <div style={{fontSize:12, opacity:.75}}>Attempts: {summary.attempts}</div>
            {summary.activity==='mining' && summary.miningDepth !== undefined && (
              <div style={{fontSize:12, opacity:.75}}>Depth Mined: {summary.miningDepth} m {summary.depthGained? `( +${summary.depthGained} m )` : ''}</div>
            )}
            {summary.activity==='mining' && summary.minerals && (
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                {Object.entries(summary.minerals).filter(([_,v])=> (v as number)>0).map(([k,v]) => (
                  <div key={k} className="mineral" style={{minWidth:70}}>
                    <label>{k}</label>
                    <div className="value" style={{fontSize:16}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {summary.activity==='fishing' && summary.fishCaught && (
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                {Object.entries(summary.fishCaught).map(([k,v]) => (
                  <div key={k} className="mineral" style={{minWidth:90}}>
                    <label>{k.replace('_',' ')}</label>
                    <div className="value" style={{fontSize:16}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={ackSummary} className="primary-btn">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTime(ms: number) { const totalSec = Math.ceil(ms/1000); const m = Math.floor(totalSec/60); const s = totalSec % 60; return `${m}:${s.toString().padStart(2,'0')}`; }
