import React, { useState, useEffect } from 'react';
import { useGameStore } from '../useGameStore';

const LAST_DURATION_KEY = 'ff:lastDuration';

export const FocusSession: React.FC = () => {
  const { focusActive, startFocus, interruptFocus, completeNow, summary, ackSummary, sessionEnd, sessionStart, sessionDurationMinutes } = useGameStore();
  const [showPicker, setShowPicker] = useState(false);
  const [minutes, setMinutes] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_DURATION_KEY) : null;
    return saved ? parseInt(saved,10) : 25;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(()=>{ const id = setInterval(()=> setNow(Date.now()), 1000); return ()=> clearInterval(id); }, []);

  const remainingMs = focusActive && sessionEnd ? Math.max(0, sessionEnd - now) : 0;
  const totalMinutes = sessionDurationMinutes || minutes;
  const pct = focusActive && sessionEnd && sessionStart ? Math.min(1, 1 - remainingMs/(totalMinutes*60000)) : 0;

  const openPicker = () => { setShowPicker(true); };
  const begin = () => { startFocus(minutes); localStorage.setItem(LAST_DURATION_KEY, String(minutes)); setShowPicker(false); };

  return (
    <div className="flex flex-col gap-4">
      {!focusActive && !summary && (
        <button onClick={openPicker} className="primary-btn">Start Mining Session</button>
      )}
      {focusActive && (
        <div className="flex flex-col gap-3">
          <div className="font-semibold text-lg">⛏️ Mining...</div>
          <div className="timer-bar"><div style={{width:`${pct*100}%`}} /></div>
          <div className="text-sm opacity-80">Time Left: {formatTime(remainingMs)} / {totalMinutes}m</div>
          <div className="flex gap-2">
            <button onClick={completeNow} className="test-btn flex-1">Instant Complete</button>
            <button onClick={()=>{ if (confirm('Interrupting loses all progress. Continue?')) interruptFocus(); }} className="danger-btn flex-1">Interrupt</button>
          </div>
        </div>
      )}
      {/* summary moved to modal */}
      {showPicker && !focusActive && !summary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="m-0 mb-2">Mining Duration</h3>
            <div className="text-sm opacity-70">15 - 60 minutes</div>
            <input className="range-input" type="range" min={15} max={60} step={1} value={minutes} onChange={e=> setMinutes(parseInt(e.target.value,10))} />
            <div className="text-4xl font-semibold text-center">{minutes}m</div>
            <div className="flex gap-2">
              <button onClick={begin} className="primary-btn flex-1">Begin</button>
              <button onClick={()=>setShowPicker(false)} className="secondary-btn flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 style={{margin:'0 0 4px'}}>Session Complete</h3>
            <div style={{fontSize:12, opacity:.75}}>Focused {summary.durationMinutes} min</div>
            <div style={{fontSize:12, opacity:.75}}>Rocks Processed: {summary.rocksProcessed}</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {Object.entries(summary.minerals).map(([k,v]) => (
                <div key={k} className="mineral" style={{minWidth:70}}>
                  <label>{k}</label>
                  <div className="value" style={{fontSize:16}}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={ackSummary} className="primary-btn">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTime(ms: number) { const totalSec = Math.ceil(ms/1000); const m = Math.floor(totalSec/60); const s = totalSec % 60; return `${m}:${s.toString().padStart(2,'0')}`; }
