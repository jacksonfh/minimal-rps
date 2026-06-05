import { useState, useEffect, useCallback } from 'react';

// Math trick using UTC time to generate the exact same sequence for everyone on earth today
const getDailySequence = () => {
  const today = new Date();
  
  // FIXED: Using UTC ensures the whole globe rolls over to the next puzzle at the exact same second
  const seedString = `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
  
  // Simple hashing function
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0; 
  }

  const moves = ['rock', 'paper', 'scissors'];
  const sequence = [];
  
  // Seed a random number generator using the date hash
  const seededRandom = () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };

  // Generate the 5 moves for the day
  for (let i = 0; i < 100; i++) {
    sequence.push(moves[Math.floor(seededRandom() * moves.length)]);
  }
  return sequence;
};

export default function DailyArena({ myName }) {
  const format = 5; // Daily challenge is always Best of 5
  const winsNeeded = 3;
  
  const [dailySequence] = useState(getDailySequence());
  const [currentRound, setCurrentRound] = useState(0);

  const [phase, setPhase] = useState('picking'); 
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  
  const [myHistory, setMyHistory] = useState([]);
  const [opponentHistory, setOpponentHistory] = useState([]);

  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [matchHistory, setMatchHistory] = useState([]); 
  const [roundResult, setRoundResult] = useState('');

  const [revealTime, setRevealTime] = useState(3);
  const [notification, setNotification] = useState(null);


  const getEmoji = (choice) => {
    const map = { rock: '🪨', paper: '📄', scissors: '✂️' };
    return map[choice] || '';
  };

  const getRevealText = () => {
    switch (revealTime) {
      case 3: return "Rock...";
      case 2: return "Paper...";
      case 1: return "Scissors...";
      case 0: return "Shoot!";
      default: return "";
    }
  };

  const renderTimeline = () => {
    const tiesCount = matchHistory.filter(res => res === 'tie').length;
    const totalNotches = format + tiesCount;

    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
              style={{ 
                width: '14px', height: '14px', borderRadius: '50%', 
                backgroundColor: color, boxShadow: hasShadow ? `0 0 8px ${color}` : 'none',
                transition: 'all 0.3s ease'
              }} 
            />
          );
        })}
      </div>
    );
  };

  const renderHistoryTrail = (history) => {
    const tiesCount = matchHistory.filter(res => res === 'tie').length;
    const totalNotches = format + tiesCount; // Uses format for Daily mode!

    return (
      <div style={{ display: 'flex', gap: '8px', opacity: 0.8, fontSize: '1.1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[...Array(totalNotches)].map((_, i) => (
          <div key={i} style={{ width: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '24px' }}>
            {i < history.length ? (
              <span>{getEmoji(history[i])}</span>
            ) : (
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--input-border)', opacity: 0.4 }} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleChoice = (choice) => {
    if (myChoice || phase !== 'picking') return;
    setMyChoice(choice);
    // The "Global Opponent" pulls its move from the seeded array!
    setOpponentChoice(dailySequence[currentRound]);
    setPhase('reveal');
    setRevealTime(3);
  };

  const calculateWinner = useCallback(() => {
    let newMyScore = myScore;
    let newOpponentScore = opponentScore;

    if (myChoice === opponentChoice) {
      setRoundResult('Tie!');
      setMatchHistory(prev => [...prev, 'tie']);
    } else if (
      (myChoice === 'rock' && opponentChoice === 'scissors') ||
      (myChoice === 'paper' && opponentChoice === 'rock') ||
      (myChoice === 'scissors' && opponentChoice === 'paper')
    ) {
      setRoundResult('You Win!');
      newMyScore += 1;
      setMyScore(newMyScore);
      setMatchHistory(prev => [...prev, 'win']);
    } else {
      setRoundResult('You Lose!');
      newOpponentScore += 1;
      setOpponentScore(newOpponentScore);
      setMatchHistory(prev => [...prev, 'lose']);
    }

    setMyHistory(prev => [...prev, myChoice]);
    setOpponentHistory(prev => [...prev, opponentChoice]);

    setCurrentRound(prev => prev + 1);

    if (newMyScore >= winsNeeded || newOpponentScore >= winsNeeded) {
      setPhase('gameover');
    } else {
      setPhase('result');
    }
  }, [myChoice, opponentChoice, myScore, opponentScore, winsNeeded]);

  useEffect(() => {
    if (phase === 'reveal') {
      if (revealTime >= 0) {
        const t = setTimeout(() => setRevealTime(revealTime - 1), 700);
        return () => clearTimeout(t);
      } else {
        calculateWinner();
      }
    }
  }, [phase, revealTime, calculateWinner]);

  useEffect(() => {
    if (phase === 'result') {
      const asyncTimer = setTimeout(() => {
        setMyChoice(null);
        setOpponentChoice(null);
        setRevealTime(3);
        setRoundResult('');
        setPhase('picking');
      }, 2500); // Wait 2.5s to show the result before advancing
      return () => clearTimeout(asyncTimer);
    }
  }, [phase]);

  const handleShare = () => {
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;
    const title = `RPSdle - ${dateStr}\n`;
    
    const emojiTimeline = matchHistory.map(res => {
      if (res === 'win') return '🟢';
      if (res === 'lose') return '🔴';
      return '🟡';
    }).join('');
    
    navigator.clipboard.writeText(`${title}${emojiTimeline}`);
    setNotification('Results copied to clipboard! 📋');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="container" style={{ position: 'relative', justifyContent: 'flex-start', paddingTop: 'clamp(20px, 5vh, 40px)' }}>
      
      {notification && <div className="rematch-notification">{notification}</div>}

      <div className="arena-header" style={{ marginBottom: '10px', justifyContent: 'center' }}>
        <span style={{ color: 'var(--main-text)', fontWeight: 'bold' }}>Daily Challenge (Best of 5)</span>
      </div>

      {/* THE ARENA */}
      <div className="arena" style={{ padding: 'clamp(15px, 3vh, 30px) 20px', flexGrow: 0, height: 'auto', minHeight: '50vh' }}>
        
        {/* TOP: GLOBAL OPPONENT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <h2 className="player-text" style={{ marginBottom: '5px' }}>Rochambeaudle:</h2>
          <p style={{ margin: '0 0 10px 0', color: 'var(--label-text)', textAlign: 'center' }}>Score: {opponentScore}</p>
          
          <span style={{ fontSize: 'clamp(3rem, 6vh, 4.5rem)', minHeight: '1.2em', display: 'flex', alignItems: 'center' }}>
            {(phase === 'result' || phase === 'gameover') ? getEmoji(opponentChoice) : (opponentChoice ? '🔒' : '')}
          </span>
          
          <div style={{ minHeight: '20px', marginTop: '10px' }} />
        </div>

        {/* MIDDLE: TIMELINE */}
        {/* ADDED: position: 'relative' and increased padding to 25px */}
        <div className="center-area" style={{ width: '100%', borderTop: '1px solid var(--input-border)', borderBottom: '1px solid var(--input-border)', margin: '10px 0', flexDirection: 'column', padding: '25px 0', position: 'relative' }}>
          
          {/* MOVED: Globe History inside the center border */}
          <div style={{ position: 'absolute', top: '5px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {renderHistoryTrail(opponentHistory)}
          </div>

          <div style={{ margin: '10px 0', width: '100%' }}>
            {renderTimeline()}
          </div>
          {phase === 'picking' && <h1 style={{ fontSize: 'clamp(1.5rem, 4vh, 2rem)', margin: 0, color: 'var(--main-text)' }}>Make your move...</h1>}
          {phase === 'reveal' && <h1 style={{ fontSize: 'clamp(2rem, 5vh, 3.5rem)', margin: 0, color: 'var(--accent)' }}>{getRevealText()}</h1>}
          {(phase === 'result' || phase === 'gameover') && (
             <h1 className="vs" style={{ 
               color: phase === 'gameover' ? (myScore >= winsNeeded ? 'var(--win)' : 'var(--loss)') : (roundResult === 'Tie!' ? 'var(--tie)' : (roundResult === 'You Win!' ? 'var(--win)' : 'var(--loss)')), 
               fontSize: phase === 'gameover' ? 'clamp(2rem, 5vh, 2.5rem)' : 'clamp(2rem, 5vh, 3rem)',
               margin: 0
             }}>
               {phase === 'gameover' ? (myScore >= winsNeeded ? 'DAILY WON!' : 'DAILY LOST!') : roundResult}
             </h1>
          )}

          {/* MOVED: Player History inside the center border */}
          <div style={{ position: 'absolute', bottom: '5px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {renderHistoryTrail(myHistory)}
          </div>
        </div>

        {/* BOTTOM: YOU */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div style={{ minHeight: '20px', marginBottom: '10px' }} />
          <div style={{ minHeight: 'clamp(3rem, 6vh, 4.5rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            {phase === 'picking' && !myChoice ? (
              <>
                <button className="play-button" onClick={() => handleChoice('rock')}>🪨</button>
                <button className="play-button" onClick={() => handleChoice('paper')}>📄</button>
                <button className="play-button" onClick={() => handleChoice('scissors')}>✂️</button>
              </>
            ) : (
              <span style={{ fontSize: 'clamp(3rem, 6vh, 4.5rem)' }}>{myChoice ? getEmoji(myChoice) : ''}</span>
            )}
          </div>
          <p style={{ margin: '10px 0 0 0', color: 'var(--label-text)', textAlign: 'center' }}>Score: {myScore}</p>
          <h2 className="player-text" style={{ marginTop: '5px' }}>{myName} (You)</h2>
        </div>
      </div>

      <div className="controls" style={{ marginTop: '20px', width: '100%', maxWidth: '600px' }}>
        {phase === 'gameover' && (
          <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
            <button 
              className="primary-button" 
              style={{ flex: 1, padding: '15px', fontSize: '1.1rem', backgroundColor: 'var(--accent)' }} 
              onClick={handleShare}
            >
              Share Results
            </button>
            <button 
              className="secondary-button" 
              style={{ flex: 1, padding: '15px', fontSize: '1.1rem' }} 
              onClick={() => window.location.reload()}
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}