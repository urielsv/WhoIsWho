# Who's Who - Multiplayer Guessing Game

---> MADE WITH CURSOR !!!

A real-time multiplayer guessing game built with Next.js, Socket.io, and shadcn/ui. Players take turns asking yes/no questions and eliminating options to guess their secret assignments.

**Note:** Created with Cursor AI for casual play with friends over voice chat (Discord, etc.).
---

## 📚 Documentation Quick Links

- **🤖 For AI Agents**: Start with [AI_AGENT_HANDOFF.md](./AI_AGENT_HANDOFF.md) - specifically designed for agent continuation
- **👨‍💻 For Developers**: Read [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) → Then [DEVELOPMENT.md](./DEVELOPMENT.md)
- **⚡ Need Quick Reference?**: Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for code examples
- **📖 All Documentation**: See [DOCS_INDEX.md](./DOCS_INDEX.md) for complete guide to all docs
- **👥 For Players/Users**: Continue reading below ↓

---

## Features

- 🎮 **Real-time Multiplayer**: Play with friends using WebSocket connections
- 🎨 **Modern UI**: Beautiful interface built with shadcn/ui components
- 🎯 **Turn-based Gameplay**: Take turns asking questions and eliminating options
- 👥 **Lobby System**: Create or join rooms with room codes
- 🎲 **Custom Options**: Add your own list of items to guess (TV shows, movies, characters, etc.)
- 🏆 **Admin Controls**: Room creator has admin privileges to start the game

## How to Play

1. **Create a Room**: One player creates a room and adds a list of options (e.g., TV series names)
2. **Join the Lobby**: Other players join using the room code
3. **Secret Assignment**: Each player is secretly assigned one option
4. **Ask Questions**: Take turns asking yes/no questions about the options
5. **Eliminate**: After each question, all players can eliminate options based on the answer
6. **Win**: The last remaining option wins!

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── page.tsx              # Home page (create/join room)
│   ├── lobby/[roomId]/       # Lobby waiting room
│   └── game/[roomId]/        # Active game page
├── components/ui/            # shadcn/ui components
├── lib/
│   ├── socket.ts             # Socket.io client
│   ├── store.ts              # Zustand state management
│   └── utils.ts              # Utility functions
├── types/
│   └── game.ts               # TypeScript type definitions
└── server.mjs                # Custom Next.js server with Socket.io
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Real-time**: Socket.io
- **State Management**: Zustand

## Game Rules

1. Each player is secretly assigned one option from the list
2. Players take turns in round-robin fashion
3. On your turn, ask a yes/no question about the options
4. After the question, all players can eliminate options
5. Continue until only one option remains
6. The player with that secret option wins!

## Example Game Topics

- **TV Series**: Game of Thrones, The Office, Breaking Bad, Stranger Things
- **Movies**: The Matrix, Inception, Pulp Fiction, The Godfather
- **Characters**: Harry Potter, Sherlock Holmes, Batman, Wonder Woman
- **Countries**: Japan, Brazil, Egypt, Australia
- **Animals**: Lion, Penguin, Elephant, Dolphin

## Development

To build for production:

```bash
npm run build
npm start
```

## License

MIT License - feel free to use this project for learning or personal use!

## Project Structure

```
├── app/
│   ├── page.tsx              # Home page (create/join room)
│   ├── lobby/[roomId]/       # Lobby waiting room
│   └── game/[roomId]/        # Active game page
├── components/ui/            # shadcn/ui components
├── lib/
│   ├── socket.ts             # Socket.io client
│   ├── store.ts              # Zustand state management
│   └── utils.ts              # Utility functions
├── types/
│   └── game.ts               # TypeScript type definitions
├── server.mjs                # Custom Next.js server with Socket.io
├── README.md                 # This file (user guide)
└── DEVELOPMENT.md            # Technical documentation for developers
```

## For Developers

**Want to extend this project?** Check out [DEVELOPMENT.md](./DEVELOPMENT.md) which includes:

- Complete architecture overview
- File-by-file documentation
- Game logic deep dive
- WebSocket communication patterns
- State management strategy
- Testing procedures
- Deployment guides
- Known limitations and improvement ideas
- Code patterns and conventions

## Contributing

This is a prototype project. Feel free to fork and enhance it! See [DEVELOPMENT.md](./DEVELOPMENT.md) for technical context.

**Suggested Improvements:**
- Chat system for player communication
- Question history display
- Database persistence (PostgreSQL/MongoDB)
- Player reconnection after disconnect
- Mobile touch optimization
- Vote-based elimination system
- Multiple game modes
- Sound effects and animations

