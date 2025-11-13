# Project Context for AI Agents

## Quick Summary

**Project**: Who's Who - Multiplayer Guessing Game  
**Tech**: Next.js 14 + TypeScript + Socket.io + Zustand + Tailwind + shadcn/ui  
**Status**: Fully functional prototype  
**Purpose**: Educational/entertainment - multiplayer browser game

## What This App Does

Players join rooms, get secretly assigned options, take turns asking yes/no questions, and collaboratively eliminate options until one remains. Think "Guess Who?" but multiplayer and customizable.

## Architecture in 3 Sentences

1. **Custom Next.js server** (`server.mjs`) handles both HTTP and WebSocket connections, stores game state in memory
2. **Client pages** use Zustand for state + Socket.io for real-time sync with server
3. **Three main routes**: Home (create/join) → Lobby (wait) → Game (play)

## File Importance Ranking

### ⭐⭐⭐ Critical - Touch These Most
- `server.mjs` - All game logic and WebSocket handling
- `lib/store.ts` - Client state management
- `app/game/[roomId]/page.tsx` - Main gameplay UI

### ⭐⭐ Important - Touch When Adding Features
- `app/page.tsx` - Entry point, room creation/joining
- `app/lobby/[roomId]/page.tsx` - Pre-game waiting room
- `types/game.ts` - Type definitions

### ⭐ Supporting - Touch Rarely
- `lib/socket.ts` - Socket singleton (rarely needs changes)
- `components/ui/*` - shadcn components (mostly static)
- `lib/utils.ts` - Helper functions
- Config files - Only for build/deploy changes

## Data Flow

```
User Action (Click/Input)
  ↓
Component Event Handler
  ↓
socket.emit(event, data) → Server (server.mjs)
  ↓
Server validates + updates room state
  ↓
io.to(roomId).emit(event, data) → All Clients in Room
  ↓
Client socket.on(event, handler)
  ↓
Update Zustand Store
  ↓
React Re-renders UI
```

## Game State Lives In Two Places

**Server** (`server.mjs`):
```javascript
rooms = Map<roomId, {
  players: Player[],
  options: GameOption[],
  secretAssignments: Record<playerId, optionId>,
  currentTurnPlayerId: string,
  gamePhase: string
}>
```

**Client** (`lib/store.ts`):
```typescript
useGameStore = {
  players: Player[],
  options: GameOption[],
  mySecretOption: string, // Only THIS player's secret
  currentTurnPlayerId: string,
  gamePhase: string
}
```

## Key Design Decisions

1. **No Database**: In-memory only, rooms disappear on server restart (intentional for prototype)
2. **No Auth**: Just usernames, anyone can join with room code
3. **Server Authority**: Server validates everything, clients just display
4. **Collaborative Elimination**: All players can eliminate after question (not restricted to turn player)
5. **Random Assignment**: Secrets assigned randomly without replacement

## Common Extension Points

### Want to add a feature? Ask yourself:

**Does it need to persist across sessions?**
→ Add database (see DEVELOPMENT.md "Database Integration")

**Does everyone need to see it in real-time?**
→ Add Socket.io event (client emits → server broadcasts)

**Is it UI-only for one player?**
→ Add local React state, no socket needed

**Does it change game rules?**
→ Update server.mjs game logic

**Is it a new game mode?**
→ Add `gameMode` field to room, conditional logic in server

## Testing Strategy

Open multiple browser windows → simulate multiplayer locally. Each window = one player.

## Known Quirks

1. **No reconnection**: Refresh = kicked out
2. **More players than options**: Some players get no secret (edge case, no UI warning)
3. **Eliminated secret**: Player can still play, just knows they lost
4. **No turn timer**: Players can stall indefinitely
5. **No question validation**: Can ask anything, even gibberish

## Documentation Hierarchy

```
README.md
  ↓ (User guide, how to play)
PROJECT_CONTEXT.md ← YOU ARE HERE
  ↓ (Quick overview for agents)
DEVELOPMENT.md
  ↓ (Complete technical documentation)
QUICK_REFERENCE.md
  ↓ (Cheat sheet for common tasks)
```

## If You Need to...

| Task | File to Edit | Reference |
|------|--------------|-----------|
| Change game rules | `server.mjs` | DEVELOPMENT.md "Game Logic" |
| Add UI component | `components/ui/` | shadcn/ui docs |
| Add new page | `app/[name]/page.tsx` | Next.js 14 App Router |
| Add socket event | `server.mjs` + page file | QUICK_REFERENCE.md events table |
| Change colors | `app/globals.css` | Tailwind CSS variables |
| Add state | `lib/store.ts` | Zustand patterns |
| Fix TypeScript error | `types/game.ts` | Add missing types |
| Deploy | N/A | DEVELOPMENT.md "Deployment" |

## First Steps for New Agent

1. ✅ Read this file (PROJECT_CONTEXT.md)
2. ⏭️ Skim DEVELOPMENT.md sections relevant to your task
3. 🔍 Check QUICK_REFERENCE.md for code snippets
4. 🧪 Run `npm install && npm run dev` to see it working
5. 🎯 Identify which files you need to modify
6. 💻 Make changes following existing patterns
7. ✅ Test with multiple browser windows

## Project Philosophy

**Keep it simple**: This is a prototype, not production software  
**Real-time first**: Every action should feel instant via WebSockets  
**Minimal setup**: No accounts, no config, just play  
**Educational**: Code is meant to be read and learned from  

## Version Info

**Created**: November 2024  
**Dependencies**: See `package.json`  
**Node Version**: 18+ recommended  
**Next.js**: 14.2.3 (App Router)  
**Socket.io**: 4.7.5  

## What's NOT Here

- Authentication/authorization
- Database/persistence
- Payment/monetization
- Analytics/tracking
- Email/notifications
- File uploads
- Admin dashboard
- Mobile app (web only)

## What's Good About This Codebase

✅ TypeScript for type safety  
✅ Modern React patterns (hooks, functional components)  
✅ Clean separation: server logic vs client UI  
✅ Real-time sync works reliably  
✅ Responsive design basics  
✅ Well-commented code  
✅ Consistent naming conventions  

## What Could Be Better

⚠️ No error boundaries  
⚠️ Limited input validation  
⚠️ No loading states for slow networks  
⚠️ No optimistic UI updates  
⚠️ No unit tests  
⚠️ Hardcoded strings (no i18n)  
⚠️ Limited accessibility features  

## Success Criteria for Extensions

When adding features, ensure:
- [ ] Works with 2+ players in different browsers
- [ ] Handles player disconnect gracefully
- [ ] Updates all clients in real-time
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] Follows existing code style
- [ ] Doesn't break existing features

## Anti-Patterns to Avoid

❌ Don't trust client data without server validation  
❌ Don't store secrets in client state (except player's own)  
❌ Don't emit socket events on every render  
❌ Don't forget to remove socket listeners on unmount  
❌ Don't use window.location for navigation (use Next.js router)  
❌ Don't add heavy dependencies for simple features  

## Good Patterns to Follow

✅ Emit socket events from user actions  
✅ Listen to socket events in useEffect  
✅ Store shared state in Zustand  
✅ Keep game logic on server  
✅ Use TypeScript types for socket payloads  
✅ Clean up listeners in useEffect return  

## Questions You Might Have

**Q: Why custom server instead of API routes?**  
A: Socket.io needs persistent connection, API routes are stateless

**Q: Why Zustand instead of Context/Redux?**  
A: Simpler, less boilerplate, perfect for this scale

**Q: Why in-memory instead of database?**  
A: Prototype simplicity, adds DB = more setup

**Q: Why no tests?**  
A: Time constraint for prototype, would add for production

**Q: Can I deploy to Vercel?**  
A: No, Vercel doesn't support WebSockets. Use Railway/Render

**Q: Is this production-ready?**  
A: No, it's a prototype. Needs auth, DB, error handling, tests, etc.

## Code Complexity Assessment

| File | Complexity | Why |
|------|------------|-----|
| `server.mjs` | 🔴 High | Central game logic, many socket events |
| `app/game/[roomId]/page.tsx` | 🟡 Medium | Complex UI state, many interactions |
| `lib/store.ts` | 🟢 Low | Simple Zustand store |
| `app/page.tsx` | 🟢 Low | Basic form handling |
| `app/lobby/[roomId]/page.tsx` | 🟢 Low | Simple display logic |

## Estimated Time for Common Tasks

- Add chat feature: 2-3 hours
- Add database: 4-6 hours
- Add question history: 1 hour
- Add timer system: 2-3 hours
- Add game statistics: 3-4 hours
- Mobile optimization: 4-6 hours
- Add tests: 8-10 hours
- Deploy to production: 2-4 hours

## Final Notes

This is a **working, playable game**. All core features are implemented. Focus on enhancements, not fixes. The codebase is well-structured and ready for extension.

**Most important files to understand**: `server.mjs`, `lib/store.ts`, `app/game/[roomId]/page.tsx`

**Best way to learn**: Run it, play it, read the code while using it

---

**Ready to code?** Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for common tasks or [DEVELOPMENT.md](./DEVELOPMENT.md) for deep dives.

