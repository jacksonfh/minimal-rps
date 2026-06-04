import { useState } from 'react';

import GameArena from './GameArena';
import './global.css';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [format, setFormat] = useState(3); // Default Best of 3

  // Helper to generate a random 5-letter room code
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
    setInGame(true);
  };

  const handleJoinGame = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    if (!roomCode.trim() || roomCode.length !== 5) return alert("Please enter a valid 5-letter room code!");
    setInGame(true);
  };

  // If the user has joined a game, render the GameArena.
  // Otherwise, render the Lobby.
  if (inGame) {
    return (
      <GameArena 
        roomCode={roomCode.toUpperCase()} 
        myName={playerName} 
        format={format} 
      />
    );
  }

  // --- LOBBY UI ---
  return (
    <div className="container">
      <h1 className="title">Minimal RPS</h1>
      
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

        {/* CREATE GAME SECTION */}
        <div className="section">
          <label className="label">Match Format:</label>
          <select 
            className="select" 
            value={format} 
            onChange={(e) => setFormat(Number(e.target.value))}
          >
            <option value={3}>Best of 3</option>
            <option value={5}>Best of 5</option>
            <option value={7}>Best of 7</option>
          </select>
          <button className="primary-button" onClick={handleCreateGame}>
            Create Game
          </button>
        </div>

        <hr className="divider" />

        {/* JOIN GAME SECTION */}
        <div className="section">
          <input 
            className="input"
            type="text" 
            placeholder="Room Code (e.g. ABCDE)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={5}
          />
          <button className="secondary-button" onClick={handleJoinGame}>
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}