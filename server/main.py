# Configuration - hardcoded values
PROJECT_ID = "your-gcp-project-id"
FUNCTION_NAME = "game-api"
REGION = "us-central1"
REDIS_HOST = "10.0.0.1"  # Will be your Cloud Memorystore IP
REDIS_PORT = 6379
CORS_ORIGIN = "http://localhost:8000"  # Your game's local URL

import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app for local testing
app = Flask(__name__)
CORS(app, origins=[CORS_ORIGIN])

def hello_world(request):
    """
    Main Cloud Function entry point
    HTTP Cloud Function that responds to any HTTP request.
    """
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
        'Access-Control-Allow-Origin': CORS_ORIGIN
    }
    
    try:
        # Log the request
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request path: {request.path}")
        logger.info(f"Request args: {request.args}")
        
        # Simple routing based on path
        path = request.path.strip('/')
        
        if not path or path == 'hello':
            return handle_hello(request, headers)
        elif path == 'health':
            return handle_health(request, headers)
        else:
            return jsonify({
                'error': 'Not found',
                'available_endpoints': ['/hello', '/health']
            }), 404, headers
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500, headers

def handle_hello(request, headers):
    """Handle hello endpoint"""
    name = request.args.get('name', 'World')
    
    response_data = {
        'message': f'Hello, {name}!',
        'status': 'success',
        'function_name': FUNCTION_NAME,
        'project_id': PROJECT_ID,
        'region': REGION,
        'method': request.method,
        'timestamp': str(request.environ.get('REQUEST_TIME', 'unknown'))
    }
    
    return jsonify(response_data), 200, headers

def handle_health(request, headers):
    """Handle health check endpoint"""
    response_data = {
        'status': 'healthy',
        'service': 'game-api',
        'version': '1.0.0',
        'redis_configured': bool(REDIS_HOST),
        'cors_origin': CORS_ORIGIN
    }
    
    return jsonify(response_data), 200, headers

# For local Flask testing
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
    print(f"CORS Origin: {CORS_ORIGIN}")
    print("Available endpoints:")
    print("  GET  /hello?name=YourName")
    print("  GET  /health")
    print("")
    
    app.run(host='0.0.0.0', port=8080, debug=True) 