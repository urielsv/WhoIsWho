import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const DEFAULT_PORT = 3000;

function parsePort(value) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function getPortFromArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-p' || arg === '--port') {
      const value = args[index + 1];
      const parsed = parsePort(value);
      if (parsed !== undefined) {
        return parsed;
      }
    } else if (arg.startsWith('--port=')) {
      const value = arg.substring('--port='.length);
      const parsed = parsePort(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

const port = getPortFromArgs(process.argv.slice(2)) ?? parsePort(process.env.PORT) ?? DEFAULT_PORT;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Game state
const rooms = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

function normalizeRoomId(roomId) {
  return roomId?.toUpperCase() || roomId;
}

function assignSecrets(room) {
  const availableOptions = [...room.options];
  const assignments = {};
  
  for (const player of room.players) {
    if (availableOptions.length === 0) break;
    const randomIndex = Math.floor(Math.random() * availableOptions.length);
    const option = availableOptions.splice(randomIndex, 1)[0];
    assignments[player.id] = option.id;
  }
  
  return assignments;
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('createRoom', ({ roomName, username, options }) => {
      const roomId = generateId();
      const playerId = socket.id;
      
      const player = {
        id: playerId,
        username,
        isAdmin: true,
        isReady: false,
      };
      
      const gameOptions = options.map((text, index) => ({
        id: `opt-${index}`,
        text,
        eliminated: false,
      }));
      
      const room = {
        id: roomId,
        name: roomName,
        players: [player],
        options: gameOptions, // Master list of all options
        playerOptions: new Map(), // Per-player options: Map<playerId, GameOption[]>
        gameStarted: false,
        currentTurnPlayerId: null,
        gamePhase: 'lobby',
        secretAssignments: {},
      };
      
      rooms.set(roomId, room);
      socket.join(roomId);
      
      socket.emit('roomCreated', {
        roomId,
        roomName,
        playerId,
        isAdmin: true,
      });
      
      socket.emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('joinRoom', ({ roomId, username }) => {
      // Normalize roomId to uppercase for case-insensitive lookup
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: 'Game already started' });
        return;
      }
      
      const player = {
        id: socket.id,
        username,
        isAdmin: false,
        isReady: false,
      };
      
      room.players.push(player);
      socket.join(normalizedRoomId);
      
      socket.emit('joined', {
        roomId: normalizedRoomId,
        roomName: room.name,
        playerId: socket.id,
        isAdmin: false,
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
      
      io.to(normalizedRoomId).emit('playerJoined', { player });
    });
    
    socket.on('toggleReady', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        
        io.to(normalizedRoomId).emit('roomUpdate', {
          players: room.players,
          options: room.options,
          gamePhase: room.gamePhase,
          currentTurnPlayerId: room.currentTurnPlayerId,
          roomName: room.name,
        });
      }
    });
    
    socket.on('startGame', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const admin = room.players.find(p => p.id === socket.id);
      if (!admin || !admin.isAdmin) return;
      
      if (room.players.length < 2) {
        socket.emit('error', { message: 'Need at least 2 players' });
        return;
      }
      
      room.gameStarted = true;
      room.gamePhase = 'question';
      room.currentTurnPlayerId = room.players[0].id;
      room.secretAssignments = assignSecrets(room);
      
      // Initialize per-player options (each player gets a copy of all options)
      for (const player of room.players) {
        const playerOptionsCopy = room.options.map(opt => ({ ...opt }));
        room.playerOptions.set(player.id, playerOptionsCopy);
        player.hasFinished = false;
        player.guessedOptionId = null;
        player.notes = '';
      }
      
      // Send secret assignments to each player
      for (const player of room.players) {
        const secretOptionId = room.secretAssignments[player.id];
        const playerOptions = room.playerOptions.get(player.id);
        io.to(player.id).emit('secretAssigned', { optionId: secretOptionId });
        io.to(player.id).emit('playerOptions', { options: playerOptions });
      }
      
      io.to(normalizedRoomId).emit('gameStarted');
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options, // Master list for reference
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('askQuestion', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      if (room.currentTurnPlayerId !== socket.id) return;
      if (room.gamePhase !== 'question') return;
      
      room.gamePhase = 'elimination';
      
      const player = room.players.find(p => p.id === socket.id);
      io.to(normalizedRoomId).emit('questionAsked', { 
        playerId: socket.id,
        playerName: player?.username || 'Unknown'
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('eliminateOptions', ({ roomId, optionIds }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      // Only non-turn players can eliminate options
      if (room.currentTurnPlayerId === socket.id) {
        socket.emit('error', { message: 'You cannot eliminate options on your turn' });
        return;
      }
      
      if (room.gamePhase !== 'elimination') {
        socket.emit('error', { message: 'Can only eliminate options after a question is asked' });
        return;
      }
      
      const playerOptions = room.playerOptions.get(socket.id);
      if (!playerOptions) return;
      
      // Eliminate options for this player only
      for (const optionId of optionIds) {
        const option = playerOptions.find(o => o.id === optionId);
        if (option) {
          option.eliminated = true;
        }
      }
      
      // Send updated options to this player
      io.to(socket.id).emit('playerOptions', { options: playerOptions });
      
      io.to(normalizedRoomId).emit('optionsEliminated', { 
        playerId: socket.id,
        optionIds 
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('nextTurn', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      // Find next player who hasn't finished
      const currentIndex = room.players.findIndex(p => p.id === room.currentTurnPlayerId);
      let nextIndex = (currentIndex + 1) % room.players.length;
      let attempts = 0;
      
      // Skip finished players
      while (room.players[nextIndex].hasFinished && attempts < room.players.length) {
        nextIndex = (nextIndex + 1) % room.players.length;
        attempts++;
      }
      
      room.currentTurnPlayerId = room.players[nextIndex].id;
      room.gamePhase = 'question';
      
      io.to(normalizedRoomId).emit('turnChanged', { 
        currentTurnPlayerId: room.currentTurnPlayerId 
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
      
      // Check if all players finished
      checkGameEnd(room, normalizedRoomId, io);
    });
    
    socket.on('makeGuess', ({ roomId, optionId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      if (player.hasFinished) {
        socket.emit('error', { message: 'You have already finished' });
        return;
      }
      
      player.hasFinished = true;
      player.guessedOptionId = optionId;
      
      io.to(normalizedRoomId).emit('playerGuessed', {
        playerId: socket.id,
        playerName: player.username,
        optionId
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
      
      // Check if all players finished
      checkGameEnd(room, normalizedRoomId, io);
    });
    
    socket.on('giveUp', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      if (player.hasFinished) {
        socket.emit('error', { message: 'You have already finished' });
        return;
      }
      
      player.hasFinished = true;
      player.guessedOptionId = null;
      
      io.to(normalizedRoomId).emit('playerGaveUp', {
        playerId: socket.id,
        playerName: player.username
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
      
      // Check if all players finished
      checkGameEnd(room, normalizedRoomId, io);
    });
    
    socket.on('updateNotes', ({ roomId, notes }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.notes = notes || '';
        // Notes are private, no need to broadcast
      }
    });
    
    function checkGameEnd(room, normalizedRoomId, io) {
      const allFinished = room.players.every(p => p.hasFinished);
      if (allFinished) {
        room.gamePhase = 'finished';
        io.to(normalizedRoomId).emit('gameFinished');
        io.to(normalizedRoomId).emit('roomUpdate', {
          players: room.players,
          options: room.options,
          gamePhase: room.gamePhase,
          currentTurnPlayerId: room.currentTurnPlayerId,
          roomName: room.name,
        });
      }
    }
    
    // Admin settings handlers
    socket.on('updateRoomName', ({ roomId, roomName }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      const admin = room.players.find(p => p.id === socket.id);
      if (!admin || !admin.isAdmin) {
        socket.emit('error', { message: 'Only admin can update room name' });
        return;
      }
      
      if (!roomName || roomName.trim().length === 0) {
        socket.emit('error', { message: 'Room name cannot be empty' });
        return;
      }
      
      room.name = roomName.trim();
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('addOption', ({ roomId, optionText }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: 'Cannot modify options after game started' });
        return;
      }
      
      const admin = room.players.find(p => p.id === socket.id);
      if (!admin || !admin.isAdmin) {
        socket.emit('error', { message: 'Only admin can add options' });
        return;
      }
      
      if (!optionText || optionText.trim().length === 0) {
        socket.emit('error', { message: 'Option text cannot be empty' });
        return;
      }
      
      const newOption = {
        id: `opt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        text: optionText.trim(),
        eliminated: false,
      };
      
      room.options.push(newOption);
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('removeOption', ({ roomId, optionId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: 'Cannot modify options after game started' });
        return;
      }
      
      const admin = room.players.find(p => p.id === socket.id);
      if (!admin || !admin.isAdmin) {
        socket.emit('error', { message: 'Only admin can remove options' });
        return;
      }
      
      const optionIndex = room.options.findIndex(o => o.id === optionId);
      if (optionIndex === -1) {
        socket.emit('error', { message: 'Option not found' });
        return;
      }
      
      if (room.options.length <= 1) {
        socket.emit('error', { message: 'Cannot remove last option' });
        return;
      }
      
      room.options.splice(optionIndex, 1);
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('kickPlayer', ({ roomId, playerIdToKick }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: 'Cannot kick players after game started' });
        return;
      }
      
      const admin = room.players.find(p => p.id === socket.id);
      if (!admin || !admin.isAdmin) {
        socket.emit('error', { message: 'Only admin can kick players' });
        return;
      }
      
      const playerToKick = room.players.find(p => p.id === playerIdToKick);
      if (!playerToKick) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      
      if (playerToKick.isAdmin) {
        socket.emit('error', { message: 'Cannot kick admin' });
        return;
      }
      
      // Remove player from room
      room.players = room.players.filter(p => p.id !== playerIdToKick);
      
      // Disconnect the player's socket
      io.to(playerIdToKick).emit('kicked', { message: 'You were kicked from the room' });
      io.sockets.sockets.get(playerIdToKick)?.leave(normalizedRoomId);
      
      // Broadcast update to remaining players
      io.to(normalizedRoomId).emit('playerLeft', { playerId: playerIdToKick });
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Remove player from all rooms
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);
          
          // If room is empty, delete it
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            // If disconnected player was admin, assign new admin
            if (player.isAdmin && room.players.length > 0) {
              room.players[0].isAdmin = true;
            }
            
            io.to(roomId).emit('playerLeft', { playerId: socket.id });
            io.to(roomId).emit('roomUpdate', {
              players: room.players,
              options: room.options,
              gamePhase: room.gamePhase,
              currentTurnPlayerId: room.currentTurnPlayerId,
              roomName: room.name,
            });
          }
        }
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

