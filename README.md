# Arcade Terminal V2 - Elite Edition 🚀

Welcome to **Arcade Terminal V2**, a premium, high-performance multiplayer hub built with modern web technologies. This project is a fully-featured gaming ecosystem with built-in virtual stock trading, live WebRTC voice chat, real-time multiplayer, and intelligent bot integration.

## 🌟 Key Features

*   **Real-time Multiplayer Hub**: Instant room creation, matchmaking, and state syncing powered by Socket.io.
*   **Virtual Trading Terminal**: Built-in virtual stock market leveraging Lightweight Charts and live market data. Includes batch-fetch optimizations, Max Quantity limiters (10,000 shares) to prevent integer exploits, and short-selling blocks.
*   **Price Alerts**: Set background alerts for stocks hitting specific price targets with active server-side polling and UI notifications.
*   **Stockfish AI Integration**: Challenge the industry-standard Stockfish chess engine natively within the application. Engine difficulty dynamically scales.
*   **WebRTC Voice Chat 🎙️**: Seamless mesh-networked P2P voice chat for all players inside a game room. Drop in and coordinate live!
*   **Admin Analytics Dashboard**: Exclusive tracking portal for `isAdmin` users to monitor active players, economy circulation, trade volume, and global server alerts.
*   **Daily Challenges**: Automated system that assigns new daily goals (e.g., "Win 3 Uno matches" or "Make ₹5,000 profit in trades") and rewards players with Arcade Coins.
*   **Spectator Mode**: Drop into any "IN PROGRESS" game and spectate live without interfering with the ongoing action.
*   **Progressive Web App (PWA)**: Fully installable to your mobile or desktop home screen.

## 🕹️ Included Games

1.  **Chess** (Multiplayer + Stockfish AI)
2.  **Uno** (Multiplayer with Smart AI Bots)
3.  **Ludo**
4.  **Flappy Bird**
5.  **2048** (Solo Ranked)
6.  **Snake**
7.  **Tetris**
8.  **Asteroid Shooter**
9.  **Donkey Kong (Clone)**
10. **Snakes & Ladders**

## 🛠️ Tech Stack

*   **Frontend**: React, TypeScript, Vite, Lightweight Charts, React-Chessboard
*   **Backend**: Node.js, Express, Socket.io
*   **Database**: Prisma ORM with SQLite (Easily swappable to PostgreSQL)
*   **Voice/Networking**: WebRTC via `simple-peer`

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+ recommended)
*   npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Asuravivi/office-arcade.git
   cd office-arcade
   ```

2. **Install Server Dependencies & Initialize DB:**
   ```bash
   cd server
   npm install
   npx prisma db push
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

You can run both the client and server concurrently from the root directory if you set up a workspace, or run them in separate terminal windows.

**Start the Server (Terminal 1):**
```bash
cd server
npm run dev
```

**Start the Client (Terminal 2):**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`.

## 🛡️ Admin Setup

To grant yourself access to the Admin Analytics Dashboard:
1. Register a new account normally through the UI.
2. Open your SQLite database (or use Prisma Studio: `npx prisma studio` in the server folder).
3. Find your user record and set the `isAdmin` boolean to `true`.
4. Refresh the application!

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
