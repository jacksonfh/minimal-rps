import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';

export default function GameArena({ roomCode, myName, initialFormat, isHost }) {
  // --- STATE DECLARATIONS ---
  const [phase, setPhase] = useState('waiting'); 
  const channelRef = useRef(null); 
  
  const [currentFormat, setCurrentFormat] = useState(initialFormat);
  const winsNeeded = Math.ceil(currentFormat / 2);

  const [isConnected, setIsConnected] = useState(false);
  const [imReady, setImReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  
  // Header & Menu States
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false); 

  // Rematch States
  const [imRematchReady, setImRematchReady] = useState(false);
  const [opponentRematchReady, setOpponentRematchReady] = useState(false);

  const [opponentName, setOpponentName] = useState('Waiting for opponent...');
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [matchHistory, setMatchHistory] = useState([]); 
  const [roundResult, setRoundResult] = useState('');

  const [timeLeft, setTimeLeft] = useState(30);
  const [revealTime, setRevealTime] = useState(3);

  // --- HELPER FUNCTIONS ---
  const getEmoji = (choice) => {
    const map = { rock: '🪨', paper: '📄', scissors: '✂️', timeout: '⏳' };
    return map[choice] || '❔';
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // THE NEW TIMELINE LOGIC
  const renderTimeline = () => {
    // Base notches = format size (e.g., 3). Add 1 extra notch for every tie!
    const tiesCount = matchHistory.filter(res => res === 'tie').length;
    const totalNotches = currentFormat + tiesCount;

    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[...Array(totalNotches)].map((_, i) => {
          let color = 'var(--input-border)'; // Default empty/grey notch
          let hasShadow = false;

          // If this notch corresponds to a played round, color it
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
                width: '14px', 
                height: '14px', 
                borderRadius: '50%', 
                backgroundColor: color,
                boxShadow: hasShadow ? `0 0 8px ${color}` : 'none',
                transition: 'all 0.3s ease'
              }} 
            />
          );
        })}
      </div>
    );
  };

  // --- DATABASE SAVING ---
  const saveMatchHistory = useCallback(async () => {
    const { error } = await supabase
      .from('matches')
      .insert([{
          player_1_name: myName,
          player_2_name: opponentName,
          winner_name: myName,
          format: `Best of ${currentFormat}`
      }]);

    if (error) console.error("Error saving match:", error);
  }, [myName, opponentName, currentFormat]);

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

  const handleRematch = useCallback(async () => {
    if (!isConnected) return;
    setImRematchReady(true);
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'rematch_requested',
        payload: { player: myName }
      });
    }
  }, [myName, isConnected]);

  const handleForfeit = async () => {
    if (channelRef.current && isConnected) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'player_forfeited',
        payload: { player: myName }
      });
    }
    window.location.reload(); 
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
      (myChoice === 'scissors' && opponentChoice === 'paper') ||
      (opponentChoice === 'timeout')
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

    if (newMyScore >= winsNeeded) {
      saveMatchHistory(); 
      setPhase('gameover'); 
    } else if (newOpponentScore >= winsNeeded) {
      setPhase('gameover');
    } else {
      setPhase('result');
    }
  }, [myChoice, opponentChoice, myScore, opponentScore, winsNeeded, saveMatchHistory]);

  // --- EFFECT HOOKS ---
  useEffect(() => {
    const room = supabase.channel(`room_${roomCode}`);

    room.on('broadcast', { event: 'guest_joined' }, () => {
      if (isHost) {
        room.send({ type: 'broadcast', event: 'sync_format', payload: { format: currentFormat } });
      }
    });
    
    room.on('broadcast', { event: 'player_ready' }, (message) => {
      const data = message.payload;
      if (data.player !== myName) {
        setOpponentName(data.player);
        setOpponentReady(data.ready);
      }
    });

    room.on('broadcast', { event: 'choice_locked' }, (message) => {
      if (message.payload.player !== myName) setOpponentChoice(message.payload.choice);
    });

    room.on('broadcast', { event: 'rematch_requested' }, (message) => {
      if (message.payload.player !== myName) setOpponentRematchReady(true);
    });

    room.on('broadcast', { event: 'sync_format' }, (message) => {
      if (!isHost) setCurrentFormat(message.payload.format);
    });

    room.on('broadcast', { event: 'player_forfeited' }, (message) => {
      if (message.payload.player !== myName) {
        setRoundResult('Opponent Forfeited!');
        setMyScore(winsNeeded); 
        setPhase('gameover');
        saveMatchHistory(); 
      }
    });

    room.subscribe((status) => {
      if (status === 'SUBSCRIBED') setIsConnected(true);
    });

    channelRef.current = room; 
    return () => supabase.removeChannel(room);
  }, [roomCode, myName, isHost, currentFormat, winsNeeded, saveMatchHistory]);

  // Handle Synchronized Rematch
  useEffect(() => {
    if (phase === 'gameover' && imRematchReady && opponentRematchReady) {
      const asyncTimer = setTimeout(() => {
        setMyScore(0);
        setOpponentScore(0);
        setMatchHistory([]);
        setRoundResult('');
        setImReady(false);
        setOpponentReady(false);
        setImRematchReady(false);
        setOpponentRematchReady(false);
        setPhase('waiting');
      }, 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [phase, imRematchReady, opponentRematchReady]);

  // Handle Standard Round Start
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

  // Broadcast initial sync
  useEffect(() => {
    if (isConnected && channelRef.current) {
      if (isHost) {
        channelRef.current.send({ type: 'broadcast', event: 'sync_format', payload: { format: currentFormat } });
      } else {
        channelRef.current.send({ type: 'broadcast', event: 'guest_joined', payload: {} });
      }
    }
  }, [isConnected, isHost, currentFormat]);

  // Timers
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

  useEffect(() => {
    if (phase === 'picking' && myChoice && opponentChoice) {
      const asyncTimer = setTimeout(() => setPhase('reveal'), 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [myChoice, opponentChoice, phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealTime > 0) {
      const timerId = setInterval(() => setRevealTime((prev) => prev - 1), 1000);
      return () => clearInterval(timerId);
    }
    if (revealTime === 0) {
      const asyncTimer = setTimeout(() => {
        calculateWinner();
      }, 0);
      return () => clearTimeout(asyncTimer);
    }
  }, [revealTime, phase, calculateWinner]);

  // --- UI RENDERING ---
  return (
    <div className="container" style={{ position: 'relative' }}>
      
      {/* FLOATING REMATCH NOTIFICATION */}
      {opponentRematchReady && !imRematchReady && phase === 'gameover' && (
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          backgroundColor: 'var(--accent)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '20px',
          fontWeight: 'bold',
          zIndex: 50,
          boxShadow: 'var(--box-shadow)',
        }}>
          Opponent requested a rematch!
        </div>
      )}

      {/* HEADER: Cleaned up spacing */}
      <div className="header" style={{ alignItems: 'center', position: 'relative', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p onClick={() => setShowCode(!showCode)} style={{ cursor: 'pointer', userSelect: 'none', margin: 0, padding: '5px' }} title="Click to reveal/hide room code">
            Room Code: <strong style={{ display: 'inline-block', width: '60px', textAlign: 'center', letterSpacing: showCode ? '1px' : '3px' }}>
              {showCode ? roomCode : '•••••'}
            </strong> 
            <span style={{fontSize: '1rem', color: 'var(--label-text)'}}>&#128065;</span>
          </p>
          <button 
            onClick={handleCopyCode} 
            style={{ 
              background: 'none', 
              border: '1px solid var(--input-border)', 
              color: copied ? 'var(--win)' : 'var(--label-text)', 
              borderRadius: '4px', 
              padding: '4px 8px', 
              cursor: 'pointer', 
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        
        {/* RIGHT SIDE: Menu */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: 'var(--main-text)', fontSize: '1.5rem', cursor: 'pointer', padding: 0 }}>
            ☰
          </button>

          {showMenu && (
            <div style={{ 
              position: 'absolute', 
              top: '60px', 
              right: '20px', 
              backgroundColor: 'var(--card-bg)', 
              border: '1px solid var(--input-border)', 
              borderRadius: '8px', 
              padding: '10px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px', 
              zIndex: 100, 
              boxShadow: 'var(--box-shadow)' 
            }}>
              <button style={{ background: 'transparent', color: 'var(--main-text)', border: 'none', padding: '10px', cursor: 'pointer', textAlign: 'left', opacity: 0.5 }}>Leaderboard (Soon)</button>
              <button style={{ background: 'transparent', color: 'var(--main-text)', border: 'none', padding: '10px', cursor: 'pointer', textAlign: 'left', opacity: 0.5 }}>Account (Soon)</button>
              <hr style={{ border: '0', height: '1px', backgroundColor: 'var(--input-border)', margin: '5px 0' }} />
              <button onClick={handleForfeit} style={{ background: 'var(--loss)', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Leave Match
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="arena">
        
        {/* TOP: OPPONENT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <h2 className="player-text" style={{ marginBottom: '15px' }}>{opponentName}</h2>
          <span style={{ fontSize: '4.5rem' }}>
            {(phase === 'result' || phase === 'gameover') ? getEmoji(opponentChoice) : (opponentChoice ? '🔒' : '❔')}
          </span>
          <p style={{ color: 'var(--label-text)', marginTop: '10px', minHeight: '20px' }}>
             {(phase === 'waiting' || phase === 'result') && (opponentReady ? "🟢 Ready!" : "")}
          </p>
        </div>

        {/* MIDDLE: TIMELINE & TIMERS */}
        <div style={{ padding: '20px 0', textAlign: 'center', width: '100%', borderTop: '1px solid var(--input-border)', borderBottom: '1px solid var(--input-border)' }}>
          <div style={{ marginBottom: '15px' }}>
            {renderTimeline()}
          </div>
          
          <div style={{ minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'waiting' && <h1 className="vs" style={{ fontSize: '2rem', color: 'var(--label-text)' }}>WAITING ROOM</h1>}
            {phase === 'picking' && <h1 className="vs" style={{ color: timeLeft <= 5 ? 'var(--loss)' : 'var(--main-text)' }}>{timeLeft}s</h1>}
            {phase === 'reveal' && <h1 className="vs" style={{ color: 'var(--accent)', fontSize: '4rem' }}>{revealTime}</h1>}
            
            {(phase === 'result' || phase === 'gameover') && (
               <h1 className="vs" style={{ 
                 color: phase === 'gameover' ? (myScore >= winsNeeded ? 'var(--win)' : 'var(--loss)') : (roundResult === 'Tie!' ? 'var(--tie)' : (roundResult === 'You Win!' ? 'var(--win)' : 'var(--loss)')), 
                 fontSize: phase === 'gameover' ? '2.5rem' : '2.5rem',
                 margin: 0
               }}>
                 {phase === 'gameover' ? (myScore >= winsNeeded ? 'MATCH WON!' : 'MATCH LOST!') : roundResult}
               </h1>
            )}
          </div>
        </div>

        {/* BOTTOM: PLAYER AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <p style={{ color: 'var(--label-text)', marginBottom: '10px', minHeight: '20px' }}>
             {(phase === 'waiting' || phase === 'result') && (imReady ? "🟢 Ready!" : "")}
          </p>
          <span style={{ fontSize: '4.5rem' }}>
            {(phase === 'result' || phase === 'gameover') ? getEmoji(myChoice) : (myChoice ? getEmoji(myChoice) : '❔')}
          </span>
          <h2 className="player-text" style={{ marginTop: '15px' }}>{myName}</h2>
        </div>

      </div>

      {/* CONTROLS */}
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
            <button className="play-button" onClick={() => handleChoice('rock')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'rock' ? 0.3 : 1 }}>🪨</button>
            <button className="play-button" onClick={() => handleChoice('paper')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'paper' ? 0.3 : 1 }}>📄</button>
            <button className="play-button" onClick={() => handleChoice('scissors')} disabled={myChoice !== null} style={{ opacity: myChoice && myChoice !== 'scissors' ? 0.3 : 1 }}>✂️</button>
          </>
        )}

        {phase === 'gameover' && (
          <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
            <button 
              className="primary-button" 
              style={{ flex: 1, padding: '20px', fontSize: '1.2rem', opacity: imRematchReady ? 0.5 : 1 }} 
              onClick={handleRematch}
              disabled={imRematchReady}
            >
              {imRematchReady ? 'Waiting...' : 'Rematch'}
            </button>
            <button 
              className="secondary-button" 
              style={{ flex: 1, padding: '20px', fontSize: '1.2rem' }} 
              onClick={handleForfeit} 
            >
              Leave Lobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}