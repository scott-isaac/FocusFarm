import React from 'react';
import { useGameStore } from '../useGameStore';

export const FocusSession: React.FC = () => {
  const { focusActive, startFocus, stopFocus } = useGameStore();
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <button onClick={()=> focusActive? stopFocus(): startFocus()} style={btnStyle}>
        {focusActive? 'Stop Focusing':'Start Focus Session'}
      </button>
      <small style={{opacity:.7}}>
        While active, rocks are mined automatically. Keep this tab visible to simulate focus.
      </small>
    </div>
  );
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
