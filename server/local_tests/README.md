# Local Tests for Game API

This directory contains test scripts to verify the game API functionality locally.

## Setup

1. Make sure you have Redis running locally:
```bash
# Install Redis (macOS)
brew install redis

# Start Redis
brew services start redis
```

2. Install test dependencies:
```bash
pip install requests
```

3. Update Redis configuration in `main.py`:
```python
REDIS_HOST = "localhost"  # Change from the GCP IP
REDIS_PORT = 6379
```

## Running Tests

1. First, start the local Flask server:
```bash
# From the server directory
python main.py
```

2. In another terminal, run the test script:
```bash
# From the server/local_tests directory
python test_session.py
```

## Test Scripts

### test_session.py
Simulates a complete game session:
1. Player 1 creates a game
2. Player 1 waits for opponent
3. Player 2 joins the game
4. Verifies both players are connected

The script uses threading to simulate both players interacting with the server simultaneously.

## Expected Output

A successful test should show:
```
Player 1 (Host): Creating new game session...
Player 1 (Host): Created session abc-123
Host Link: http://localhost:8080/game/abc-123?role=host
Guest Link: http://localhost:8080/game/abc-123?role=guest

Player 1 (Host): Waiting for other player...

Player 2 (Guest): Joining game abc-123...
Player 2 (Guest): Joined as Player 2

Player 1 (Host): Other player joined!

Final Status:
Host (Player 1) session: abc-123
Guest (Player 2) session: abc-123

✅ Test successful! Both players connected.

Game State:
{
  "status": "ready",
  "players": {
    "1": {"connected": true, ...},
    "2": {"connected": true, ...}
  },
  ...
}
```

## Troubleshooting

1. **Redis Connection Error**
   - Make sure Redis is running: `redis-cli ping`
   - Check Redis connection settings

2. **Port Already in Use**
   - Change the port in `main.py` if 8080 is taken

3. **Test Timeout**
   - Adjust `WAIT_TIMEOUT` in `main.py` if needed
   - Adjust `POLL_INTERVAL` in `test_session.py` 