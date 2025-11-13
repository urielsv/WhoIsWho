# Who's Who Game - Development Documentation

## Project Overview

A real-time multiplayer guessing game built with Next.js 14, Socket.io, TypeScript, and shadcn/ui. This is a "Who's Who" style game where players are secretly assigned options and take turns asking yes/no questions to eliminate possibilities.

### Game Flow
1. **Home** → Player creates room (with options list) or joins existing room
2. **Lobby** → Players wait, see participant list, admin starts game
3. **Game** → Turn-based: ask question → eliminate options → next turn
4. **Finish** → Last remaining option wins

## Architecture

### Tech Stack
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety throughout
- **Socket.io**: Real-time WebSocket communication
- **Zustand**: Lightweight state management
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Pre-built accessible components
- **Lucide React**: Icon library

### Custom Server
Uses a custom Next.js server (`server.mjs`) to integrate Socket.io for real-time features. The server handles both HTTP requests (Next.js pages) and WebSocket connections (Socket.io).

**Why Custom Server?**
- Next.js alone doesn't support WebSocket connections
- Socket.io requires a persistent server instance
- Game state is stored in-memory on the server

### State Management Strategy

**Client State (Zustand)**
- Location: `lib/store.ts`
- Stores: room info, players, options, game phase, current turn, secret assignment
- Single source of truth for UI rendering
- Updated via Socket.io event handlers

**Server State (In-Memory Map)**
- Location: `server.mjs` (rooms Map)
- Stores: complete game rooms with all data
- Authoritative source for game logic
- Broadcasts updates to all clients in room

## File Structure & Responsibilities

### Core Application Files

#### `server.mjs`
**Purpose**: Custom Next.js server with Socket.io integration

**Key Functions:**
- `generateId()`: Creates random room IDs
- `assignSecrets()`: Randomly assigns options to players (one per player)

**Socket Events Handled:**
- `createRoom`: Initialize new game room with options
- `joinRoom`: Add player to existing room
- `toggleReady`: Toggle player ready state in lobby
- `startGame`: Begin game (admin only, assigns secrets)
- `askQuestion`: Current player asks question, changes phase to elimination
- `eliminateOptions`: Mark options as eliminated
- `nextTurn`: Move to next player, reset to question phase
- `disconnect`: Clean up player, reassign admin if needed

**Game State Structure:**
```javascript
{
  id: string,
  name: string,
  players: Player[],
  options: GameOption[],
  gameStarted: boolean,
  currentTurnPlayerId: string,
  gamePhase: 'lobby' | 'question' | 'elimination' | 'finished',
  secretAssignments: Record<playerId, optionId>
}
```

#### `lib/store.ts`
**Purpose**: Zustand store for client-side state management

**State Properties:**
- `roomId, roomName, playerId, username, isAdmin`: Session info
- `players`: Array of all players in room
- `options`: Array of all game options with elimination status
- `gameStarted`: Boolean flag
- `gamePhase`: Current phase of gameplay
- `currentTurnPlayerId`: Whose turn it is
- `mySecretOption`: This player's secret assignment
- `lastQuestion`: Most recent question asked

**Key Methods:**
- `setRoomInfo()`: Initialize room after create/join
- `setPlayers()`, `setOptions()`: Update from server
- `setGamePhase()`, `setCurrentTurnPlayerId()`: Game progression
- `reset()`: Clear all state (for leaving room)

#### `lib/socket.ts`
**Purpose**: Socket.io client singleton and React hook

**Pattern:**
- Singleton socket instance (created once, reused)
- `getSocket()`: Returns or creates socket connection
- `useSocket()`: React hook for components

**Connection:**
- URL: `http://localhost:3000`
- Transports: WebSocket (preferred) + polling (fallback)
- Persistent connection across page navigations

#### `types/game.ts`
**Purpose**: TypeScript type definitions

**Key Types:**
- `Player`: id, username, isAdmin, isReady
- `GameOption`: id, text, eliminated
- `GameRoom`: Complete room state (server-side)
- `ClientMessage`, `ServerMessage`: Socket event payloads

### Pages

#### `app/page.tsx` (Home)
**Route**: `/`

**Features:**
- Mode selection: Create or Join
- Create: username, room name, options (textarea, one per line)
- Join: username, room code input
- Validates minimum 2 options for creation

**Socket Events Emitted:**
- `createRoom`: { roomName, username, options: string[] }
- `joinRoom`: { roomId, username }

**Socket Events Listened:**
- `roomCreated`: Navigate to lobby
- `joined`: Navigate to lobby
- `error`: Display error message

**State Updates:**
- Calls `setRoomInfo()` on successful create/join
- Navigates to `/lobby/[roomId]`

#### `app/lobby/[roomId]/page.tsx` (Lobby)
**Route**: `/lobby/[roomId]`

**Features:**
- Displays room code with copy button
- Lists all players with admin crown icon
- Shows ready status for each player
- Displays game options list
- Admin: "Start Game" button (min 2 players)
- Non-admin: "Ready" toggle button

**Socket Events Emitted:**
- `toggleReady`: { roomId }
- `startGame`: { roomId }

**Socket Events Listened:**
- `roomUpdate`: Update players/options display
- `gameStarted`: Navigate to game
- `secretAssigned`: Store secret option
- `playerJoined`, `playerLeft`: Trigger room update

**Navigation:**
- Redirects to home if no playerId
- Navigates to game on start

#### `app/game/[roomId]/page.tsx` (Game)
**Route**: `/game/[roomId]`

**Features:**
- Displays current game phase and turn player
- Shows your secret option (highlighted in yellow)
- Grid of all options (eliminated are grayed/crossed out)
- Question phase: Input to ask question (if your turn)
- Elimination phase: Multi-select options + eliminate button
- "Next Turn" button to progress
- Sidebar: players list, how-to-play guide
- Finish state: Trophy screen with winner

**Game Phases:**

1. **Question Phase**
   - Current player enters question
   - Others wait
   - On submit: emit `askQuestion`, phase → elimination

2. **Elimination Phase**
   - Show last question asked
   - All players select options to eliminate
   - Click "Eliminate Selected" to remove options
   - Click "Next Turn" to move to next player

3. **Finished**
   - Triggered when ≤1 option remains
   - Shows winner screen
   - "Back to Home" button

**Socket Events Emitted:**
- `askQuestion`: { roomId, question }
- `eliminateOptions`: { roomId, optionIds: string[] }
- `nextTurn`: { roomId }

**Socket Events Listened:**
- `roomUpdate`: Update all game state
- `questionAsked`: Display question, clear input
- `turnChanged`: Reset UI for new turn
- `optionsEliminated`: Clear selections
- `gameFinished`: Show winner screen

**UI State (Local):**
- `question`: Current question input
- `selectedOptions`: Set of option IDs to eliminate
- `tempQuestion`: Backup of question text

### Components (shadcn/ui)

All in `components/ui/` directory:

- **button.tsx**: Primary action component (variants: default, outline, ghost, etc.)
- **card.tsx**: Container with header/content/footer sections
- **input.tsx**: Text input field
- **textarea.tsx**: Multi-line text input
- **label.tsx**: Form labels
- **badge.tsx**: Status indicators (Ready, Your Turn, etc.)

**Styling Pattern:**
- Uses `class-variance-authority` for variant management
- `cn()` utility merges Tailwind classes
- All use CSS variables from `globals.css`

### Styling

#### `app/globals.css`
- Tailwind base/components/utilities
- CSS variables for theming (light/dark mode ready)
- Color tokens: primary, secondary, destructive, etc.
- Border radius variables

#### `lib/utils.ts`
- `cn()`: Merges class names using `clsx` + `tailwind-merge`
- Prevents Tailwind class conflicts

## Game Logic Deep Dive

### Secret Assignment Algorithm
```javascript
function assignSecrets(room) {
  const availableOptions = [...room.options];
  const assignments = {};
  
  for (const player of room.players) {
    // Random selection without replacement
    const randomIndex = Math.floor(Math.random() * availableOptions.length);
    const option = availableOptions.splice(randomIndex, 1)[0];
    assignments[player.id] = option.id;
  }
  
  return assignments;
}
```

**Constraints:**
- Each player gets exactly one option
- No two players get the same option
- If more players than options, some players get none (edge case)

### Turn Rotation
```javascript
const currentIndex = room.players.findIndex(p => p.id === room.currentTurnPlayerId);
const nextIndex = (currentIndex + 1) % room.players.length;
room.currentTurnPlayerId = room.players[nextIndex].id;
```

**Pattern**: Round-robin using modulo arithmetic

### Game End Condition
```javascript
const remainingOptions = room.options.filter(o => !o.eliminated);
if (remainingOptions.length <= 1) {
  room.gamePhase = 'finished';
}
```

**Triggered**: After any elimination, checked automatically

## WebSocket Communication Patterns

### Room Broadcasting
```javascript
io.to(roomId).emit('eventName', data);
```
Sends to all clients in the room (including sender)

### Individual Messaging
```javascript
io.to(playerId).emit('eventName', data);
```
Sends to specific player (playerId === socket.id)

### Event Flow Examples

**Creating a Room:**
1. Client: `socket.emit('createRoom', { roomName, username, options })`
2. Server: Creates room, adds player, joins socket to room
3. Server: `socket.emit('roomCreated', { roomId, playerId, isAdmin })`
4. Server: `socket.emit('roomUpdate', { players, options, ... })`
5. Client: Updates store, navigates to lobby

**Starting a Game:**
1. Client: `socket.emit('startGame', { roomId })`
2. Server: Validates admin, assigns secrets
3. Server: Sends individual `secretAssigned` to each player
4. Server: `io.to(roomId).emit('gameStarted')`
5. Server: `io.to(roomId).emit('roomUpdate', ...)`
6. Clients: Store secrets, navigate to game

## Current Implementation Status

### ✅ Completed Features
- Room creation with custom options
- Room joining via code
- Lobby with player list
- Admin controls
- Ready system
- Secret assignment
- Turn-based question asking
- Collaborative elimination
- Round-robin turn rotation
- Game end detection
- Winner display
- Room code sharing (copy to clipboard)
- Responsive UI
- Real-time synchronization
- Player disconnect handling

### ⚠️ Known Limitations
1. **No Persistence**: Rooms stored in memory, lost on server restart
2. **No Authentication**: Just usernames, no password/verification
3. **No Chat**: Players can't communicate except questions
4. **No History**: Previous questions not tracked
5. **Basic Error Handling**: Limited validation and error messages
6. **No Reconnection**: Disconnected players can't rejoin same session
7. **Option/Player Mismatch**: If more players than options, some players get no secret
8. **No Mobile Optimization**: Works but not fully optimized for touch

## Potential Improvements

### High Priority
1. **Add Chat System**: Let players discuss strategy
2. **Question History**: Display all previous questions in sidebar
3. **Better Error Handling**: Validate inputs, handle edge cases
4. **Reconnection Support**: Allow players to rejoin after disconnect
5. **Mobile Responsiveness**: Touch-friendly UI, better grid layouts

### Medium Priority
6. **Database Integration**: Persist rooms (PostgreSQL/MongoDB)
7. **Game Settings**: Configurable timer, turn limits, etc.
8. **Spectator Mode**: Join rooms without playing
9. **Vote System**: Democratic elimination instead of individual choices
10. **Animations**: Smooth transitions for eliminated options

### Low Priority
11. **User Accounts**: Optional registration for stats
12. **Game History**: Track wins/losses
13. **Custom Themes**: Dark mode toggle, color schemes
14. **Sound Effects**: Audio feedback for actions
15. **Multiple Game Modes**: Team play, speed rounds, etc.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (with Socket.io)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Lint code
npm run lint
```

## Testing the App

### Single Machine Testing
1. Open `http://localhost:3000` in browser
2. Create a room (add options like "Option 1", "Option 2", etc.)
3. Copy room code
4. Open new incognito/private window
5. Join with the room code
6. Repeat step 4-5 for more players
7. Start game from first window (admin)

### Multi-Player Testing
Players on same network can connect to `http://<your-ip>:3000`

## Code Patterns & Conventions

### Component Structure
```typescript
'use client'; // All pages are client components (need hooks)

import { useState, useEffect } from 'react';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';

export default function PageName() {
  const socket = useSocket();
  const { stateVar, setStateVar } = useGameStore();
  
  useEffect(() => {
    if (!socket) return;
    
    const handler = (data) => { /* ... */ };
    socket.on('event', handler);
    
    return () => {
      socket.off('event', handler);
    };
  }, [socket, dependencies]);
  
  return (/* JSX */);
}
```

### Socket Event Naming
- Client → Server: camelCase verbs (`createRoom`, `askQuestion`)
- Server → Client: past tense or states (`roomCreated`, `questionAsked`, `roomUpdate`)

### Styling
- Use `cn()` for conditional classes
- Tailwind utility classes preferred
- Components use shadcn/ui base styles
- Responsive: mobile-first, then `md:`, `lg:` breakpoints

## Debugging Tips

### Check Socket Connection
```javascript
console.log('Socket connected:', socket?.connected);
socket?.on('connect', () => console.log('Connected!'));
socket?.on('disconnect', () => console.log('Disconnected!'));
```

### Inspect Room State (Server)
Add to `server.mjs`:
```javascript
socket.on('debugRoom', ({ roomId }) => {
  console.log('Room state:', rooms.get(roomId));
});
```

### Inspect Store State (Client)
Add to any component:
```javascript
const store = useGameStore();
console.log('Store state:', store);
```

### Common Issues

**Socket not connecting:**
- Check server is running (`npm run dev`)
- Verify port 3000 is free
- Check browser console for errors

**State not updating:**
- Verify socket event listeners are registered
- Check server is emitting events
- Ensure store methods are called

**Players not seeing updates:**
- Confirm all players in same room (check roomId)
- Verify `io.to(roomId).emit()` is used
- Check for socket disconnect issues

## Environment Variables

Currently none required. Hardcoded defaults:
- Port: 3000
- Host: localhost

For production, add `.env.local`:
```
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
```

Update `lib/socket.ts`:
```typescript
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000');
```

## Deployment Considerations

### Vercel (Current Setup Won't Work)
- Vercel doesn't support WebSockets
- Would need separate Socket.io server

### Recommended: Railway/Render/Heroku
1. All support Node.js with WebSockets
2. Build with `npm run build`
3. Start with `npm start`
4. Set PORT environment variable
5. Update socket URL in client

### Docker (If Needed)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## File Checklist

### Essential Files
- ✅ `package.json` - Dependencies and scripts
- ✅ `tsconfig.json` - TypeScript configuration
- ✅ `tailwind.config.ts` - Tailwind customization
- ✅ `next.config.mjs` - Next.js configuration
- ✅ `server.mjs` - Custom server with Socket.io
- ✅ `app/layout.tsx` - Root layout
- ✅ `app/globals.css` - Global styles
- ✅ `app/page.tsx` - Home page
- ✅ `app/lobby/[roomId]/page.tsx` - Lobby page
- ✅ `app/game/[roomId]/page.tsx` - Game page
- ✅ `lib/socket.ts` - Socket client
- ✅ `lib/store.ts` - Zustand store
- ✅ `lib/utils.ts` - Utility functions
- ✅ `types/game.ts` - Type definitions
- ✅ `components/ui/*` - shadcn components

### Generated/Ignored
- `node_modules/` - Dependencies
- `.next/` - Build output
- `next-env.d.ts` - Next.js types

## Next Steps for New Agent

1. **Read this entire document** to understand architecture
2. **Review `server.mjs`** for game logic
3. **Check `lib/store.ts`** for state shape
4. **Examine one page** (e.g., `app/game/[roomId]/page.tsx`) to see patterns
5. **Test the app** by running locally
6. **Pick an improvement** from the list above
7. **Make changes** following existing patterns

## Questions to Ask When Extending

- Does this need server-side logic? → Update `server.mjs`
- Does this need client state? → Update `lib/store.ts`
- Is this a new page? → Create in `app/` directory
- Is this a reusable UI element? → Add to `components/`
- Does this need real-time sync? → Add Socket.io events
- Does this change game flow? → Update both server and client

## Contact/Support

This is a prototype project. No official support, but code is well-commented and follows standard Next.js + Socket.io patterns.

---

**Last Updated**: November 2024
**Version**: 1.0.0 (Initial Release)
**Status**: Prototype - Fully Functional

