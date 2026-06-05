import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';
import { getEmoji, getRevealText, renderTimeline, renderHistoryTrail } from './utils/gameUtils';

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

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
  const [myHistory, setMyHistory] = useState([]);
  const [opponentHistory, setOpponentHistory] = useState([]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const handleShare = () => {
    const title = `RochamDle - Best of ${currentFormat}\n`;
    const score = `${myName}: ${myScore} | ${opponentName}: ${opponentScore}\n`;
    const emojiTimeline = matchHistory.map(res => {
      if (res === 'win') return '🟢';
      if (res === 'lose') return '🔴';
      return '🟡';
    }).join('');
    
    navigator.clipboard.writeText(`${title}${score}${emojiTimeline}`);
    setNotification('Results copied to clipboard! 📋');
    setTimeout(() => setNotification(null), 3000);
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

    setMyHistory(prev => [...prev, myChoice]);
    setOpponentHistory(prev => [...prev, opponentChoice]);

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
        room.send({ type: 'broadcast', event: 'sync_format', payload: { format: currentFormat, hostName: myName, hostReady: imReadyRef.current } });
      }
    });

    room.on('broadcast', { event: 'guest_joined' }, (message) => {
      if (isHost) {
        const guest = message.payload.guestName || 'Someone';
        setOpponentName(guest);
        setNotification(`${guest} joined the lobby!`);
        setTimeout(() => setNotification(null), 3000);
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
        if (phaseRef.current === 'picking' || phaseRef.current === 'reveal' || phaseRef.current === 'result') {
          setRoundResult('Opponent Forfeited!');
          setMyScore(winsNeeded);
          setPhase('gameover');
          saveMatchHistory();
          setNotification("Opponent left! You win by default.");
          setTimeout(() => setNotification(null), 3000);
        } else if (phaseRef.current === 'gameover') {
          setNotification("Opponent left the lobby.");
          setTimeout(() => setNotification(null), 3000);
          setOpponentName("Opponent Left");
        } else {
          setNotification(`${message.payload.player} left the lobby.`);
          setTimeout(() => setNotification(null), 3000);
          setOpponentName('Waiting for opponent...');
          setOpponentReady(false);
          setImReady(false); 
        }
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

  useEffect(() => {
    if (phase === 'picking') {
      const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase === 'picking') {
      if (timeLeft === 0 && !myChoice) handleChoice('timeout');
      if (timeLeft <= -3 && !opponentChoice) setOpponentChoice('timeout');
    }
  }, [phase, timeLeft, myChoice, opponentChoice, handleChoice]);

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
    if (phase === 'gameover' && imRematchReady && opponentRematchReady) {
      setTimeout(() => {
        setMyScore(0);
        setOpponentScore(0);
        setMatchHistory([]);
        setMyHistory([]);         
        setOpponentHistory([]);
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
    <div className="container">
      {opponentRematchReady && !imRematchReady && phase === 'gameover' && (
        <div className="rematch-notification">Opponent requested a rematch!</div>
      )}
      
      {notification && <div className="rematch-notification">{notification}</div>}

      {showMenu && (
        <div className="menu-dropdown">
          <button className="disabled-link">Leaderboard (Soon)</button>
          <button className="disabled-link">Account (Soon)</button>
          <hr className="divider" style={{ margin: '5px 0' }} />
          <button className="leave-match" onClick={handleForfeit}>Leave Match</button>
        </div>
      )}

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
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowCode(!showCode)}>
            {showCode ? '🙈' : '👁️'}
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={handleCopyCode}>
            {copied ? '✅' : '📋'}
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowMenu(!showMenu)}>
            ⚙️
          </button>
        </div>
      </div>

      <div className="arena">
        {/* TOP: OPPONENT AREA */}
        <div className="player-area">
          <h2 className="player-text">{opponentName}</h2>
          <p className="score-text">Score: {opponentScore}</p>
          
          <div className="choice-container">
             <span className="choice-emoji">
               {(phase === 'result' || phase === 'gameover') ? getEmoji(opponentChoice) : (opponentChoice ? '🔒' : '❔')}
             </span>
          </div>

          <p className="status-text">
             {(phase === 'waiting' || phase === 'result') && (opponentReady ? "🟢 Ready!" : "")}
          </p>

          <div className="history-top">
            {renderHistoryTrail(opponentHistory, matchHistory, currentFormat)}
          </div>
        </div>

        {/* MIDDLE: TIMELINE & TIMERS */}
        <div className="center-area">
          <div style={{ marginBottom: '10px', width: '100%' }}>
            {renderTimeline(matchHistory, currentFormat)}
          </div>
          
          <div className="center-text-wrapper">
            {phase === 'waiting' && <p style={{ color: 'var(--label-text)', margin: 0 }}>Waiting for players to ready up...</p>}
            {phase === 'picking' && <h1 style={{ fontSize: 'clamp(2.5rem, 5vh, 3.5rem)', margin: 0, color: timeLeft <= 5 ? 'var(--loss)' : 'var(--main-text)' }}>{Math.max(0, timeLeft)}s</h1>}
            {phase === 'reveal' && <h1 style={{ fontSize: 'clamp(2rem, 4vh, 3rem)', margin: 0, color: 'var(--accent)' }}>{getRevealText(revealTime)}</h1>}
            {(phase === 'result' || phase === 'gameover') && (
               <h1 style={{ 
                 color: phase === 'gameover' ? (myScore >= winsNeeded ? 'var(--win)' : 'var(--loss)') : (roundResult === 'Tie!' ? 'var(--tie)' : (roundResult === 'You Win!' ? 'var(--win)' : 'var(--loss)')), 
                 fontSize: phase === 'gameover' ? 'clamp(2rem, 5vh, 2.5rem)' : 'clamp(2rem, 5vh, 3rem)',
                 margin: 0
               }}>
                 {phase === 'gameover' ? (myScore >= winsNeeded ? 'MATCH WON!' : 'MATCH LOST!') : roundResult}
               </h1>
            )}
          </div>
        </div>

        {/* BOTTOM: PLAYER AREA */}
        <div className="player-area">
          <div className="history-bottom">
            {renderHistoryTrail(myHistory, matchHistory, currentFormat)}
          </div>

          <p className="status-text">
             {(phase === 'waiting' || phase === 'result') && (imReady ? "🟢 Ready!" : "")}
          </p>
          
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
        {(phase === 'waiting' || phase === 'result') && (
          <button 
            className="primary-button" 
            onClick={handleReady}
            disabled={imReady || !isConnected || opponentName === 'Waiting for opponent...'}
            style={{ opacity: (imReady || opponentName === 'Waiting for opponent...') ? 0.5 : 1 }}
          >
            {!isConnected 
              ? 'Connecting...' 
              : (opponentName === 'Waiting for opponent...' 
                  ? 'Waiting for player to join...' 
                  : (imReady ? 'Waiting for Opponent...' : 'I Am Ready!'))}
          </button>
        )}

        {phase === 'gameover' && (
          <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
            <button 
              className="rematch-button" 
              style={{ flex: 1, opacity: (imRematchReady || opponentName === 'Opponent Left') ? 0.5 : 1 }} 
              onClick={handleRematch}
              disabled={imRematchReady || opponentName === 'Opponent Left'}
            >
              {opponentName === 'Opponent Left' ? 'No Rematch' : (imRematchReady ? 'Waiting...' : 'Rematch')}
            </button>
            <button className="share-button" style={{ flex: 1}} onClick={handleShare}>
              Share
            </button>
            <button className="secondary-button" style={{ flex: 1 }} onClick={handleForfeit}>
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}