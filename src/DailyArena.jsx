import { useState, useEffect, useCallback } from 'react';
import { getEmoji, getRevealText, renderTimeline, renderHistoryTrail, getDailySequence } from './utils/gameUtils';

export default function DailyArena({ myName }) {
  const format = 5; 
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

  const handleChoice = (choice) => {
    if (myChoice || phase !== 'picking') return;
    setMyChoice(choice);
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
      }, 2500); 
      return () => clearTimeout(asyncTimer);
    }
  }, [phase]);

  const handleShare = () => {
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;
    const title = `RochamDle - ${dateStr}\n`;
    
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
    <div className="container">
      {notification && <div className="rematch-notification">{notification}</div>}

      <div className="arena-header" style={{ justifyContent: 'center' }}>
        <span style={{ color: 'var(--main-text)', fontWeight: 'bold' }}>Daily Challenge (Best of 5)</span>
      </div>

      <div className="arena">
        {/* TOP: GLOBAL OPPONENT */}
        <div className="player-area">
          <h2 className="player-text">The Globe 🌍</h2>
          <p className="score-text">Score: {opponentScore}</p>
          
          <div className="choice-container">
            <span className="choice-emoji">
              {(phase === 'result' || phase === 'gameover') ? getEmoji(opponentChoice) : (opponentChoice ? '🔒' : '❔')}
            </span>
          </div>
          
          <p className="status-text"></p>

          <div className="history-top">
            {renderHistoryTrail(opponentHistory, matchHistory, format)}
          </div>
        </div>

        {/* MIDDLE: TIMELINE */}
        <div className="center-area">
          <div style={{ marginBottom: '10px', width: '100%' }}>
            {renderTimeline(matchHistory, format)}
          </div>
          
          <div className="center-text-wrapper">
            {phase === 'picking' && <h1 style={{ fontSize: 'clamp(1.5rem, 4vh, 2.5rem)', margin: 0, color: 'var(--main-text)' }}>Make your move...</h1>}
            {phase === 'reveal' && <h1 style={{ fontSize: 'clamp(2rem, 4vh, 3rem)', margin: 0, color: 'var(--accent)' }}>{getRevealText(revealTime)}</h1>}
            {(phase === 'result' || phase === 'gameover') && (
               <h1 style={{ 
                 color: phase === 'gameover' ? (myScore >= winsNeeded ? 'var(--win)' : 'var(--loss)') : (roundResult === 'Tie!' ? 'var(--tie)' : (roundResult === 'You Win!' ? 'var(--win)' : 'var(--loss)')), 
                 fontSize: phase === 'gameover' ? 'clamp(2rem, 5vh, 2.5rem)' : 'clamp(2rem, 5vh, 3rem)',
                 margin: 0
               }}>
                 {phase === 'gameover' ? (myScore >= winsNeeded ? 'DAILY WON!' : 'DAILY LOST!') : roundResult}
               </h1>
            )}
          </div>
        </div>

        {/* BOTTOM: YOU */}
        <div className="player-area">
          <div className="history-bottom">
            {renderHistoryTrail(myHistory, matchHistory, format)}
          </div>

          <p className="status-text"></p>

          <div className="choice-container">
            {phase === 'picking' && !myChoice ? (
              <>
                <button className="play-button" onClick={() => handleChoice('rock')}>🪨</button>
                <button className="play-button" onClick={() => handleChoice('paper')}>📄</button>
                <button className="play-button" onClick={() => handleChoice('scissors')}>✂️</button>
              </>
            ) : (
              <span className="choice-emoji">{myChoice ? getEmoji(myChoice) : ''}</span>
            )}
          </div>

          <p className="score-text">Score: {myScore}</p>
          <h2 className="player-text">{myName} (You)</h2>
        </div>
      </div>

      <div className="controls">
        {phase === 'gameover' && (
          <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
            <button className="primary-button" style={{ flex: 1 }} onClick={handleShare}>
              Share Results
            </button>
            <button className="secondary-button" style={{ flex: 1 }} onClick={() => window.location.reload()}>
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}