import { useState } from 'react';
import GameArena from './GameArena';
import { supabase } from './utils/supabaseClient';
import './global.css';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [format, setFormat] = useState(3);
  
  const [isHost, setIsHost] = useState(false); 
  const [isJoining, setIsJoining] = useState(false);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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
        // Send a ping to check if lobby exists without triggering the host's alert yet
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
        }, 2500); // 2.5s gives mobile networks enough time to respond
      }
    });
  };

  if (inGame) {
    return (
      <GameArena 
        roomCode={roomCode} 
        myName={playerName} 
        initialFormat={format} 
        isHost={isHost} 
      />
    );
  }

  return (
    <div className="container">
      <h1 className="title" style={{ fontSize: '2.5rem', marginBottom: '20px' }}>Minimal RPS</h1>
      
      <div className="card">
        <input 
          className="input"
          type="text" 
          placeholder="Your Name" 
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={12}
        />

        <hr className="divider" />

        <div className="section">
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
            Create Game
          </button>
        </div>

        <hr className="divider" />

        <div className="section">
          <input 
            className="input"
            type="text" 
            placeholder="Room Code (e.g. ABCDE)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={5}
          />
          <button 
            className={`secondary-button ${isJoining ? 'loading-button' : ''}`} 
            onClick={handleJoinGame}
            disabled={isJoining}
          >
            {isJoining ? <span className="spinner"></span> : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
}