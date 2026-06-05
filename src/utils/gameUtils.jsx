//import React from 'react';

export const getEmoji = (choice) => {
  const map = { rock: '🪨', paper: '📄', scissors: '✂️', timeout: '⏳' };
  return map[choice] || '❔';
};

export const getRevealText = (revealTime) => {
  switch (revealTime) {
    case 3: return "Rock...";
    case 2: return "Paper...";
    case 1: return "Scissors...";
    case 0: return "Shoot!";
    default: return "";
  }
};

export const renderTimeline = (matchHistory, format) => {
  const tiesCount = matchHistory.filter(res => res === 'tie').length;
  const totalNotches = format + tiesCount;

  return (
    <div className="timeline-container">
      {[...Array(totalNotches)].map((_, i) => {
        let color = 'var(--input-border)';
        let hasShadow = false;

        if (i < matchHistory.length) {
          const res = matchHistory[i];
          if (res === 'win') color = 'var(--win)';
          if (res === 'lose') color = 'var(--loss)';
          if (res === 'tie') color = 'var(--tie)';
          hasShadow = true;
        }
        
        return (
          <div 
            key={i} 
            className="timeline-notch"
            style={{ 
              backgroundColor: color,
              boxShadow: hasShadow ? `0 0 8px ${color}` : 'none'
            }} 
          />
        );
      })}
    </div>
  );
};

export const renderHistoryTrail = (history, matchHistory, format) => {
  const tiesCount = matchHistory.filter(res => res === 'tie').length;
  const totalNotches = format + tiesCount;

  return (
    <div className="history-trail">
      {[...Array(totalNotches)].map((_, i) => (
        <div key={i} className="history-item">
          {i < history.length ? (
            <span>{getEmoji(history[i])}</span>
          ) : (
            <div className="ghost-dot" />
          )}
        </div>
      ))}
    </div>
  );
};

// Math trick using UTC time to generate the exact same sequence for everyone on earth today
export const getDailySequence = () => {
  const today = new Date();
  const seedString = `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
  
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0; 
  }

  const moves = ['rock', 'paper', 'scissors'];
  const sequence = [];
  
  const seededRandom = () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 100; i++) {
    sequence.push(moves[Math.floor(seededRandom() * moves.length)]);
  }
  return sequence;
};

// --- ANIMATION HELPER ---
export const renderAnimatedChoice = (phase, revealTime, choice, isOpponent) => {
  // 1. The Countdown Phase
  if (phase === 'reveal') {
    if (revealTime === 3) return <div key="3" className="anim-pump">🪨</div>;
    if (revealTime === 2) return <div key="2" className="anim-pump">📄</div>;
    if (revealTime === 1) return <div key="1" className="anim-pump">✂️</div>;
    
    // Renders a hidden emoji on "Shoot!" (revealTime === 0) so the screen 
    // goes blank for a millisecond before the explosive reveal!
    return <div key="0" style={{ visibility: 'hidden' }}>🪨</div>; 
  }

  // 2. The Explosive Final Reveal Phase
  if (phase === 'result' || phase === 'gameover') {
    return <div key="result" className="anim-reveal">{getEmoji(choice)}</div>;
  }

  // 3. The Waiting / Picking Phase
  if (isOpponent) {
    return choice ? '🔒' : '❔';
  } else {
    return choice ? getEmoji(choice) : '❔'; 
  }
};