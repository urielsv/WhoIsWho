# Quick Reference Guide

## Essential Commands

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Key Files by Purpose

### Want to modify game rules?
→ `server.mjs` (lines 10-28 for secret assignment, lines 150-185 for game logic)

### Want to change UI/styling?
→ `app/globals.css` (color scheme)
→ `tailwind.config.ts` (theme configuration)
→ Individual page files for component layout

### Want to add new game features?
1. Add server logic in `server.mjs` (socket event handlers)
2. Add state management in `lib/store.ts` (if needed)
3. Update UI in appropriate page file
4. Add types to `types/game.ts`

### Want to add a new page?
→ Create in `app/` directory following Next.js 14 App Router conventions

### Want to add new UI components?
→ Add to `components/ui/` (follow shadcn/ui patterns)

## Socket.io Events Reference

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `createRoom` | `{ roomName, username, options }` | Create new game room |
| `joinRoom` | `{ roomId, username }` | Join existing room |
| `toggleReady` | `{ roomId }` | Toggle ready status |
| `startGame` | `{ roomId }` | Start game (admin only) |
| `askQuestion` | `{ roomId, question }` | Ask yes/no question |
| `eliminateOptions` | `{ roomId, optionIds }` | Eliminate selected options |
| `nextTurn` | `{ roomId }` | Move to next player |

### Server → Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `roomCreated` | `{ roomId, playerId, isAdmin }` | Room created successfully |
| `joined` | `{ roomId, roomName, playerId, isAdmin }` | Joined room successfully |
| `roomUpdate` | `{ players, options, gamePhase, currentTurnPlayerId }` | Sync entire room state |
| `gameStarted` | `{}` | Game has begun |
| `secretAssigned` | `{ optionId }` | Your secret option |
| `questionAsked` | `{ playerId, question }` | Player asked question |
| `turnChanged` | `{ currentTurnPlayerId }` | Turn moved to next player |
| `optionsEliminated` | `{ optionIds }` | Options were eliminated |
| `gameFinished` | `{}` | Game ended |
| `playerJoined` | `{ player }` | New player joined |
| `playerLeft` | `{ playerId }` | Player disconnected |
| `error` | `{ message }` | Error occurred |

## Zustand Store Reference

### State Properties
```typescript
roomId: string | null
roomName: string | null
playerId: string | null
username: string | null
isAdmin: boolean
players: Player[]
options: GameOption[]
gameStarted: boolean
gamePhase: 'lobby' | 'question' | 'elimination' | 'finished'
currentTurnPlayerId: string | null
mySecretOption: string | null
lastQuestion: string | null
```

### Methods
```typescript
setRoomInfo(roomId, roomName, playerId, username, isAdmin)
setPlayers(players)
setOptions(options)
setGameStarted(started)
setGamePhase(phase)
setCurrentTurnPlayerId(playerId)
setMySecretOption(optionId)
setLastQuestion(question)
reset()
```

## Common Tasks

### Add a Chat Feature

**1. Update Types** (`types/game.ts`):
```typescript
export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
}
```

**2. Update Server** (`server.mjs`):
```javascript
socket.on('sendMessage', ({ roomId, message }) => {
  const room = rooms.get(roomId);
  const player = room.players.find(p => p.id === socket.id);
  
  io.to(roomId).emit('newMessage', {
    id: generateId(),
    playerId: socket.id,
    username: player.username,
    message,
    timestamp: Date.now()
  });
});
```

**3. Update Store** (`lib/store.ts`):
```typescript
messages: ChatMessage[]
addMessage: (message: ChatMessage) => 
  set(state => ({ messages: [...state.messages, message] }))
```

**4. Add UI Component** (in game page):
```typescript
const handleSendMessage = () => {
  socket?.emit('sendMessage', { roomId, message: chatInput });
};

useEffect(() => {
  socket?.on('newMessage', (message) => {
    addMessage(message);
  });
}, [socket]);
```

### Add Question History

**1. Update Store**:
```typescript
questionHistory: Array<{ player: string, question: string }>
addQuestion: (player, question) => 
  set(state => ({ 
    questionHistory: [...state.questionHistory, { player, question }] 
  }))
```

**2. Update Game Page**:
```typescript
useEffect(() => {
  socket?.on('questionAsked', (data) => {
    addQuestion(data.playerId, data.question);
  });
}, [socket]);
```

**3. Add Display**:
```typescript
<div className="space-y-2">
  {questionHistory.map((q, i) => (
    <div key={i}>{q.player}: {q.question}</div>
  ))}
</div>
```

### Add Database Persistence

**1. Install Prisma**:
```bash
npm install prisma @prisma/client
npx prisma init
```

**2. Define Schema** (`prisma/schema.prisma`):
```prisma
model Room {
  id        String   @id
  name      String
  options   Json
  createdAt DateTime @default(now())
  players   Player[]
}

model Player {
  id       String @id
  username String
  roomId   String
  room     Room   @relation(fields: [roomId], references: [id])
}
```

**3. Update Server** to use Prisma instead of Map

### Change Theme Colors

**Update** `app/globals.css`:
```css
:root {
  --primary: 220 90% 56%;  /* Change this hue/saturation/lightness */
  /* ... other colors */
}
```

## Testing Checklist

- [ ] Create room with valid options
- [ ] Create room with invalid options (< 2)
- [ ] Join room with valid code
- [ ] Join room with invalid code
- [ ] Multiple players join same room
- [ ] Admin starts game
- [ ] Non-admin cannot start game
- [ ] Secrets are assigned correctly
- [ ] Turn rotation works
- [ ] Question asking works
- [ ] Option elimination works
- [ ] Game ends when 1 option remains
- [ ] Player disconnect is handled
- [ ] Admin leaves (new admin assigned)
- [ ] All players leave (room deleted)

## Debugging Snippets

### Log All Socket Events (Client)
```typescript
useEffect(() => {
  if (!socket) return;
  
  const logEvent = (eventName: string) => (data: any) => {
    console.log(`[Socket] ${eventName}:`, data);
  };
  
  socket.onAny(logEvent);
  
  return () => socket.offAny(logEvent);
}, [socket]);
```

### Log All Socket Events (Server)
```javascript
socket.onAny((eventName, ...args) => {
  console.log(`[Socket] ${socket.id} -> ${eventName}:`, args);
});
```

### Inspect Store State
```typescript
// Add to any component
const store = useGameStore();
console.log('Current store state:', JSON.stringify(store, null, 2));
```

### Check Room State (Server)
```javascript
// Add endpoint in server.mjs
socket.on('debugRooms', () => {
  const roomsData = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    playerCount: room.players.length,
    optionCount: room.options.length,
    gameStarted: room.gameStarted
  }));
  socket.emit('debugRoomsData', roomsData);
  console.log('Rooms:', roomsData);
});
```

## Performance Tips

1. **Debounce socket emissions**: Don't emit on every keystroke
2. **Memoize expensive computations**: Use `useMemo` for filtered lists
3. **Optimize re-renders**: Use `React.memo` for list items
4. **Limit socket listeners**: Clean up in useEffect returns
5. **Compress socket data**: Send IDs instead of full objects when possible

## Common Pitfalls

❌ **Don't**: Emit socket events in render
✅ **Do**: Emit in event handlers or useEffect

❌ **Don't**: Forget to clean up socket listeners
✅ **Do**: Return cleanup function in useEffect

❌ **Don't**: Mutate state directly
✅ **Do**: Use Zustand set methods

❌ **Don't**: Trust client-side validation only
✅ **Do**: Validate on server too

❌ **Don't**: Store sensitive data in client state
✅ **Do**: Keep secrets on server, send only to owner

## Port Conflicts

If port 3000 is in use:

**Windows**:
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Mac/Linux**:
```bash
lsof -ti:3000 | xargs kill -9
```

Or change port in `server.mjs`:
```javascript
const port = 3001; // Change this
```

## VS Code Extensions Recommended

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

## Helpful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Socket.io Docs](https://socket.io/docs/v4/)
- [Zustand Docs](https://docs.pmnd.rs/zustand/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete technical documentation**

