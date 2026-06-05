import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';

export default function GameArena({ roomCode, myName, initialFormat, isHost }) {
  const [phase, setPhase] = useState('waiting'); 
  const channelRef = useRef(null); 
  
  const [currentFormat, setCurrentFormat] = useState(initialFormat);
  const winsNeeded = Math.ceil(currentFormat / 2);

  const [isConnected, setIsConnected] = useState(false);
  const [imReady, setImReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  
  const imReadyRef = useRef(false);
  useEffect(() => {
    imReadyRef.current = imReady;
  }, [imReady]);

  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false); 

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
  const [revealTime, setRevealTime] = useState(4);

  const [notification, setNotification] = useState(null);

  const getEmoji = (choice) => {
    const map = { rock: '🪨', paper: '📄', scissors: '✂️', timeout: '⏳' };
    return map[choice] || '❔';
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTimeline = () => {
    const tiesCount = matchHistory.filter(res => res === 'tie').length;
    const totalNotches = currentFormat + tiesCount;

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

  useEffect(() => {
    const room = supabase.channel(`room_${roomCode}`);

    room.on('broadcast', { event: 'ping_lobby' }, () => {
      if (isHost) {
        // Now includes hostReady!
        room.send({ type: 'broadcast', event: 'sync_format', payload: { format: currentFormat, hostName: myName, hostReady: imReadyRef.current } });
      }
    });

    room.on('broadcast', { event: 'guest_joined' }, (message) => {
      if (isHost) {
        const guest = message.payload.guestName || 'Someone';
        setOpponentName(guest);
        // Sync guest ready state just in case
        setNotification(`${guest} joined the lobby!`);
        setTimeout(() => setNotification(null), 3000);
        // Include hostReady!
        room.send({ type: 'broadcast', event: 'sync_format', payload: { format: currentFormat, hostName: myName, hostReady: imReadyRef.current } });
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
      if (!isHost) {
        setCurrentFormat(message.payload.format);
        if (message.payload.hostName) {
          setOpponentName((prev) => {
            if (prev === 'Waiting for opponent...') {
              setNotification(`Joined ${message.payload.hostName}'s lobby!`);
              setTimeout(() => setNotification(null), 3000);
            }
            return message.payload.hostName;
          });
        }
        if (message.payload.hostReady !== undefined) {
          setOpponentReady(message.payload.hostReady);
        }
      }
    });

    room.on('broadcast', { event: 'player_forfeited' }, (message) => {
      if (message.payload.player !== myName) {
        setRoundResult('Opponent Left!');
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

  useEffect(() => {
    if (isConnected && channelRef.current) {
      if (isHost) {
        channelRef.current.send({ 
          type: 'broadcast', 
          event: 'sync_format', 
          payload: { format: currentFormat, hostName: myName, hostReady: imReadyRef.current } 
        });
      } else {
        channelRef.current.send({ 
          type: 'broadcast', 
          event: 'guest_joined', 
          payload: { guestName: myName, guestReady: imReadyRef.current } 
        });
      }
    }
  }, [isConnected, isHost, currentFormat, myName]);

  useEffect(() => {
  if ((phase === 'waiting' || phase === 'result') && imReady && opponentReady) {
    const asyncTimer = setTimeout(() => {
      setMyChoice(null);
      setOpponentChoice(null);
      setTimeLeft(30);
      setRevealTime(4);
      setRoundResult('');
      setImReady(false);
      setOpponentReady(false);
      setPhase('picking');
    }, 0);
    return () => clearTimeout(asyncTimer);
  }
  }, [phase, imReady, opponentReady]);

  useEffect(() => {
    if (phase === 'picking' && myChoice && opponentChoice) {
      setPhase('reveal');
      setRevealTime(4);
    }
  }, [myChoice, opponentChoice, phase]);

  // --- NEW: Robust Timer ---
  // Continuously ticks down while in the picking phase
  useEffect(() => {
    if (phase === 'picking') {
      const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, timeLeft]);

  // Checks time limits and forces action if someone disconnects
  useEffect(() => {
    if (phase === 'picking') {
      // Normal timeout for you
      if (timeLeft === 0 && !myChoice) {
        handleChoice('timeout');
      }
      // Dead man's switch: If it's been 3 seconds past 0 and the opponent still 
      // hasn't responded (due to lag or locking their phone), force them to timeout.
      if (timeLeft <= -3 && !opponentChoice) {
        setOpponentChoice('timeout');
      }
    }
  }, [phase, timeLeft, myChoice, opponentChoice, handleChoice]);
  // -------------------------

useEffect(() => {
    if (phase === 'reveal') {
      if (revealTime >= 0) { // Changed to >= 0 to allow "Shoot!" to render
        const t = setTimeout(() => setRevealTime(revealTime - 1), 700); // 700ms feels like a real chant
        return () => clearTimeout(t);
      } else {
        calculateWinner();
      }
    }
  }, [phase, revealTime, calculateWinner]);

  // Add this new helper function right below that useEffect
  const getRevealText = () => {
    switch (revealTime) {
      case 3: return "Rock...";
      case 2: return "Paper...";
      case 1: return "Scissors...";
      case 0: return "Shoot!";
      default: return "";
    }
  };

  useEffect(() => {
    if (phase === 'gameover' && imRematchReady && opponentRematchReady) {
      setTimeout(() => {
        setMyScore(0);
        setOpponentScore(0);
        setMatchHistory([]);
        setRoundResult('');
        setMyChoice(null);
        setOpponentChoice(null);
        setImReady(false);
        setOpponentReady(false);
        setImRematchReady(false);
        setOpponentRematchReady(false);
        setPhase('waiting');
      }, 1000);
    }
  }, [phase, imRematchReady, opponentRematchReady]);

  useEffect(() => {
    const handleWindowClose = () => {
      if (channelRef.current) {
        // Attempt to send a parting message to the opponent
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_forfeited',
          payload: { player: myName }
        });
      }
    };

    window.addEventListener('beforeunload', handleWindowClose);
    return () => window.removeEventListener('beforeunload', handleWindowClose);
  }, [myName]);

  return (
    <div className="container" style={{ position: 'relative' }}>
      
      {/* NEW: GENERIC FLOATING NOTIFICATION */}
      {notification && (
        <div className="rematch-notification">
          {notification}
        </div>
      )}

      {/* FLOATING REMATCH NOTIFICATION */}
      {opponentRematchReady && !imRematchReady && phase === 'gameover' && (
        <div className="rematch-notification">
          Opponent requested a rematch!
        </div>
      )}

      {/* MENU DROPDOWN */}
      {showMenu && (
        <div className="menu-dropdown">
          <button className="disabled-link">Leaderboard (Soon)</button>
          <button className="disabled-link">Account (Soon)</button>
          <hr className="divider" style={{ margin: '5px 0' }} />
          <button className="leave-match" onClick={handleForfeit}>
            Leave Match
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="arena-header">
        <div>
          Room: {' '}
          {showCode ? (
            <span style={{ color: 'var(--main-text)', fontWeight: 'bold' }}>{roomCode}</span>
          ) : (
            <span style={{ color: 'var(--code-text)', letterSpacing: '2px' }}>•••••</span>
          )}
        </div>
        <div className="header-controls">
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} 
            onClick={() => setShowCode(!showCode)}
            title={showCode ? "Hide Code" : "Show Code"}
          >
            {showCode ? '🙈' : '👁️'}
          </button>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} 
            onClick={handleCopyCode}
            title="Copy Code"
          >
            {copied ? '✅' : '📋'}
          </button>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} 
            onClick={() => setShowMenu(!showMenu)}
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="arena">
        
        {/* TOP: OPPONENT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <h2 className="player-text" style={{ marginBottom: '5px' }}>{opponentName}</h2>
          <p style={{ margin: '0 0 10px 0', color: 'var(--label-text)', textAlign: 'center' }}>Score: {opponentScore}</p>
          
          {/* Removed the question mark, leaving it blank until locked */}
          <span style={{ fontSize: 'clamp(3rem, 6vh, 4.5rem)', minHeight: '1.2em', display: 'flex', alignItems: 'center' }}>
            {(phase === 'result' || phase === 'gameover') ? getEmoji(opponentChoice) : (opponentChoice ? '🔒' : '')}
          </span>
          
          <p style={{ color: 'var(--label-text)', marginTop: '10px', minHeight: '20px' }}>
             {(phase === 'waiting' || phase === 'result') && (opponentReady ? "🟢 Ready!" : "")}
          </p>
        </div>

        {/* MIDDLE: TIMELINE & TIMERS */}
        <div className="center-area" style={{ width: '100%', borderTop: '1px solid var(--input-border)', borderBottom: '1px solid var(--input-border)', margin: '10px 0', flexDirection: 'column', padding: '15px 0' }}>
          
          <div style={{ marginBottom: '15px', width: '100%' }}>
            {renderTimeline()}
          </div>

          {phase === 'waiting' && <p style={{ color: 'var(--label-text)', margin: 0 }}>Waiting for players to ready up...</p>}
          
          {phase === 'picking' && <h1 style={{ fontSize: 'clamp(2.5rem, 6vh, 4rem)', margin: 0, color: timeLeft <= 5 ? 'var(--loss)' : 'var(--main-text)' }}>{Math.max(0, timeLeft)}s</h1>}
          
          {/* Implement the new Rock, Paper, Scissors, Shoot text! */}
          {phase === 'reveal' && (
            <h1 style={{ fontSize: 'clamp(2rem, 5vh, 3.5rem)', margin: 0, color: 'var(--accent)' }}>
              {getRevealText()}
            </h1>
          )}
          
          {(phase === 'result' || phase === 'gameover') && (
             <h1 className="vs" style={{ 
               color: phase === 'gameover' ? (myScore >= winsNeeded ? 'var(--win)' : 'var(--loss)') : (roundResult === 'Tie!' ? 'var(--tie)' : (roundResult === 'You Win!' ? 'var(--win)' : 'var(--loss)')), 
               fontSize: phase === 'gameover' ? 'clamp(2rem, 5vh, 2.5rem)' : 'clamp(2rem, 5vh, 3rem)',
               margin: 0
             }}>
               {phase === 'gameover' ? (myScore >= winsNeeded ? 'MATCH WON!' : 'MATCH LOST!') : roundResult}
             </h1>
          )}
        </div>

        {/* BOTTOM: PLAYER AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <p style={{ color: 'var(--label-text)', marginBottom: '10px', minHeight: '20px' }}>
             {(phase === 'waiting' || phase === 'result') && (imReady ? "🟢 Ready!" : "")}
          </p>
          
          {/* New Interactive Choice Area */}
          <div style={{ minHeight: 'clamp(3rem, 6vh, 4.5rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            {phase === 'picking' && !myChoice ? (
              <>
                <button className="play-button" onClick={() => handleChoice('rock')}>🪨</button>
                <button className="play-button" onClick={() => handleChoice('paper')}>📄</button>
                <button className="play-button" onClick={() => handleChoice('scissors')}>✂️</button>
              </>
            ) : (
              <span style={{ fontSize: 'clamp(3rem, 6vh, 4.5rem)' }}>
                {myChoice ? getEmoji(myChoice) : ''}
              </span>
            )}
          </div>

          <p style={{ margin: '10px 0 0 0', color: 'var(--label-text)', textAlign: 'center' }}>Score: {myScore}</p>
          <h2 className="player-text" style={{ marginTop: '5px' }}>{myName} (You)</h2>
        </div>

        {/* CONTROLS (Play buttons removed from here) */}
        <div className="controls">
          {(phase === 'waiting' || phase === 'result') && (
            <button 
              className="primary-button" 
              onClick={handleReady}
              disabled={imReady || !isConnected}
              style={{ width: '100%', maxWidth: '300px', opacity: imReady ? 0.5 : 1 }}
            >
              {!isConnected ? 'Connecting...' : (imReady ? 'Waiting for Opponent...' : 'I Am Ready!')}
            </button>
          )}

          {phase === 'gameover' && (
            <div style={{ display: 'flex', gap: '15px', width: '100%', maxWidth: '300px' }}>
              <button 
                className="primary-button" 
                style={{ flex: 1, padding: '15px', fontSize: '1.1rem', opacity: imRematchReady ? 0.5 : 1 }} 
                onClick={handleRematch}
                disabled={imRematchReady}
              >
                {imRematchReady ? 'Waiting...' : 'Rematch'}
              </button>
              <button 
                className="secondary-button" 
                style={{ flex: 1, padding: '15px', fontSize: '1.1rem' }} 
                onClick={handleForfeit}
              >
                Leave
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};