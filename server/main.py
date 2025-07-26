import json
import time
import uuid
import logging
import traceback
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

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

def create_mock_session():
    """Create a mock session when Firestore is not available"""
    session_id = str(uuid.uuid4())
    session_data = {
        "sessionId": session_id,
        "playerId": 1,
        "status": "waiting",
        "hostLink": f"https://yourgame.com/game/{session_id}?role=host",
        "guestLink": f"https://yourgame.com/game/{session_id}?role=guest",
        "moves": [],  # Empty moves array
        "currentPlayer": 1,
        "moveCount": 0,
        "mock": True,
        "message": "Using mock data - Firestore not available"
    }
    logger.info(f"Created mock session: {session_id}")
    return session_data

def handle_create_session():
    """Handle session creation with Firestore"""
    try:
        logger.info("Handling session creation")
        
        db = get_firestore_client()
        if db is None:
            logger.warning("Firestore not available, using mock session")
            return create_mock_session()
        
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
            "moves": [],  # Array of move events: [{player, row, col, moveNumber, timestamp}, ...]
            "currentPlayer": 1,
            "moveCount": 0,
            "rotationFrequency": 4,
            "gameOver": False,
            "winner": None,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "expiresAt": datetime.now() + timedelta(seconds=SESSION_TIMEOUT)
        }
        
        # Store in Firestore
        session_ref = db.collection('game_sessions').document(session_id)
        session_ref.set(session_data)
        
        result = {
            "sessionId": session_id,
            "playerId": 1,
            "status": "waiting",
            "hostLink": f"https://yourgame.com/game/{session_id}?role=host",
            "guestLink": f"https://yourgame.com/game/{session_id}?role=guest"
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
            return {
                "playerId": 2,
                "gameState": {
                    "status": "ready",
                    "mock": True,
                    "message": "Mock join - Firestore not available"
                }
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
            return {"error": "Firestore not available"}, 503
        
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
            return {
                "success": True,
                "mock": True,
                "message": "Move stored (mock) - Firestore not available"
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
            'timestamp': datetime.utcnow().isoformat()
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
            return {
                "moves": [],
                "currentMoveCount": 0,
                "mock": True,
                "message": "Mock moves - Firestore not available"
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
        
        # Set CORS headers for actual request
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
                result = handle_create_session()
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