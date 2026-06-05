import { useState } from 'react';
import GameArena from './GameArena';
import DailyArena from './DailyArena'; 
import { supabase } from './utils/supabaseClient';
import './global.css';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [inDaily, setInDaily] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [format, setFormat] = useState(3);
  
  const [isHost, setIsHost] = useState(false); 
  const [isJoining, setIsJoining] = useState(false);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const handleCreateGame = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    setIsHost(true);
    setInGame(true);
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    if (!roomCode.trim() || roomCode.length !== 5) return alert("Please enter a valid 5-letter room code!");

    setIsJoining(true);
    const checkRoom = supabase.channel(`room_${roomCode.toUpperCase()}`);
    let isLobbyActive = false;

    checkRoom.on('broadcast', { event: 'sync_format' }, () => {
      isLobbyActive = true;
    });

    checkRoom.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await checkRoom.send({ type: 'broadcast', event: 'ping_lobby', payload: {} });
        setTimeout(() => {
          supabase.removeChannel(checkRoom); 
          setIsJoining(false);
          if (isLobbyActive) {
            setIsHost(false);
            setInGame(true); 
          } else {
            alert("Lobby not found! Make sure the host is currently in the room.");
          }
        }, 2500); 
      }
    });
  };

  if (inGame) return <GameArena roomCode={roomCode} myName={playerName} initialFormat={format} isHost={isHost} />;
  
  // Routes to the new solo Daily mode
  if (inDaily) return <DailyArena myName={playerName} />;

  return (
    <div className="container">
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 className="title" style={{ fontSize: '3rem', margin: '0 0 5px 0' }}>RochamDle</h1>
        <p style={{ color: 'var(--label-text)', margin: 0 }}>The Daily Global Challenge</p>
      </div>
      
      <div className="card">
        <input 
          className="input"
          type="text" 
          placeholder="Enter your name" 
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={12}
          style={{ marginBottom: '15px' }}
        />

        {/* MASSIVE DAILY BUTTON */}
        <button 
          className="primary-button" 
          style={{ backgroundColor: 'var(--win)', padding: '16px', fontSize: '1.2rem', marginBottom: '10px' }}
          onClick={() => {
            if (!playerName.trim()) return alert("Please enter a name first!");
            setInDaily(true);
          }}
        >
          Play Today's Challenge
        </button>

        <hr className="divider" style={{ margin: '20px 0' }} />

        {/* MULTIPLAYER TOGGLE */}
        {!showMultiplayer ? (
          <button 
            className="secondary-button" 
            onClick={() => setShowMultiplayer(true)}
          >
            Play with Friends
          </button>
        ) : (
          <div className="section" style={{ animation: 'fadeIn 0.3s ease' }}>
            <label className="label">Match Format:</label>
            <select 
              className="select" 
              value={format} 
              onChange={(e) => setFormat(Number(e.target.value))}
            >
              <option value={1}>Best of 1</option>
              <option value={3}>Best of 3</option>
              <option value={5}>Best of 5</option>
              <option value={7}>Best of 7</option>
            </select>
            <button className="primary-button" onClick={handleCreateGame}>
              Create Local Room
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
               <hr className="divider" style={{ flex: 1, margin: 0 }} />
               <span style={{ color: 'var(--label-text)', fontSize: '0.8rem' }}>OR</span>
               <hr className="divider" style={{ flex: 1, margin: 0 }} />
            </div>

            <input 
              className="input"
              type="text" 
              placeholder="Room Code (e.g. ABCDE)" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={5}
              style={{ marginBottom: '10px' }}
            />
            <button 
              className={`secondary-button ${isJoining ? 'loading-button' : ''}`} 
              onClick={handleJoinGame}
              disabled={isJoining}
            >
              {isJoining ? <span className="spinner"></span> : "Join Room"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}