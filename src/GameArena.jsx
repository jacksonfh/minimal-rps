import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';

export default function GameArena({ roomCode, myName, format }) {
  // --- STATE DECLARATIONS ---
  const [phase, setPhase] = useState('waiting'); // 'waiting' | 'picking' | 'reveal' | 'result' | 'gameover'
  const channelRef = useRef(null); 
  
  const [isConnected, setIsConnected] = useState(false);
  const [imReady, setImReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const [opponentName, setOpponentName] = useState('Waiting for opponent...');
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundResult, setRoundResult] = useState('');

  const [timeLeft, setTimeLeft] = useState(30);
  const [revealTime, setRevealTime] = useState(3);

  const winsNeeded = Math.ceil(format / 2);

  // --- HELPER FUNCTIONS ---
  const getEmoji = (choice) => {
    const map = { rock: '✊', paper: '✋', scissors: '✌️', timeout: '⏳' };
    return map[choice] || '❓';
  };

  const renderNotches = (currentScore, isOpponent = false) => {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '5px' }}>
        {[...Array(winsNeeded)].map((_, i) => (
          <div 
            key={i} 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: i < currentScore ? (isOpponent ? '#ff4444' : '#8a2be2') : '#333',
              boxShadow: i < currentScore ? `0 0 8px ${isOpponent ? '#ff4444' : '#8a2be2'}` : 'none',
              transition: 'all 0.3s ease'
            }} 
          />
        ))}
      </div>
    );
  };

// --- DATABASE SAVING ---
  const saveMatchHistory = useCallback(async () => {
    console.log("I won! Saving match to database...");
    const { error } = await supabase
      .from('matches')
      .insert([
        {
          player_1_name: myName,
          player_2_name: opponentName,
          winner_name: myName,
          format: `Best of ${format}`
        }
      ]);

    if (error) {
      console.error("Error saving match:", error);
    } else {
      console.log("Match successfully recorded!");
    }
  }, [myName, opponentName, format]);


  // --- GAME LOGIC FUNCTIONS ---
  const handleReady = useCallback(async () => {
    if (!isConnected) return;
    setImReady(true);
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'player_ready',
        payload: { player: myName, ready: true }
      });
    }
  }, [myName, isConnected]);

  const handleChoice = useCallback(async (choice) => {
    if (myChoice || phase !== 'picking') return;
    
    setMyChoice(choice);
    
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'choice_locked',
        payload: { player: myName, choice: choice }
      });
    }
  }, [myChoice, phase, myName]);

  const calculateWinner = useCallback(() => {
    let newMyScore = myScore;
    let newOpponentScore = opponentScore;

    if (myChoice === opponentChoice) {
      setRoundResult('Tie!');
    } else if (
      (myChoice === 'rock' && opponentChoice === 'scissors') ||
      (myChoice === 'paper' && opponentChoice === 'rock') ||
      (myChoice === 'scissors' && opponentChoice === 'paper') ||
      (opponentChoice === 'timeout')
    ) {
      setRoundResult('You Win!');
      newMyScore += 1;
      setMyScore(newMyScore);
    } else {
      setRoundResult('You Lose!');
      newOpponentScore += 1;
      setOpponentScore(newOpponentScore);
    }

    // Check if the series is over!
    if (newMyScore >= winsNeeded) {
      saveMatchHistory(); // ONLY the winner saves to prevent duplicates
      setTimeout(() => setPhase('gameover'), 3500); // Wait 3.5s to show the hand, then Game Over screen
    } else if (newOpponentScore >= winsNeeded) {
      setTimeout(() => setPhase('gameover'), 3500);
    }
  }, [myChoice, opponentChoice, myScore, opponentScore, winsNeeded, saveMatchHistory]);


  // --- EFFECT HOOKS ---

  // 1. Supabase Connection
  useEffect(() => {
    const room = supabase.channel(`room_${roomCode}`);
    
    room.on('broadcast', { event: 'player_ready' }, (message) => {
      const data = message.payload;
      if (data.player !== myName) {
        setOpponentName(data.player);
        setOpponentReady(data.ready);
      }
    });

    room.on('broadcast', { event: 'choice_locked' }, (message) => {
      const data = message.payload;
      if (data.player !== myName) {
        setOpponentChoice(data.choice);
      }
    });

    room.subscribe((status) => {
      if (status === 'SUBSCRIBED') setIsConnected(true);
    });

    channelRef.current = room; 

    return () => supabase.removeChannel(room);
  }, [roomCode, myName]);

  // 2. Start Next Round
  useEffect(() => {
    if ((phase === 'waiting' || phase === 'result') && imReady && opponentReady) {
      const asyncTimer = setTimeout(() => {
        setMyChoice(null);
        setOpponentChoice(null);
        setTimeLeft(30);
        setRevealTime(3);
        setRoundResult('');
        setImReady(false);
        setOpponentReady(false);
        setPhase('picking');
      }, 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [phase, imReady, opponentReady]);

  // 3. Picking Timer
  useEffect(() => {
    if (phase !== 'picking') return;
    if (timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timerId);
    }
    if (timeLeft === 0) {
      const asyncTimer = setTimeout(() => {
        if (!myChoice) handleChoice('timeout');
      }, 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [timeLeft, phase, myChoice, handleChoice]);

  // 4. Phase Transition
  useEffect(() => {
    if (phase === 'picking' && myChoice && opponentChoice) {
      const asyncTimer = setTimeout(() => setPhase('reveal'), 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [myChoice, opponentChoice, phase]);

  // 5. Reveal Timer
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealTime > 0) {
      const timerId = setInterval(() => setRevealTime((prev) => prev - 1), 1000);
      return () => clearInterval(timerId);
    }
    if (revealTime === 0) {
      const asyncTimer = setTimeout(() => {
        calculateWinner();
        // NOTE: We only transition to 'result' here if the game ISN'T over. 
        // calculateWinner handles the transition to 'gameover' if someone hits the max score.
        setPhase('result');
      }, 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [revealTime, phase, calculateWinner]);

  // --- UI RENDERING ---
  return (
    <div className="container">
      <div className="header">
        <p onClick={() => setShowCode(!showCode)} style={{ cursor: 'pointer', userSelect: 'none', margin: 0, padding: '5px' }} title="Click to reveal/hide room code">
          Room Code: <strong>{showCode ? roomCode : '•••••'}</strong> <span style={{fontSize: '0.8rem', color: '#666'}}>👁️</span>
        </p>
        <p style={{ margin: 0, padding: '5px' }}>Best of {format}</p>
      </div>

      <div className="arena">
        <div style={{ textAlign: 'center' }}>
          <h2 className="player-text">{opponentName}</h2>
          {renderNotches(opponentScore, true)}
        </div>

        <p style={{ color: '#aaa', margin: '10px 0' }}>
          {(phase === 'waiting' || phase === 'result') && (opponentReady ? "🟢 Ready!" : "🔴 Not Ready")}
          {phase === 'picking' && (opponentChoice ? "🔒 Locked In!" : "⏳ Waiting...")}
          {phase === 'gameover' && "Game Over"}
        </p>
        
        <div className="center-area">
          {phase === 'waiting' && <h1 className="vs" style={{ fontSize: '2rem', color: '#aaa' }}>WAITING ROOM</h1>}
          {phase === 'picking' && <h1 className="vs" style={{ color: timeLeft <= 5 ? '#ff4444' : '#fff' }}>{timeLeft}s</h1>}
          {phase === 'reveal' && <h1 className="vs" style={{ color: '#8a2be2', fontSize: '4rem' }}>{revealTime}</h1>}

          {(phase === 'result' || phase === 'gameover') && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              {phase === 'gameover' ? (
                 <h1 className="vs" style={{ color: myScore >= winsNeeded ? '#00e676' : '#ff4444', fontSize: '3rem', marginBottom: '10px' }}>
                   {myScore >= winsNeeded ? 'MATCH WON!' : 'MATCH LOST!'}
                 </h1>
              ) : (
                <h1 className="vs" style={{ color: roundResult === 'Tie!' ? '#ffeb3b' : (roundResult === 'You Win!' ? '#00e676' : '#ff4444'), marginBottom: '10px' }}>
                  {roundResult}
                </h1>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', margin: '20px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '4rem' }}>{getEmoji(opponentChoice)}</span>
                  <span style={{ color: '#aaa', fontSize: '0.8rem' }}>Them</span>
                </div>
                <h1 className="vs" style={{ fontSize: '2rem', color: '#333' }}>VS</h1>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '4rem' }}>{getEmoji(myChoice)}</span>
                  <span style={{ color: '#aaa', fontSize: '0.8rem' }}>You</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p style={{ color: '#aaa', margin: '10px 0' }}>
          {(phase === 'waiting' || phase === 'result') && (imReady ? "🟢 Ready!" : "🔴 Not Ready")}
          {phase === 'picking' && (myChoice ? "🔒 Locked In!" : "")}
        </p>

        <div style={{ textAlign: 'center' }}>
          <h2 className="player-text">{myName}</h2>
          {renderNotches(myScore, false)}
        </div>
      </div>

      <div className="controls">
        {(phase === 'waiting' || phase === 'result') && (
          <button 
            className="primary-button" 
            style={{ width: '100%', padding: '20px', fontSize: '1.5rem', opacity: (!isConnected || imReady) ? 0.5 : 1 }} 
            onClick={handleReady}
            disabled={!isConnected || imReady}
          >
            {!isConnected ? 'Connecting...' : (imReady ? 'Waiting on Opponent...' : 'I Am Ready!')}
          </button>
        )}

        {(phase === 'picking' || phase === 'reveal') && (
          <>
            <button className="play-button" onClick={() => handleChoice('rock')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'rock' ? 0.3 : 1 }}>✊ Rock</button>
            <button className="play-button" onClick={() => handleChoice('paper')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'paper' ? 0.3 : 1 }}>✋ Paper</button>
            <button className="play-button" onClick={() => handleChoice('scissors')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'scissors' ? 0.3 : 1 }}>✌️ Scissors</button>
          </>
        )}

        {phase === 'gameover' && (
          <button 
            className="secondary-button" 
            style={{ width: '100%', padding: '20px', fontSize: '1.5rem' }} 
            // Reloading the window is the cleanest way to clear all WebSockets and React State to start fresh!
            onClick={() => window.location.reload()} 
          >
            Back to Lobby
          </button>
        )}
      </div>
    </div>
  );
}