import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../useGameStore';

export const Avatar: React.FC = () => {
  const { focusActive, sessionActivity } = useGameStore();
  const sparkRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!focusActive || sessionActivity!=='mining') return; // spark only for mining
    const id = setInterval(()=> {
      const el = sparkRef.current; if (!el) return;
      const x = (Math.random()*30)-15; const y = (Math.random()*12)-6;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }, 500);
    return ()=> clearInterval(id);
  }, [focusActive, sessionActivity]);

  const mining = sessionActivity==='mining';
  const fishing = sessionActivity==='fishing';

  return (
    <div className="avatar-wrapper">
      <div className={`avatar-stage ${focusActive? (mining? 'avatar-mining':'avatar-fishing'):'avatar-idle'}`}>        
        <div className="avatar-char">
          <svg className="avatar-body" viewBox="0 0 120 120">
            <circle className="torso" cx="60" cy="70" r="34" />
            <rect className="helmet" x="30" y="18" rx="10" ry="10" width="60" height="46" />
            <rect className="helmet-band" x="30" y="50" width="60" height="10" />
            <circle className="eye" cx="46" cy="42" r="6" />
            <circle className="eye" cx="74" cy="42" r="6" />
            <path className="shine" d="M38 22 h44 v10 A28 28 0 0 1 38 32 Z" />
            <path d="M48 86 q12 10 24 0" fill="none" stroke="#222" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {mining && (
            <svg className="avatar-pick" viewBox="0 0 120 120">
              <line className="shaft" x1="32" y1="100" x2="32" y2="46" />
              <path className="head" d="M12 48 q20 -26 40 0 q-8 4 -40 0 z" />
            </svg>
          )}
          {fishing && (
            <svg className="avatar-rod" viewBox="0 0 140 140">
              <path className="pole" d="M50 120 Q60 70 65 40 Q70 18 90 10" />
              <path className="line" d="M90 10 Q110 40 112 70 Q113 90 108 104" />
              <circle cx="108" cy="106" r="4" fill="#fff" stroke="#ccc" strokeWidth="1" />
            </svg>
          )}
          {mining && <div className="avatar-spark" ref={sparkRef} />}
        </div>
      </div>
      <div className="avatar-label">{focusActive? (mining? 'Mining':'Fishing') : 'Idle'}</div>
    </div>
  );
};
