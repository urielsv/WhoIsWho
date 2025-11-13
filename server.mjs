import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Game state
const rooms = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 9);
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
        options: gameOptions,
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
      });
    });
    
    socket.on('joinRoom', ({ roomId, username }) => {
      const room = rooms.get(roomId);
      
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
      socket.join(roomId);
      
      socket.emit('joined', {
        roomId,
        roomName: room.name,
        playerId: socket.id,
        isAdmin: false,
      });
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
      });
      
      io.to(roomId).emit('playerJoined', { player });
    });
    
    socket.on('toggleReady', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        
        io.to(roomId).emit('roomUpdate', {
          players: room.players,
          options: room.options,
          gamePhase: room.gamePhase,
          currentTurnPlayerId: room.currentTurnPlayerId,
        });
      }
    });
    
    socket.on('startGame', ({ roomId }) => {
      const room = rooms.get(roomId);
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
      
      // Send secret assignments to each player
      for (const player of room.players) {
        const secretOptionId = room.secretAssignments[player.id];
        io.to(player.id).emit('secretAssigned', { optionId: secretOptionId });
      }
      
      io.to(roomId).emit('gameStarted');
      io.to(roomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
      });
    });
    
    socket.on('askQuestion', ({ roomId, question }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      if (room.currentTurnPlayerId !== socket.id) return;
      
      room.gamePhase = 'elimination';
      
      io.to(roomId).emit('questionAsked', { 
        playerId: socket.id,
        question 
      });
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
      });
    });
    
    socket.on('eliminateOptions', ({ roomId, optionIds }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      for (const optionId of optionIds) {
        const option = room.options.find(o => o.id === optionId);
        if (option) {
          option.eliminated = true;
        }
      }
      
      io.to(roomId).emit('optionsEliminated', { optionIds });
      
      // Check if only one option remains
      const remainingOptions = room.options.filter(o => !o.eliminated);
      if (remainingOptions.length <= 1) {
        room.gamePhase = 'finished';
        io.to(roomId).emit('gameFinished');
      }
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
      });
    });
    
    socket.on('nextTurn', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      const currentIndex = room.players.findIndex(p => p.id === room.currentTurnPlayerId);
      const nextIndex = (currentIndex + 1) % room.players.length;
      room.currentTurnPlayerId = room.players[nextIndex].id;
      room.gamePhase = 'question';
      
      io.to(roomId).emit('turnChanged', { 
        currentTurnPlayerId: room.currentTurnPlayerId 
      });
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
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

