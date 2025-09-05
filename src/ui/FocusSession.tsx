import React, { useState, useEffect } from 'react';
import { useGameStore } from '../useGameStore';

export const FocusSession: React.FC = () => {
  const { focusActive, startFocus, interruptFocus, completeNow, summary, ackSummary, sessionEnd, sessionStart, sessionDurationMinutes } = useGameStore();
  const [showPicker, setShowPicker] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [now, setNow] = useState(Date.now());

  useEffect(()=>{
    const id = setInterval(()=> setNow(Date.now()), 1000);
    return ()=> clearInterval(id);
  }, []);

  const remainingMs = focusActive && sessionEnd ? Math.max(0, sessionEnd - now) : 0;
  const remainingMin = remainingMs/60000;

  const openPicker = () => { setMinutes(25); setShowPicker(true); };
  const begin = () => { startFocus(minutes); setShowPicker(false); };

  const totalMinutes = sessionDurationMinutes || minutes;
  const pct = focusActive && sessionEnd && sessionStart ? Math.min(1, 1 - remainingMs/(totalMinutes*60000)) : 0;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {!focusActive && !summary && (
        <button onClick={openPicker} style={btnStyle}>Start Mining Session</button>
      )}
      {focusActive && (
        <div style={panel}>
          <div style={{fontWeight:600}}>⛏️ Mining...</div>
          <div style={{height:8, background:'#30363d', borderRadius:4, overflow:'hidden'}}>
            <div style={{height:'100%', width:`${pct*100}%`, background:'#238636', transition:'width 1s linear'}} />
          </div>
          <div style={{fontSize:12, opacity:.8}}>Time Left: {formatTime(remainingMs)} / {totalMinutes}m</div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={completeNow} style={smallBtn}>Instant Complete (test)</button>
            <button onClick={()=>{
              if (confirm('Interrupting loses all progress. Continue?')) interruptFocus();
            }} style={{...smallBtn, background:'#b62324', borderColor:'#f85149'}}>Interrupt</button>
          </div>
        </div>
      )}
      {summary && (
        <div style={panel}>
          <div style={{fontWeight:600}}>Session Summary</div>
          <div style={{fontSize:12, opacity:.8}}>Duration: {summary.durationMinutes} min</div>
          <div style={{fontSize:12, opacity:.8}}>Rocks Processed: {summary.rocksProcessed}</div>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:6}}>
            {Object.entries(summary.minerals).map(([k,v]) => (
              <div key={k} style={pill}>{k}:{v}</div>
            ))}
          </div>
          <button onClick={ackSummary} style={{...smallBtn, alignSelf:'flex-start'}}>Close</button>
        </div>
      )}
      {showPicker && !focusActive && !summary && (
        <div style={modalBackdrop}>
          <div style={modal}>
            <h3 style={{margin:'0 0 12px'}}>Mining Duration</h3>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {[15,20,25,30,45,60].map(m => (
                <button key={m} onClick={()=> setMinutes(m)} style={{...optionBtn, ...(minutes===m?selectedOption:{})}}>{m}m</button>
              ))}
            </div>
            <div style={{marginTop:16, display:'flex', gap:8}}>
              <button onClick={begin} style={btnStyle}>Begin</button>
              <button onClick={()=>setShowPicker(false)} style={{...btnStyle, background:'#30363d', borderColor:'#30363d'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTime(ms: number) {
  const totalSec = Math.ceil(ms/1000);
  const m = Math.floor(totalSec/60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

const panel: React.CSSProperties = {
  background:'#161b22',
  padding:12,
  border:'1px solid #30363d',
  borderRadius:8,
  display:'flex',
  flexDirection:'column',
  gap:8
};

const btnStyle: React.CSSProperties = {
  background:'#238636',
  color:'#fff',
  border:'1px solid #2ea043',
  borderRadius:6,
  padding:'8px 12px',
  cursor:'pointer',
  fontSize:14,
  fontWeight:600
};

const smallBtn: React.CSSProperties = {
  ...btnStyle,
  padding:'6px 10px',
  fontSize:12
};

const pill: React.CSSProperties = {
  background:'#0d1117',
  padding:'2px 6px',
  border:'1px solid #30363d',
  borderRadius:6,
  fontSize:12
};

const modalBackdrop: React.CSSProperties = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100
};

const modal: React.CSSProperties = {
  background:'#161b22',
  padding:24,
  border:'1px solid #30363d',
  borderRadius:12,
  width:320,
  display:'flex',
  flexDirection:'column',
  gap:8
};

const optionBtn: React.CSSProperties = {
  background:'#21262d',
  color:'#e6edf3',
  border:'1px solid #30363d',
  borderRadius:6,
  padding:'6px 10px',
  cursor:'pointer',
  fontSize:13,
  fontWeight:500
};

const selectedOption: React.CSSProperties = {
  background:'#1f6feb',
  borderColor:'#388bfd',
  color:'#fff'
};
