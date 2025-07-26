# Four-in-a-Row with a Twist: The Rotating Grid

This project is a modern, web-based implementation of the classic "Four-in-a-Row" game, designed for two players. It features a clean, professional user interface and a challenging twist: the entire 6x6 grid rotates 90 degrees counter-clockwise, forcing players to constantly adapt their strategies. It is also a fully offline-capable Progressive Web App (PWA).

## Key Features

-   **Progressive Web App:** Installable on mobile and desktop devices for an app-like experience and offline availability.
-   **Dynamic Gameplay:** Connect four of your stones horizontally, vertically, or diagonally to win.
-   **Turn-Based Grid Rotation:** The 6x6 grid rotates after a configurable number of player turns.
-   **Polished & Animated UI:** The game features a responsive interface with smooth, physics-based animations.
-   **Configurable Settings:** A slide-out settings pane allows players to adjust the rotation frequency, manage the game, and view the current app version.

## Technical Details

### Modular Architecture

The application is built using a clean, object-oriented structure that separates concerns: `GameController.js`, `Board.js`, `BoardRenderer.js`, `InputHandler.js`, and `config.js`.

### PWA & Service Worker

The game is a PWA with offline capabilities, powered by a service worker (`sw.js`).

-   **Offline First:** The service worker caches the entire application shell (HTML, CSS, JS, manifest, icons) upon installation, allowing the game to be launched and played without an internet connection.
-   **Robust Cache Versioning:** To ensure users always receive the latest version, the app uses a specific, manual versioning strategy that provides explicit control over updates.
    1.  **Dual Versioning:** The version number must be updated in two places:
        -   `config.js`: This `VERSION` constant is used by the application to display the version in the UI.
        -   `sw.js`: This `VERSION` constant is used to name the cache (e.g., `4-in-a-row-v0.6.0`).
    2.  **Update Trigger:** The browser only installs a new service worker if the `sw.js` file itself changes. Therefore, **incrementing the version in `sw.js` is the essential trigger for the entire update process.**
    3.  **Clean Installation:** The new service worker fetches fresh copies of all app files and stores them in a new, version-named cache.
    4.  **Atomic Swap:** On activation, the new service worker deletes the entire old cache, ensuring that stale files are never served.
-   **Intelligent Fetch Handling:**
    -   The service worker dynamically injects the version number as a query parameter into the CSS and JS links in `index.html` (e.g., `index.js?v=0.6.0`). This ensures the browser requests the new files after an update.
    -   For all requests, the fetch handler uses `caches.match(event.request, { ignoreSearch: true })`. This powerful option allows it to serve the correct cached file by ignoring the query string, seamlessly handling both versioned requests from the HTML and clean URL requests from ES6 module imports.

### Animations & Transitions

-   **Bouncy Grid Rotation:** The grid rotation uses a custom CSS `transition` with a `cubic-bezier` timing function to create a delightful "bouncy" effect.
-   **Robust Rendering:** To prevent rendering glitches on mobile devices, the grid wrapper uses `will-change: transform`, `backface-visibility: hidden`, and `transform: translateZ(0)` to promote the animation to its own compositing layer and ensure smooth performance.
-   **Decoupled Animation Logic:** The JavaScript animation code is carefully decoupled from the CSS, listening for `transitionend` events only on the specific element being animated.

## How to Run Locally

Because this project uses ES6 modules and a service worker, it must be run from a local server.

1.  Navigate to the project directory in your terminal.
2.  Start a simple local server. If you have Python 3:
    ```bash
    python3 -m http.server
    ```
3.  Open your web browser and go to `http://localhost:8000`.
4.  Use your browser's developer tools (e.g., the "Application" tab in Chrome) to inspect the service worker and test PWA functionality.

This project is a single-page application built with vanilla JavaScript (ES6 Modules), HTML, and CSS.

## Multiplayer Implementation Plan

### Overview

With the server-side API now complete, the next phase involves evolving the client to support two distinct game modes:

1. **Local Mode:** The existing "hot-seat" experience for two players sharing one device
2. **Remote Mode:** New online multiplayer for players on different devices using the deployed server API

### User Experience (UX) Design

#### Game Entry & Mode Selection

The user journey begins with a clear choice between game modes:

1. **Main Menu:** Upon loading, users see a clean mode selection screen
2. **Game Mode Options:**
   - **"Play Local"** - Immediate local game start (current behavior)
   - **"Play Online"** - Initiates remote multiplayer flow

#### Online Multiplayer Flow

**Creating a Game:**
1. User selects "Play Online" → "Create New Game"
2. App requests session from server via `POST /session/create`
3. Display "Waiting Room" with:
   - "Waiting for opponent..." message
   - Shareable guest link
   - "Copy Link" button for easy sharing

**Joining a Game:**
1. Second player opens received guest link
2. App detects `sessionId` in URL and auto-joins via `POST /session/join`
3. Both players transition from waiting room to active game

#### In-Game Experience

**Turn Management:**
- Clear visual indication of whose turn it is
- Disable board interaction for waiting player
- Immediate local feedback when making moves
- Smooth animation when receiving opponent moves

**Game State Communication:**
- "Waiting for opponent..." indicators during move transmission
- Clear win/lose/draw screens
- "Return to Menu" option (future: "Rematch" functionality)

### Technical Architecture

The implementation maintains the existing modular structure while introducing new components for online functionality:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│ index.html | styles.css | GameModeSelector (new)           │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   Application Router                        │
├─────────────────────────────────────────────────────────────┤
│ index.js (enhanced) - Mode detection & handler selection   │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
┌─────────────────────────────────┐ ┌──────────────────────────────────┐
│        Local Game Mode          │ │       Online Game Mode           │
├─────────────────────────────────┤ ├──────────────────────────────────┤
│ LocalGameHandler.js (new)       │ │ OnlineGameHandler.js (new)       │
│ - Turn management               │ │ - Session management             │
│ - Direct GameController calls   │ │ - Move synchronization           │
└─────────────────────────────────┘ │ - Polling for opponent moves     │
                    │               │ - API communication              │
                    │               └──────────────────────────────────┘
                    │                              │
                    │               ┌──────────────────────────────────┐
                    │               │      Network Layer               │
                    │               ├──────────────────────────────────┤
                    │               │ ApiController.js (new)           │
                    │               │ - HTTP request wrapper           │
                    │               │ - Server endpoint abstraction    │
                    │               └──────────────────────────────────┘
                    │                              │
                    └──────────────┬───────────────┘
                                   │
┌─────────────────────────────────────────────────────────────┐
│                   Core Game Engine                          │
├─────────────────────────────────────────────────────────────┤
│ GameController.js (refactored) - Pure game logic           │
│ Board.js - Board state management                          │
│ BoardRenderer.js - Visual rendering                        │
│ InputHandler.js (enhanced) - Input routing                 │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Architectural Refactoring (Foundation)

**Objective:** Restructure existing code to support multiple game modes without breaking current functionality.

**Tasks:**

1. **Refactor `GameController.js`:**
   - **Current Role:** Manages both game logic AND turn control
   - **New Role:** Pure game engine focused on game state
   - **Changes:**
     - Extract turn management logic
     - Expose clean API: `makeMove(column, player)`, `rotateBoard()`, `getBoardState()`
     - Remove direct input handling dependencies
     - Maintain all existing game rules (rotation, win detection, etc.)

2. **Create `LocalGameHandler.js`:**
   - Takes over turn-based control logic from `GameController`
   - Manages player alternation
   - Handles input routing from `InputHandler`
   - Calls `GameController` methods for actual game operations
   - **Goal:** Game plays identically to current version

3. **Enhance `InputHandler.js`:**
   - Add handler routing capability
   - Support for different input contexts (local vs. online)
   - Maintain existing event binding for local mode

#### Phase 2: Online Infrastructure

**Objective:** Build components for remote multiplayer functionality.

**Tasks:**

4. **Create `ApiController.js`:**
   - Centralized server communication module
   - Wrapper functions for all API endpoints:
     - `createSession()` → `POST /session/create`
     - `joinSession(sessionId)` → `POST /session/join`
     - `submitMove(sessionId, playerId, column)` → `POST /move`
     - `getNewMoves(sessionId, since)` → `GET /moves/{sessionId}?since=N`
     - `getSessionState(sessionId)` → `GET /session/{sessionId}`
   - Error handling and retry logic
   - Network status management

5. **Implement Mode Selection UI:**
   - Add mode selection screen to `index.html`
   - Style buttons for "Play Local" and "Play Online"
   - Integrate with `index.js` for mode routing
   - Hide game board initially, show after mode selection

6. **Create `OnlineGameHandler.js`:**
   - **Session Management:**
     - Host flow: Create session, display waiting room
     - Guest flow: Join session from URL parameter
     - Handle session state transitions
   - **Move Synchronization:**
     - Submit local moves to server
     - Poll for opponent moves (`setInterval` with `getMoves`)
     - Apply received moves to local `GameController`
     - Maintain move sequence integrity
   - **State Management:**
     - Track connection status
     - Manage turn indicators
     - Handle disconnection scenarios

#### Phase 3: Integration & User Experience

**Objective:** Tie components together and polish the user experience.

**Tasks:**

7. **Enhance `index.js` (Application Router):**
   - **URL Detection:** Check for `sessionId` parameter on page load
   - **Auto-Join:** If session ID found, launch `OnlineGameHandler` in join mode
   - **Mode Selection:** Otherwise, display mode selection UI
   - **Handler Initialization:** Launch appropriate handler based on user choice
   - **Navigation Management:** Handle transitions between modes

8. **Implement Waiting Room UI:**
   - Create waiting room templates in HTML
   - "Waiting for opponent..." messaging
   - Guest link display with copy functionality
   - Integration with `OnlineGameHandler` for state management
   - Transition animations to game board

9. **Add Online Game State Indicators:**
   - Enhanced turn indicators for remote play
   - Connection status display
   - "Waiting for opponent..." states
   - Network error handling UI
   - Game over screens with mode-appropriate options

#### Phase 4: Testing & Polish

**Objective:** Ensure robust functionality across both modes.

**Tasks:**

10. **Cross-Mode Testing:**
    - Verify local mode maintains all existing functionality
    - Test online mode with multiple browsers/devices
    - Validate session creation, joining, and gameplay flow
    - Test edge cases (disconnection, rapid moves, etc.)

11. **Performance Optimization:**
    - Optimize polling frequency for responsiveness vs. server load
    - Implement efficient move batching if needed
    - Add client-side move validation to reduce server calls

12. **User Experience Refinements:**
    - Loading states and transitions
    - Error messaging and recovery flows
    - Mobile responsiveness for both modes
    - PWA functionality verification for offline local play

### Development Considerations

**Backward Compatibility:**
- Local mode must maintain 100% feature parity with current version
- All existing configuration options (rotation frequency, etc.) preserved
- Service worker and PWA functionality unaffected

**Data Flow:**
- Online mode uses move-based synchronization (not board state)
- Both clients reconstruct identical board state from move sequence
- Board rotation logic remains client-side and deterministic

**Error Handling:**
- Graceful degradation when server unavailable
- Client-side validation before server submission
- Automatic reconnection attempts for network issues

**Future Extensibility:**
- Architecture supports easy addition of spectator mode
- Framework for potential WebSocket upgrade
- Foundation for features like game replay, statistics, etc.

This phased approach ensures each component can be built, tested, and integrated incrementally while maintaining a working application throughout the development process.