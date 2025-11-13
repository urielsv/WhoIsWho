import { create } from 'zustand';
import { Player, GameOption } from '@/types/game';

interface GameState {
  roomId: string | null;
  roomName: string | null;
  playerId: string | null;
  username: string | null;
  isAdmin: boolean;
  players: Player[];
  options: GameOption[]; // Master list for reference
  // NEW: Each player has private boards for tracking other players
  myBoards: Record<string, GameOption[]>; // Map of targetPlayerId -> options for that board
  gameStarted: boolean;
  gamePhase: 'lobby' | 'question' | 'elimination' | 'finished';
  currentTurnPlayerId: string | null;
  mySecretOption: string | null;
  lastQuestion: string | null;
  myNotes: string;
  myGuesses: Record<string, string>; // Map of targetPlayerId -> optionId
  
  setRoomInfo: (roomId: string, roomName: string, playerId: string, username: string, isAdmin: boolean) => void;
  setRoomName: (roomName: string) => void;
  setPlayers: (players: Player[]) => void;
  setOptions: (options: GameOption[]) => void;
  setMyBoards: (boards: Record<string, GameOption[]>) => void;
  updateBoard: (targetPlayerId: string, options: GameOption[]) => void;
  setGameStarted: (started: boolean) => void;
  setGamePhase: (phase: 'lobby' | 'question' | 'elimination' | 'finished') => void;
  setCurrentTurnPlayerId: (playerId: string | null) => void;
  setMySecretOption: (optionId: string | null) => void;
  setLastQuestion: (question: string | null) => void;
  setMyNotes: (notes: string) => void;
  setMyGuesses: (guesses: Record<string, string>) => void;
  addGuess: (targetPlayerId: string, optionId: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomId: null,
  roomName: null,
  playerId: null,
  username: null,
  isAdmin: false,
  players: [],
  options: [],
  myBoards: {},
  gameStarted: false,
  gamePhase: 'lobby',
  currentTurnPlayerId: null,
  mySecretOption: null,
  lastQuestion: null,
  myNotes: '',
  myGuesses: {},
  
  setRoomInfo: (roomId, roomName, playerId, username, isAdmin) => 
    set({ roomId, roomName, playerId, username, isAdmin }),
  setRoomName: (roomName) => set({ roomName }),
  setPlayers: (players) => set({ players }),
  setOptions: (options) => set({ options }),
  setMyBoards: (boards) => set({ myBoards: boards }),
  updateBoard: (targetPlayerId, options) => set((state) => ({
    myBoards: { ...state.myBoards, [targetPlayerId]: options }
  })),
  setGameStarted: (started) => set({ gameStarted: started }),
  setGamePhase: (phase) => set({ gamePhase: phase }),
  setCurrentTurnPlayerId: (playerId) => set({ currentTurnPlayerId: playerId }),
  setMySecretOption: (optionId) => set({ mySecretOption: optionId }),
  setLastQuestion: (question) => set({ lastQuestion: question }),
  setMyNotes: (notes) => set({ myNotes: notes }),
  setMyGuesses: (guesses) => set({ myGuesses: guesses }),
  addGuess: (targetPlayerId, optionId) => set((state) => ({
    myGuesses: { ...state.myGuesses, [targetPlayerId]: optionId }
  })),
  reset: () => set({
    roomId: null,
    roomName: null,
    playerId: null,
    username: null,
    isAdmin: false,
    players: [],
    options: [],
    myBoards: {},
    gameStarted: false,
    gamePhase: 'lobby',
    currentTurnPlayerId: null,
    mySecretOption: null,
    lastQuestion: null,
    myNotes: '',
    myGuesses: {},
  }),
}));

