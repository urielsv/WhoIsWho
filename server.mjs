import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const DEFAULT_PORT = 3030;

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

function getAsksRespondsPair(room) {
  const activePlayers = room.players.filter(p => !p.hasFinished);
  if (activePlayers.length < 2) {
    return activePlayers;
  }
  
  // Rotate through pairs: (0,1), (1,2), (2,3), (3,0), etc.
  const pairIndex = room.asksRespondsPairIndex % activePlayers.length;
  const nextIndex = (pairIndex + 1) % activePlayers.length;
  
  return [activePlayers[pairIndex], activePlayers[nextIndex]];
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
      // Validate username
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }
      if (username.trim().length > 30) {
        socket.emit('error', { message: 'Username must be 30 characters or less' });
        return;
      }
      
      // Validate room name
      if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
        socket.emit('error', { message: 'Room name is required' });
        return;
      }
      if (roomName.trim().length > 30) {
        socket.emit('error', { message: 'Room name must be 30 characters or less' });
        return;
      }
      
      // Validate options
      if (!options || !Array.isArray(options) || options.length < 2) {
        socket.emit('error', { message: 'At least 2 options are required' });
        return;
      }
      if (options.length > 50) {
        socket.emit('error', { message: 'Maximum 50 options allowed' });
        return;
      }
      
      // Validate each option text length
      for (const optionText of options) {
        if (typeof optionText !== 'string' || optionText.trim().length === 0) {
          socket.emit('error', { message: 'All options must be non-empty strings' });
          return;
        }
        if (optionText.trim().length > 30) {
          socket.emit('error', { message: `Option "${optionText.substring(0, 20)}..." exceeds 30 characters` });
          return;
        }
      }
      
      const roomId = generateId();
      const playerId = socket.id;
      
      const player = {
        id: playerId,
        username: username.trim(),
        isAdmin: true,
        isReady: false,
      };
      
      const gameOptions = options.map((text, index) => ({
        id: `opt-${index}`,
        text: text.trim(),
        eliminated: false,
      }));
      
      const room = {
        id: roomId,
        name: roomName,
        players: [player],
        options: gameOptions, // Master list of all options
        // NEW STRUCTURE: Each player has their own private boards for tracking other players
        // Map<playerId, Map<targetPlayerId, GameOption[]>>
        playerBoards: new Map(), // Player's private boards for each other player
        gameStarted: false,
        currentTurnPlayerId: null,
        gamePhase: 'lobby',
        secretAssignments: {},
        asksRespondsPairIndex: 0, // Track which pair is currently active (rotates through players)
        turnsSinceRotation: 0, // Track turns to rotate pair
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
      // Validate username
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }
      if (username.trim().length > 30) {
        socket.emit('error', { message: 'Username must be 30 characters or less' });
        return;
      }
      
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
      
      // Validate max players (4)
      if (room.players.length >= 4) {
        socket.emit('error', { message: 'Room is full (maximum 4 players)' });
        return;
      }
      
      const player = {
        id: socket.id,
        username: username.trim(),
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
      room.asksRespondsPairIndex = 0; // Start with first pair
      room.turnsSinceRotation = 0;
      
      // Initialize per-player PRIVATE boards (one board for each OTHER player)
      for (const player of room.players) {
        const playerBoardsMap = new Map();
        
        // Create a private board for each OTHER player (not for self)
        for (const targetPlayer of room.players) {
          if (targetPlayer.id !== player.id) {
            // Each board starts with fresh copies of all options
            const boardOptions = room.options.map(opt => ({ 
              ...opt,
              state: 'normal',
              discardedForPlayerId: null
            }));
            playerBoardsMap.set(targetPlayer.id, boardOptions);
          }
        }
        
        room.playerBoards.set(player.id, playerBoardsMap);
        player.hasFinished = false;
        player.guessedOptionId = null;
        player.notes = '';
        player.guesses = {}; // Per-board final guesses: { targetPlayerId: optionId }
        player.boardStatus = {}; // Per-board status: { targetPlayerId: 'guessed' | 'gaveUp' | null }
      }
      
      // Send secret assignments and initial boards to each player
      for (const player of room.players) {
        const secretOptionId = room.secretAssignments[player.id];
        const playerBoardsMap = room.playerBoards.get(player.id);
        
        // Convert Map to object for transmission
        const boardsObject = {};
        if (playerBoardsMap) {
          for (const [targetId, options] of playerBoardsMap.entries()) {
            boardsObject[targetId] = options;
          }
        }
        
        io.to(player.id).emit('secretAssigned', { optionId: secretOptionId });
        io.to(player.id).emit('playerBoards', { boards: boardsObject });
      }
      
      io.to(normalizedRoomId).emit('gameStarted');
      
      // Notify about initial asks/responds pair
      const initialPair = getAsksRespondsPair(room);
      if (initialPair.length >= 2) {
        io.to(normalizedRoomId).emit('pairRotated', {
          player1: initialPair[0].username,
          player2: initialPair[1].username
        });
      }
      
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
      
      // After question, immediately move to next player (asks/responds style)
      // No elimination phase - players can discard anytime
      const player = room.players.find(p => p.id === socket.id);
      io.to(normalizedRoomId).emit('questionAsked', { 
        playerId: socket.id,
        playerName: player?.username || 'Unknown'
      });
      
      // Increment turn counter and check if we should rotate pair
      room.turnsSinceRotation = (room.turnsSinceRotation || 0) + 1;
      const TURNS_PER_PAIR = 6; // Each pair gets 6 turns before rotating
      
      if (room.turnsSinceRotation >= TURNS_PER_PAIR) {
        // Rotate to next pair
        room.asksRespondsPairIndex = (room.asksRespondsPairIndex || 0) + 1;
        room.turnsSinceRotation = 0;
        
        // Notify players about pair rotation
        const newPair = getAsksRespondsPair(room);
        if (newPair.length >= 2) {
          io.to(normalizedRoomId).emit('pairRotated', {
            player1: newPair[0].username,
            player2: newPair[1].username
          });
        }
      }
      
      // Auto-advance to next player for faster gameplay (asks/responds style)
      const asksRespondsPlayers = getAsksRespondsPair(room);
      if (asksRespondsPlayers.length >= 2) {
        const currentIndex = asksRespondsPlayers.findIndex(p => p.id === room.currentTurnPlayerId);
        const nextIndex = (currentIndex + 1) % asksRespondsPlayers.length;
        room.currentTurnPlayerId = asksRespondsPlayers[nextIndex].id;
      } else if (asksRespondsPlayers.length === 1) {
        room.currentTurnPlayerId = asksRespondsPlayers[0].id;
      }
      
      room.gamePhase = 'question'; // Stay in question phase for continuous flow
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('cycleOptionState', ({ roomId, optionId, targetPlayerId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.hasFinished) return;
      
      // Get the player's PRIVATE board for the target player
      const playerBoardsMap = room.playerBoards.get(socket.id);
      if (!playerBoardsMap) return;
      
      const targetBoard = playerBoardsMap.get(targetPlayerId);
      if (!targetBoard) return;
      
      const option = targetBoard.find(o => o.id === optionId);
      if (!option || option.eliminated) return;
      
      // Simple toggle: normal -> discarded -> normal
      if (!option.state || option.state === 'normal') {
        // First click: mark as discarded
        option.state = 'discarded';
        option.discardedForPlayerId = targetPlayerId;
      } else if (option.state === 'discarded') {
        // Second click: back to normal (easy undo)
        option.state = 'normal';
        option.discardedForPlayerId = null;
      }
      
      // Send updated board back to this player only (private)
      io.to(socket.id).emit('boardUpdated', { 
        targetPlayerId, 
        options: targetBoard 
      });
    });
    
    socket.on('makeGuessForPlayer', ({ roomId, targetPlayerId, optionId, confirmation }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      // Don't allow guessing for yourself
      if (targetPlayerId === socket.id) {
        socket.emit('error', { message: "You can't guess your own option" });
        return;
      }
      
      // Check if this board is already finished
      if (player.boardStatus && player.boardStatus[targetPlayerId]) {
        socket.emit('error', { message: 'This board is already finished' });
        return;
      }
      
      // Require confirmation for final guess
      if (confirmation !== 'CONFIRMED') {
        socket.emit('error', { message: 'Confirmation required for final guess' });
        return;
      }
      
      // Validate target player exists
      const targetPlayer = room.players.find(p => p.id === targetPlayerId);
      if (!targetPlayer) {
        socket.emit('error', { message: 'Target player not found' });
        return;
      }
      
      // Validate option exists
      const option = room.options.find(o => o.id === optionId);
      if (!option) {
        socket.emit('error', { message: 'Option not found' });
        return;
      }
      
      // Store the final guess for this board
      if (!player.guesses) {
        player.guesses = {};
      }
      if (!player.boardStatus) {
        player.boardStatus = {};
      }
      player.guesses[targetPlayerId] = optionId;
      player.boardStatus[targetPlayerId] = 'guessed';
      
      // Broadcast to room (so others can see you finished this board)
      io.to(normalizedRoomId).emit('boardFinished', {
        playerId: socket.id,
        playerName: player.username,
        targetPlayerId,
        targetPlayerName: targetPlayer.username,
        status: 'guessed'
      });
      
      // Check if player has finished all boards
      checkPlayerFinished(player, room, normalizedRoomId, io);
      
      // Confirm to the player who made the guess
      socket.emit('guessConfirmed', {
        targetPlayerId,
        optionId
      });
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('giveUpOnBoard', ({ roomId, targetPlayerId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      // Don't allow giving up on yourself
      if (targetPlayerId === socket.id) {
        socket.emit('error', { message: "You can't give up on your own board" });
        return;
      }
      
      // Check if this board is already finished
      if (player.boardStatus && player.boardStatus[targetPlayerId]) {
        socket.emit('error', { message: 'This board is already finished' });
        return;
      }
      
      // Validate target player exists
      const targetPlayer = room.players.find(p => p.id === targetPlayerId);
      if (!targetPlayer) {
        socket.emit('error', { message: 'Target player not found' });
        return;
      }
      
      // Mark this board as given up
      if (!player.boardStatus) {
        player.boardStatus = {};
      }
      player.boardStatus[targetPlayerId] = 'gaveUp';
      
      // Broadcast to room
      io.to(normalizedRoomId).emit('boardFinished', {
        playerId: socket.id,
        playerName: player.username,
        targetPlayerId,
        targetPlayerName: targetPlayer.username,
        status: 'gaveUp'
      });
      
      // Check if player has finished all boards
      checkPlayerFinished(player, room, normalizedRoomId, io);
      
      io.to(normalizedRoomId).emit('roomUpdate', {
        players: room.players,
        options: room.options,
        gamePhase: room.gamePhase,
        currentTurnPlayerId: room.currentTurnPlayerId,
        roomName: room.name,
      });
    });
    
    socket.on('bulkDiscard', ({ roomId, optionIds, targetPlayerId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.hasFinished) return;
      
      // Get the player's PRIVATE board for the target player
      const playerBoardsMap = room.playerBoards.get(socket.id);
      if (!playerBoardsMap) return;
      
      const targetBoard = playerBoardsMap.get(targetPlayerId);
      if (!targetBoard) return;
      
      // Bulk discard multiple options at once on this private board
      for (const optionId of optionIds) {
        const option = targetBoard.find(o => o.id === optionId);
        if (option && !option.eliminated) {
          option.state = 'discarded';
          option.discardedForPlayerId = targetPlayerId;
        }
      }
      
      // Send updated board back to this player only (private)
      io.to(socket.id).emit('boardUpdated', { 
        targetPlayerId, 
        options: targetBoard 
      });
    });
    
    socket.on('nextTurn', ({ roomId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      // Asks/responds style: alternate between current pair of active players
      const asksRespondsPlayers = getAsksRespondsPair(room);
      if (asksRespondsPlayers.length < 2) {
        // If only one player left, just cycle to them
        if (asksRespondsPlayers.length === 1) {
          room.currentTurnPlayerId = asksRespondsPlayers[0].id;
          room.gamePhase = 'question';
        }
      } else {
        // Alternate between the current asks/responds pair
        const currentIndex = asksRespondsPlayers.findIndex(p => p.id === room.currentTurnPlayerId);
        const nextIndex = (currentIndex + 1) % asksRespondsPlayers.length;
        room.currentTurnPlayerId = asksRespondsPlayers[nextIndex].id;
        room.gamePhase = 'question';
      }
      
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
    
    // Helper function to check if a player has finished all their boards
    function checkPlayerFinished(player, room, normalizedRoomId, io) {
      const otherPlayers = room.players.filter(p => p.id !== player.id);
      const allBoardsFinished = otherPlayers.every(targetPlayer => {
        return player.boardStatus && player.boardStatus[targetPlayer.id];
      });
      
      if (allBoardsFinished && !player.hasFinished) {
        player.hasFinished = true;
        io.to(normalizedRoomId).emit('playerFinishedAllBoards', {
          playerId: player.id,
          playerName: player.username
        });
        
        // Check if all players finished
        checkGameEnd(room, normalizedRoomId, io);
      }
    }
    
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
    
    socket.on('getPlayerBoard', ({ roomId, targetPlayerId }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return;
      
      // Get the requesting player's PRIVATE board for the target player
      const playerBoardsMap = room.playerBoards.get(socket.id);
      if (!playerBoardsMap) return;
      
      const targetBoard = playerBoardsMap.get(targetPlayerId);
      if (!targetBoard) return;
      
      // Send the player's private board for this target (already filtered to this player)
      io.to(socket.id).emit('boardUpdated', { 
        targetPlayerId,
        options: targetBoard 
      });
    });
    
    function checkGameEnd(room, normalizedRoomId, io) {
      const allFinished = room.players.every(p => p.hasFinished);
      if (allFinished) {
        room.gamePhase = 'finished';
        
        // Build game results - for each player, show their guesses for each other player
        const gameResults = [];
        
        for (const player of room.players) {
          for (const targetPlayer of room.players) {
            if (targetPlayer.id === player.id) continue; // Skip self
            
            const actualSecretId = room.secretAssignments[targetPlayer.id];
            const actualSecret = room.options.find(o => o.id === actualSecretId);
            const guessedOptionId = player.guesses?.[targetPlayer.id] || null;
            const guessedOption = guessedOptionId 
              ? room.options.find(o => o.id === guessedOptionId)
              : null;
            const isCorrect = guessedOptionId === actualSecretId;
            const boardStatus = player.boardStatus?.[targetPlayer.id] || null;
            
            gameResults.push({
              playerId: player.id,
              playerName: player.username,
              targetPlayerId: targetPlayer.id,
              targetPlayerName: targetPlayer.username,
              actualSecretId,
              actualSecretText: actualSecret?.text || 'Unknown',
              guessedOptionId,
              guessedOptionText: guessedOption?.text || null,
              isCorrect,
              gaveUp: boardStatus === 'gaveUp',
              status: boardStatus
            });
          }
        }
        
        // Calculate stats
        const totalGuesses = gameResults.filter(r => r.status === 'guessed').length;
        const correctGuesses = gameResults.filter(r => r.isCorrect).length;
        const gaveUp = gameResults.filter(r => r.gaveUp).length;
        
        const stats = {
          totalPlayers: room.players.length,
          totalBoards: gameResults.length,
          totalGuesses,
          correctGuesses,
          gaveUp
        };
        
        io.to(normalizedRoomId).emit('gameFinished', {
          results: gameResults,
          stats
        });
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
      
      if (roomName.trim().length > 30) {
        socket.emit('error', { message: 'Room name must be 30 characters or less' });
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
      
      if (optionText.trim().length > 30) {
        socket.emit('error', { message: 'Option text must be 30 characters or less' });
        return;
      }
      
      // Validate max options (50)
      if (room.options.length >= 50) {
        socket.emit('error', { message: 'Maximum 50 options allowed' });
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

