export interface Player {
  id: string;
  username: string;
  isAdmin: boolean;
  isReady: boolean;
}

export interface GameOption {
  id: string;
  text: string;
  eliminated: boolean;
}

export interface GameRoom {
  id: string;
  name: string;
  players: Player[];
  options: GameOption[];
  gameStarted: boolean;
  currentTurnPlayerId: string | null;
  gamePhase: 'lobby' | 'question' | 'elimination' | 'finished';
  secretAssignments: Record<string, string>; // playerId -> optionId
}

export interface ClientMessage {
  type: 'join' | 'create' | 'start' | 'ready' | 'question' | 'eliminate' | 'nextTurn';
  roomId?: string;
  roomName?: string;
  username?: string;
  options?: string[];
  question?: string;
  eliminatedOptions?: string[];
}

export interface ServerMessage {
  type: 'roomCreated' | 'joined' | 'playerJoined' | 'playerLeft' | 
        'gameStarted' | 'roomUpdate' | 'error' | 'turnChanged' | 
        'optionsEliminated' | 'gameFinished';
  data?: any;
  error?: string;
}

