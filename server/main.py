import json
import time
import uuid
import logging
import traceback
import copy
import threading
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from io import BytesIO
from PIL import Image, ImageDraw

# Configure logging for Cloud Functions
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration - hardcoded values
PROJECT_ID = "misc-445318"
FUNCTION_NAME = "game-api"
REGION = "europe-west1"
CORS_ORIGIN = "*"  # Allow all origins for now
WAIT_TIMEOUT = 30  # seconds for long polling
SESSION_TIMEOUT = 3600  # 1 hour for game sessions
MOCK_SESSIONS = {}
MOCK_SESSIONS_LOCK = threading.Lock()

def log_request_info(request):
    """Log detailed request information"""
    try:
        info = {
            "method": request.method,
            "path": request.path,
            "args": dict(request.args),
            "headers": dict(request.headers),
            "content_type": request.content_type,
            "content_length": request.content_length
        }
        logger.info(f"Request info: {json.dumps(info, indent=2)}")
    except Exception as e:
        logger.error(f"Error logging request info: {str(e)}")

def get_firestore_client():
    """Get Firestore client with error handling"""
    try:
        from google.cloud import firestore
        logger.info("Connecting to Firestore")
        db = firestore.Client(project=PROJECT_ID)
        # Test connection by getting server timestamp
        test_ref = db.collection('_test').document('connection')
        test_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
        logger.info("Firestore connection successful")
        return db
    except ImportError as e:
        logger.error(f"Firestore module not available: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Firestore connection failed: {str(e)}")
        return None

def clean_firestore_timestamps(data):
    """Convert Firestore timestamps to JSON-serializable ISO strings"""
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            if hasattr(value, 'isoformat'):  # Firestore timestamp
                cleaned[key] = value.isoformat()
            elif isinstance(value, dict):
                cleaned[key] = clean_firestore_timestamps(value)
            elif isinstance(value, list):
                cleaned[key] = [clean_firestore_timestamps(item) if isinstance(item, dict) else item for item in value]
            else:
                cleaned[key] = value
        return cleaned
    return data

def create_mock_session(rotation_frequency=3):
    """Create a mock session when Firestore is not available"""
    session_id = str(uuid.uuid4())
    session_data = {
        "sessionId": session_id,
        "status": "waiting",
        "players": {
            "1": {
                "connected": True, 
                "lastSeen": datetime.now().isoformat()
            },
            "2": {
                "connected": False, 
                "lastSeen": None
            }
        },
        "moves": [],  # Empty moves array
        "currentPlayer": 1,
        "moveCount": 0,
        "rotationFrequency": rotation_frequency,
        "gameOver": False,
        "winner": None,
        "createdAt": datetime.now().isoformat(),
        "expiresAt": (datetime.now() + timedelta(seconds=SESSION_TIMEOUT)).isoformat(),
        "mock": True,
        "message": "Using mock data - Firestore not available"
    }
    logger.info(f"Created mock session: {session_id}")
    return session_data

def is_mock_session_expired(session_data):
    """Check if an in-memory mock session has expired."""
    expires_at = session_data.get("expiresAt")
    if not expires_at:
        return False

    try:
        return datetime.fromisoformat(expires_at) <= datetime.now()
    except ValueError:
        # If timestamp is malformed, keep session rather than dropping unexpectedly.
        return False

def get_mock_session(session_id):
    """Fetch mock session by ID, removing expired sessions."""
    with MOCK_SESSIONS_LOCK:
        session = MOCK_SESSIONS.get(session_id)
        if not session:
            return None

        if is_mock_session_expired(session):
            del MOCK_SESSIONS[session_id]
            return None

        return copy.deepcopy(session)

def save_mock_session(session_data):
    """Persist mock session in memory."""
    with MOCK_SESSIONS_LOCK:
        MOCK_SESSIONS[session_data["sessionId"]] = copy.deepcopy(session_data)

def handle_create_session(request):
    """Handle session creation with Firestore"""
    try:
        logger.info("Handling session creation")

        # Get rotation frequency from client, with a default of 3
        req_data = request.get_json(silent=True) or {}
        rotation_frequency = int(req_data.get('rotationFrequency', 3))
        logger.info(f"Using rotation frequency from client: {rotation_frequency}")
        
        db = get_firestore_client()
        if db is None:
            logger.warning("Firestore not available, using mock session")
            # This mock response should also respect the frequency for local testing
            mock_session = create_mock_session(rotation_frequency=rotation_frequency)
            save_mock_session(mock_session)
            return {
                "sessionId": mock_session["sessionId"],
                "playerId": 1,
                "status": "waiting",
                "gameState": mock_session
            }

        session_id = str(uuid.uuid4())
        
        # Create session data with Firestore SERVER_TIMESTAMP
        from google.cloud import firestore
        session_data = {
            "sessionId": session_id,
            "status": "waiting",
            "players": {
                "1": {
                    "connected": True, 
                    "lastSeen": firestore.SERVER_TIMESTAMP
                },
                "2": {
                    "connected": False, 
                    "lastSeen": None
                }
            },
            "moves": [],
            "currentPlayer": 1,
            "moveCount": 0,
            "rotationFrequency": rotation_frequency, # Use value from client
            "gameOver": False,
            "winner": None,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "expiresAt": datetime.now() + timedelta(seconds=SESSION_TIMEOUT)
        }
        
        # Store in Firestore
        session_ref = db.collection('game_sessions').document(session_id)
        session_ref.set(session_data)
        
        # Fetch the created document to include server-generated timestamps
        time.sleep(0.1) # Allow a moment for timestamp to be set
        created_doc = session_ref.get()
        if not created_doc.exists:
            raise Exception("Failed to create and retrieve session document")
            
        final_session_data = clean_firestore_timestamps(created_doc.to_dict())

        result = {
            "sessionId": session_id,
            "playerId": 1,
            "status": "waiting",
            "gameState": final_session_data # Return the full initial state
        }
        
        logger.info(f"Created Firestore session: {session_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in handle_create_session: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def handle_join_session():
    """Handle joining a session with Firestore"""
    try:
        logger.info("Handling session join")
        
        if request.content_type != 'application/json':
            return {"error": "Content-Type must be application/json"}, 400
            
        data = request.get_json()
        if not data:
            return {"error": "No JSON data provided"}, 400
            
        session_id = data.get('sessionId')
        if not session_id:
            return {"error": "sessionId is required"}, 400
            
        logger.info(f"Attempting to join session: {session_id}")
        
        db = get_firestore_client()
        if db is None:
            session_data = get_mock_session(session_id)
            if session_data is None:
                return {"error": "Session not found"}, 404

            if session_data["players"]["2"]["connected"]:
                return {"error": "Game is full"}, 400

            session_data["players"]["2"]["connected"] = True
            session_data["players"]["2"]["lastSeen"] = datetime.now().isoformat()
            session_data["status"] = "playing"
            save_mock_session(session_data)

            return {
                "playerId": 2,
                "gameState": session_data
            }
        
        # Get session from Firestore
        session_ref = db.collection('game_sessions').document(session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"error": "Session not found"}, 404
            
        session_data = clean_firestore_timestamps(session_doc.to_dict())
        
        if session_data["players"]["2"]["connected"]:
            return {"error": "Game is full"}, 400
            
        # Update player 2 status
        from google.cloud import firestore
        session_ref.update({
            "players.2.connected": True,
            "players.2.lastSeen": firestore.SERVER_TIMESTAMP,
            "status": "playing"
        })
        
        # Get updated session data and convert timestamps
        updated_doc = session_ref.get()
        updated_data = clean_firestore_timestamps(updated_doc.to_dict())
        
        result = {
            "playerId": 2,
            "gameState": updated_data
        }
        
        logger.info(f"Player joined session: {session_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in handle_join_session: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def handle_get_session_state(session_id):
    """Get the full state of a game session"""
    try:
        logger.info(f"Getting state for session: {session_id}")
        
        db = get_firestore_client()
        if db is None:
            session_data = get_mock_session(session_id)
            if session_data is None:
                return {"error": "Session not found"}, 404
            return session_data
        
        session_ref = db.collection('game_sessions').document(session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"error": "Session not found"}, 404
            
        # Clean timestamps and return the full session data
        game_state = clean_firestore_timestamps(session_doc.to_dict())
        return game_state
        
    except Exception as e:
        logger.error(f"Error in handle_get_session_state: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def handle_submit_move():
    """Handle move submission with minimal validation"""
    try:
        logger.info("Handling move submission")
        
        if request.content_type != 'application/json':
            return {"error": "Content-Type must be application/json"}, 400
            
        data = request.get_json()
        if not data:
            return {"error": "No JSON data provided"}, 400
            
        # Minimal validation - just check required fields exist
        required_fields = ['sessionId', 'playerId', 'column']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return {"error": f"Missing required fields: {missing_fields}"}, 400
            
        session_id = data['sessionId']
        player_id = data['playerId']
        column = data['column']
        
        logger.info(f"Move: Player {player_id} -> Column {column} in session {session_id}")
        
        db = get_firestore_client()
        if db is None:
            session_data = get_mock_session(session_id)
            if session_data is None:
                return {"error": "Session not found"}, 404

            current_move_count = session_data.get('moveCount', 0)
            move = {
                'player': player_id,
                'column': column,
                'moveNumber': current_move_count + 1,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

            session_data.setdefault('moves', []).append(move)
            session_data['moveCount'] = current_move_count + 1
            save_mock_session(session_data)

            return {
                "success": True,
                "mock": True,
                "message": "Move stored in mock session",
                "moveNumber": current_move_count + 1
            }
        
        # Get session from Firestore
        session_ref = db.collection('game_sessions').document(session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"error": "Session not found"}, 404
            
        session_data = session_doc.to_dict()
        current_move_count = session_data.get('moveCount', 0)
        
        # Create move object (server doesn't validate game logic)
        # Note: Can't use SERVER_TIMESTAMP in array elements, so use current UTC time
        move = {
            'player': player_id,
            'column': column,
            'moveNumber': current_move_count + 1,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Append move to session's moves array and increment move count
        from google.cloud import firestore
        session_ref.update({
            'moves': firestore.ArrayUnion([move]),
            'moveCount': current_move_count + 1
        })
        
        result = {
            "success": True,
            "moveNumber": current_move_count + 1
        }
        
        logger.info(f"Move stored: #{current_move_count + 1} for session {session_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in handle_submit_move: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def handle_get_moves(session_id):
    """Get moves for a session with optional 'since' parameter"""
    try:
        logger.info(f"Getting moves for session: {session_id}")
        
        # Get 'since' parameter (defaults to 0)
        since_move = request.args.get('since', 0, type=int)
        logger.info(f"Requesting moves since move #{since_move}")
        
        db = get_firestore_client()
        if db is None:
            session_data = get_mock_session(session_id)
            if session_data is None:
                return {"error": "Session not found"}, 404

            all_moves = session_data.get('moves', [])
            current_move_count = session_data.get('moveCount', 0)
            new_moves = [move for move in all_moves if move.get('moveNumber', 0) > since_move]

            return {
                "moves": new_moves,
                "currentMoveCount": current_move_count,
                "sessionId": session_id,
                "mock": True,
                "message": "Moves returned from mock session"
            }
        
        # Get session from Firestore
        session_ref = db.collection('game_sessions').document(session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"error": "Session not found"}, 404
            
        session_data = clean_firestore_timestamps(session_doc.to_dict())
        all_moves = session_data.get('moves', [])
        current_move_count = session_data.get('moveCount', 0)
        
        # Filter moves by moveNumber > since
        new_moves = [move for move in all_moves if move.get('moveNumber', 0) > since_move]
        
        result = {
            "moves": new_moves,
            "currentMoveCount": current_move_count,
            "sessionId": session_id
        }
        
        logger.info(f"Returning {len(new_moves)} new moves (since #{since_move})")
        return result
        
    except Exception as e:
        logger.error(f"Error in handle_get_moves: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def hello_world(request):
    """
    Main Cloud Function entry point
    """
    try:
        # Log all request details
        log_request_info(request)
        
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': CORS_ORIGIN,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)
        
        # Set default CORS headers for JSON responses
        headers = {
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Content-Type': 'application/json'
        }
        
        # Parse path
        path = request.path.strip('/')
        parts = path.split('/')
        
        logger.info(f"Processing {request.method} {path}")
        
        # Route requests
        if request.method == 'POST':
            if path == 'session/create':
                result = handle_create_session(request)
                return json.dumps(result), 200, headers
            elif path == 'session/join':
                result = handle_join_session()
                if isinstance(result, tuple):  # Error case
                    return json.dumps(result[0]), result[1], headers
                return json.dumps(result), 200, headers
            elif path == 'move':
                result = handle_submit_move()
                if isinstance(result, tuple):  # Error case
                    return json.dumps(result[0]), result[1], headers
                return json.dumps(result), 200, headers
            elif path == 'generate_gif':
                # Binary response: animated GIF
                try:
                    if request.content_type != 'application/json':
                        return json.dumps({"error": "Content-Type must be application/json"}), 400, headers
                    payload = request.get_json(silent=True) or {}
                    gif_bytes = render_gif_from_history(payload)
                    bin_headers = {
                        'Access-Control-Allow-Origin': CORS_ORIGIN,
                        'Content-Type': 'image/gif'
                    }
                    return gif_bytes, 200, bin_headers
                except Exception as e:
                    logger.error(f"Error generating GIF: {str(e)}")
                    return json.dumps({"error": "Failed to generate GIF", "message": str(e)}), 500, headers
                
        elif request.method == 'GET':
            if path == 'health' or path == '' or path == 'hello':
                health_info = {
                    "status": "healthy",
                    "service": "game-api",
                    "function": FUNCTION_NAME,
                    "project": PROJECT_ID,
                    "region": REGION,
                    "firestore_available": get_firestore_client() is not None,
                    "timestamp": datetime.now().isoformat()
                }
                return json.dumps(health_info), 200, headers
            elif path.startswith('moves/'):
                session_id = path.replace('moves/', '')
                result = handle_get_moves(session_id)
                if isinstance(result, tuple):  # Error case
                    return json.dumps(result[0]), result[1], headers
                return json.dumps(result), 200, headers
            elif path.startswith('session/'):
                session_id = path.replace('session/', '')
                result = handle_get_session_state(session_id)
                if isinstance(result, tuple):  # Error case
                    return json.dumps(result[0]), result[1], headers
                return json.dumps(result), 200, headers
        
        # Default 404 response
        not_found = {
            "error": "Not found",
            "path": path,
            "method": request.method,
            "available_endpoints": [
                "POST /session/create",
                "POST /session/join", 
                "POST /move",
                "GET /moves/{sessionId}?since=N",
                "GET /session/{sessionId}",
                "GET /health"
            ]
        }
        return json.dumps(not_found), 404, headers
        
    except Exception as e:
        error_details = {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'path': request.path if hasattr(request, 'path') else 'unknown',
            'method': request.method if hasattr(request, 'method') else 'unknown',
            'traceback': traceback.format_exc()
        }
        logger.error(f"Unhandled error: {json.dumps(error_details, indent=2)}")
        
        headers = {
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Content-Type': 'application/json'
        }
        
        error_response = {
            'error': 'Internal server error',
            'message': str(e),
            'type': type(e).__name__
        }
        return json.dumps(error_response), 500, headers

# For local Flask testing
app = Flask(__name__)
CORS(app, origins=[CORS_ORIGIN])

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def flask_handler(path):
    """Flask wrapper for local testing"""
    return hello_world(request)

if __name__ == '__main__':
    print(f"Starting local Flask server...")
    print(f"Function name: {FUNCTION_NAME}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"Region: {REGION}")
    print(f"Storage: Firestore")
    print("Available endpoints:")
    print("  POST /session/create")
    print("  POST /session/join")
    print("  POST /move")
    print("  GET  /moves/{sessionId}?since=N")
    print("  GET  /session/{sessionId}")
    print("  GET  /health")
    print("")
    
    app.run(host='0.0.0.0', port=8080, debug=True) 


# ================= GIF RENDERING =================
def render_gif_from_history(payload: dict) -> bytes:
    """Render an animated GIF (with stone drops and board rotations) from history.

    Expects full `history` array so we can access previous steps during rotation.
    """
    grid_size = int(payload.get('gridSize', 6))
    history = payload.get('history', [])
    winners = set(payload.get('winners', []))
    player_colors = payload.get('playerColors', {"1": "#FFFFFF", "2": "#000000"})

    # Geometry and style constants (match client roughly), scaled down by 3
    scale = 1/3
    cell_px = int(60 * scale)
    gap_px = int(5 * scale) or 1
    stone_px = int(50 * scale)
    pad_px = int(10 * scale)
    bg_rgba = (247, 248, 252, 255)
    grid_fill = (224, 224, 224, 255)
    grid_outline = (220, 220, 220, 255)
    width = grid_size * cell_px + (grid_size - 1) * gap_px + 2 * pad_px
    height = width

    frames: list[Image.Image] = []
    durations: list[int] = []  # in ms

    def draw_board(board_state):
        img = Image.new('RGBA', (width, height), bg_rgba)
        draw = ImageDraw.Draw(img)
        # Grid
        for rr in range(grid_size):
            for cc in range(grid_size):
                x = pad_px + cc * (cell_px + gap_px)
                y = pad_px + rr * (cell_px + gap_px)
                draw.rounded_rectangle([x, y, x + cell_px, y + cell_px], radius=6, fill=grid_fill, outline=grid_outline)
        # Stones
        if board_state:
            for rr in range(grid_size):
                for cc in range(grid_size):
                    d = board_state[rr][cc]
                    if d:
                        color = player_colors.get(str(d.get('playerId')), '#000000')
                        sx = pad_px + cc * (cell_px + gap_px) + (cell_px - stone_px) // 2
                        sy = pad_px + rr * (cell_px + gap_px) + (cell_px - stone_px) // 2
                        draw.ellipse([sx, sy, sx + stone_px, sy + stone_px], fill=color, outline=(0, 0, 0, 25), width=2)
                        if d.get('id') in winners and len(winners) >= 4:
                            draw.ellipse([sx - 2, sy - 2, sx + stone_px + 2, sy + stone_px + 2], outline=(0, 160, 0, 255), width=5)
        return img

    def add_frame(img: Image.Image, ms: int):
        # Keep frames in RGBA; let PIL handle palette conversion when saving
        frames.append(img)
        durations.append(ms)

    def interpolate(a: float, b: float, t: float) -> float:
        return a + (b - a) * t

    def draw_drop_animation(prev_board, row, col, player_id, steps=10, frame_ms=60):
        # Animate stone falling from above (just above row 0) to target row
        base = draw_board(prev_board)
        color = player_colors.get(str(player_id), '#000000')
        start_y = pad_px + (0 * (cell_px + gap_px)) + (cell_px - stone_px) // 2 - (cell_px + 2 * gap_px)
        end_y = pad_px + row * (cell_px + gap_px) + (cell_px - stone_px) // 2
        x = pad_px + col * (cell_px + gap_px) + (cell_px - stone_px) // 2
        for i in range(steps):
            t = (i + 1) / steps
            iy = int(round(interpolate(start_y, end_y, t)))
            frame = base.copy()
            d = ImageDraw.Draw(frame)
            d.ellipse([x, iy, x + stone_px, iy + stone_px], fill=color, outline=(0, 0, 0, 25), width=2)
            add_frame(frame, frame_ms)

    def draw_rotation_frames(prev_board, steps=10, frame_ms=50):
        # Render previous board, then rotate whole image from 0 to -90 degrees
        base = draw_board(prev_board)
        for i in range(steps):
            # PIL rotates counter-clockwise for positive angles; game rotates -90deg in CSS (CCW), so use +90 here
            angle = 90.0 * (i + 1) / steps
            frame = base.rotate(angle, resample=Image.BICUBIC, expand=False, center=(width // 2, height // 2), fillcolor=bg_rgba)
            add_frame(frame, frame_ms)

    def draw_gravity_animation(pre_rot_board, post_rot_board, steps=10, frame_ms=60):
        # Stones fall vertically from pre-rotation positions to post-rotation positions (same columns)
        # Build lists per column of (playerColor, startRow, endRow)
        motions = []
        for c in range(grid_size):
            start_rows = []
            end_rows = []
            for r in range(grid_size):
                if pre_rot_board and pre_rot_board[r][c]:
                    start_rows.append({
                        'playerId': pre_rot_board[r][c]['playerId'],
                        'id': pre_rot_board[r][c].get('id'),
                        'row': r
                    })
            for r in range(grid_size):
                if post_rot_board and post_rot_board[r][c]:
                    end_rows.append({
                        'playerId': post_rot_board[r][c]['playerId'],
                        'id': post_rot_board[r][c].get('id'),
                        'row': r
                    })
            n = min(len(start_rows), len(end_rows))
            for i in range(n):
                motions.append({
                    'playerId': start_rows[i]['playerId'],
                    'id': start_rows[i]['id'],
                    'col': c,
                    'startRow': start_rows[i]['row'],
                    'endRow': end_rows[i]['row']
                })

        # Animate
        for s in range(steps):
            t = (s + 1) / steps
            # Start from final state visual and overlay moving stones at intermediate positions
            frame = draw_board(post_rot_board)
            d = ImageDraw.Draw(frame)
            for m in motions:
                color = player_colors.get(str(m['playerId']), '#000000')
                x = pad_px + m['col'] * (cell_px + gap_px) + (cell_px - stone_px) // 2
                sy = pad_px + m['startRow'] * (cell_px + gap_px) + (cell_px - stone_px) // 2
                ey = pad_px + m['endRow'] * (cell_px + gap_px) + (cell_px - stone_px) // 2
                iy = int(round(interpolate(sy, ey, t)))
                d.ellipse([x, iy, x + stone_px, iy + stone_px], fill=color, outline=(0, 0, 0, 25), width=2)
            add_frame(frame, frame_ms)

    # Build animated sequence across history
    for idx, step in enumerate(history):
        move_type = step.get('moveType')
        if move_type == 'move':
            # Animate drop using previous state's board as background
            prev_board = history[idx - 1]['boardState'] if idx > 0 else [[None for _ in range(grid_size)] for __ in range(grid_size)]
            row = step.get('lastMoveRow')
            col = step.get('lastMoveColumn')
            player = step.get('player') or 1
            if row is not None and col is not None:
                draw_drop_animation(prev_board, row, col, player, steps=10, frame_ms=60)
            # Dwell on the resulting static board for readability
            add_frame(draw_board(step.get('boardState')), 400)

        elif move_type == 'rotation':
            # Show rotation from previous board, then gravity from preRotation -> final
            prev_board = history[idx - 1]['boardState'] if idx > 0 else step.get('preRotationBoardState')
            pre_rot = step.get('preRotationBoardState')
            post_rot = step.get('boardState')
            if prev_board:
                draw_rotation_frames(prev_board, steps=10, frame_ms=50)
            if pre_rot and post_rot:
                # After rotation completes, switch back to unrotated frame and animate gravity
                draw_gravity_animation(pre_rot, post_rot, steps=10, frame_ms=60)
            # Dwell on the final rotated+settled board
            add_frame(draw_board(post_rot), 400)

        else:
            # game_start or unknown: just show static briefly
            add_frame(draw_board(step.get('boardState')), 300)

    # If winners exist, add a final hold frame to showcase green rings
    if history:
        add_frame(draw_board(history[-1].get('boardState')), 800)

    # Save to GIF in memory with per-frame durations
    if not frames:
        img = Image.new('RGB', (512, 512), (255, 255, 255))
        frames = [img]
        durations = [800]

    buf = BytesIO()
    first, *rest = frames
    first.save(
        buf,
        format='GIF',
        save_all=True,
        append_images=rest,
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False
    )
    buf.seek(0)
    return buf.read()