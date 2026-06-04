import { useState } from 'react';
import GameArena from './GameArena';
import './global.css';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [format, setFormat] = useState(3);
  
  // 1. Add the isHost state
  const [isHost, setIsHost] = useState(false); 

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
    setIsHost(true); // 2. Creator is the Host
    setInGame(true);
  };

  const handleJoinGame = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    if (!roomCode.trim() || roomCode.length !== 5) return alert("Please enter a valid 5-letter room code!");
    setIsHost(false); // 3. Joiner is the Guest
    setInGame(true);
  };

  if (inGame) {
    return (
      <GameArena 
        roomCode={roomCode.toUpperCase()} 
        myName={playerName} 
        initialFormat={format} // 4. Rename to initialFormat
        isHost={isHost}        // 5. Pass the Host status
      />
    );
  }

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

        <div className="section">
          <label className="label">Match Format:</label>
          <select 
            className="select" 
            value={format} 
            onChange={(e) => setFormat(Number(e.target.value))}
          >
            {/* Added Best of 1 here! */}
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
          <button className="secondary-button" onClick={handleJoinGame}>
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}