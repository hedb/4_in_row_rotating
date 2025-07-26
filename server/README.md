# Game API Cloud Function

Serverless multiplayer backend for 4-in-a-row rotating game using Cloud Functions + Firestore.

## Current Status ✅ (Phase 1 Complete)

**Working Endpoints:**
- `POST /session/create` - Create new game session 
- `POST /session/join` - Join existing session
- `POST /move` - Submit a move
- `GET /moves/{sessionId}?since=N` - Get new moves for a session
- `GET /session/{sessionId}` - Get the full current state of a session
- `GET /health` - Health check + Firestore status

**Storage:** Cloud Firestore (fully serverless)  
**Architecture:** Move-based synchronization (server stores moves, clients handle game logic)

## Quick Start

### 1. Configure the Project

Edit the hardcoded values in **main.py**:
```python
PROJECT_ID = "your-actual-gcp-project-id"
FUNCTION_NAME = "game-api"
REGION = "europe-west1"  # Your preferred region
```

### 2. Enable Firestore

```bash
# Enable APIs
gcloud services enable firestore.googleapis.com
gcloud services enable cloudfunctions.googleapis.com

# Create Firestore database
gcloud firestore databases create --location=europe-west1
```

### 3. Deploy to GCP

```bash
# Authenticate
gcloud auth login

# Deploy
cd server
python deploy_func.py
```

### 4. Test the API

```bash
# Test session creation
curl -X POST https://your-function-url/session/create

# Test health check
curl https://your-function-url/health

# Test making a move (replace with your data)
curl -X POST -H "Content-Type: application/json" \
  -d '{"sessionId": "your-session-id", "playerId": 1, "column": 3}' \
  https://your-function-url/move
```

## API Endpoints

### `POST /session/create`
Creates a new game session.

**Response:**
```json
{
  "sessionId": "uuid-here",
  "playerId": 1,
  "status": "waiting",
  "hostLink": "https://yourgame.com/game/uuid?role=host",
  "guestLink": "https://yourgame.com/game/uuid?role=guest"
}
```

### `POST /session/join` 
Joins an existing session.

**Request:**
```json
{
  "sessionId": "uuid-here"
}
```

**Response:**
```json
{
  "playerId": 2,
  "gameState": {
    "sessionId": "uuid-here",
    "status": "playing",
    "players": {...},
    "moves": [],
    "currentPlayer": 1,
    "moveCount": 0
  }
}
```

### `POST /move`
Submits a player's move. The server only validates that the required fields are present, not the game logic itself.

**Request:**
```json
{
  "sessionId": "your-session-id",
  "playerId": 1,
  "column": 3
}
```

**Response (Success):**
```json
{
  "success": true,
  "moveNumber": 5 
}
```

### `GET /moves/{sessionId}?since=N`
Gets all moves for a session that have occurred *after* a specific move number. This is the primary mechanism for clients to sync the game state.

- **`sessionId`** (string, required): The ID of the game session.
- **`since`** (int, optional): The move number to get moves after. Defaults to `0` if omitted, which fetches all moves.

**Response:**
```json
{
  "moves": [
    {"player": 2, "column": 4, "moveNumber": 5, "timestamp": "..."},
    {"player": 1, "column": 3, "moveNumber": 6, "timestamp": "..."}
  ],
  "currentMoveCount": 6,
  "sessionId": "your-session-id"
}
```

### `GET /session/{sessionId}`
Gets the complete, current state of a game session. Useful for when a player joins or reconnects.

**Response:**
The full session document from Firestore (see Data Structure section).

### `GET /health`
Health check with Firestore connectivity status.

## Data Structure

### Session Document (Firestore)
```json
{
  "sessionId": "uuid",
  "status": "waiting|playing|finished",
  "players": {
    "1": {"connected": true, "lastSeen": "2025-07-20T19:09:33Z"},
    "2": {"connected": true, "lastSeen": "2025-07-20T19:09:34Z"}
  },
  "moves": [
    {"player": 1, "column": 3, "moveNumber": 1, "timestamp": "..."},
    {"player": 2, "column": 4, "moveNumber": 2, "timestamp": "..."}
  ],
  "currentPlayer": 1,
  "moveCount": 2,
  "rotationFrequency": 4,
  "gameOver": false,
  "winner": null,
  "createdAt": "2025-07-20T19:09:33Z",
  "expiresAt": "2025-07-20T20:09:33Z"
}
```

## Architecture: Move-Based Sync

Instead of syncing board state, we sync **move events**:

1. **Client makes move** → POST to server
2. **Server stores move** → Appends to Firestore moves array  
3. **Other client polls** → Gets new moves since last check
4. **Both clients replay** → Same move sequence = same board state

**Benefits:**
- ✅ Minimal server logic (just store moves)
- ✅ Tiny data payload (moves vs full board)
- ✅ Deterministic game state
- ✅ Full game replay capability  

## File Structure

```
server/
├── main.py              # Cloud Function code
├── deploy_func.py       # Deployment script  
├── requirements.txt     # Dependencies
├── local_tests/         # Test scripts
│   ├── test_session.py  # Session create/join test
│   └── README.md        # Test documentation
└── README.md           # This file
```

## Dependencies

- `flask` - Local testing server
- `flask-cors` - CORS handling
- `google-cloud-firestore` - Firestore SDK
- `google-cloud-functions` - Cloud Functions SDK

## Testing

```bash
# Test session creation + join flow
cd server
python local_tests/test_session.py
```

## Next Steps (Client-Side Implementation)

The server-side API is now complete for core gameplay. All further game logic resides on the client.

### **Phase 2: Client Game Mechanics**

#### **Client-Side State Management**
- Store the reconstructed `board` state.
- Keep track of the `currentPlayer`, `moveCount`, and `gameOver` status.
- Hold `sessionId` and `playerId`.

#### **Move Validation (Client-Side)**
```javascript
function isMoveValid(board, column, player) {
    // Check it's the player's turn
    // Check column bounds (0-6)
    // Check column is not full (top row is empty)
    // Return { valid: boolean, error: string }
}
```

#### **Win Detection (Client-Side)** 
```javascript
function checkWinner(board) {
    // Reconstruct 6x7 board from moves list
    // Check horizontal, vertical, and diagonal patterns for 4-in-a-row
    // Return winner (1 | 2 | 'draw' | null)
}
```

#### **Board Rotation Logic (Client-Side)**
```javascript
function applyRotation(board) {
    // Every N moves, rotate board 90° clockwise
    // This involves creating a new board and transposing coordinates
    // (row, col) -> (col, 5 - row)
    // After rotation, re-apply gravity to all pieces
    // Return the new board state
}
```

#### **Game Loop (Client-Side)**
1.  A player makes a move.
2.  **Client validates the move.** If valid, POST to `/move`.
3.  **Client starts polling** `GET /moves/{sessionId}?since=N` every few seconds.
4.  When new moves are received, the client:
    - Appends them to its local list of moves.
    - Reconstructs the board state from the full move list.
    - Runs win detection.
    - If `moveCount % rotationFrequency === 0`, applies board rotation.
    - Updates the UI.

### **Phase 3: Advanced Features (Client/Server)**

This phase involves features that may require server-side changes.

#### **Session Management**
- **Auto-cleanup**: Delete sessions after `expiresAt` (Server-side cron job).
- **Reconnection**: A client can rejoin using `GET /session/{sessionId}` to get the full state.
- **Spectator mode**: A client could poll `/moves` without being a player.

#### **Real-time Optimizations**
- **WebSocket upgrade**: Replace polling with WebSockets for instant updates.
- **Server-Sent Events**: A simpler alternative to WebSockets for one-way data flow.

---

## **Current Priority: Phase 2 (Client Implementation)**

**The immediate next task is to build the client-side application** that consumes the now-complete Game API. This involves creating the UI, managing the game state locally, and implementing all the game rules.

## Troubleshooting

### Common Issues

1. **Firestore not enabled**: Run `gcloud services enable firestore.googleapis.com`
2. **Project not found**: Update `PROJECT_ID` in `main.py`
3. **Permission denied**: Add Cloud Functions Admin role to your account
4. **Timestamp errors**: Should be fixed - timestamps auto-converted to ISO strings

### Success Indicators

✅ **Session creation returns 200** with sessionId  
✅ **Join returns 200** with playerId and gameState  
✅ **Status changes** from "waiting" → "playing" after join
✅ **Move submission returns 200** with `success: true`
✅ **Firestore shows documents** in `game_sessions` collection 