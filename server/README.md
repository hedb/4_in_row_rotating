# Game API Cloud Function

Simple hello world Cloud Function for the 4-in-a-row multiplayer game backend.

## Quick Start

### 1. Configure the Project

Edit the hardcoded values at the top of both files:

**main.py**:
```python
PROJECT_ID = "your-actual-gcp-project-id"
FUNCTION_NAME = "game-api"
REGION = "us-central1"
CORS_ORIGIN = "http://localhost:8000"  # Your game's URL
```

**deploy_func.py**:
```python
PROJECT_ID = "your-actual-gcp-project-id"  # Same as main.py
FUNCTION_NAME = "game-api"
REGION = "us-central1"
```

### 2. Test Locally

```bash
cd server
python deploy_func.py local
```

This will start a Flask server on `http://localhost:8080`

**Test endpoints**:
- `http://localhost:8080/hello`
- `http://localhost:8080/health`
- `http://localhost:8080/hello?name=YourName`

### 3. Deploy to GCP

First, make sure you have gcloud CLI installed and authenticated:

```bash
# Install gcloud CLI (if not already installed)
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Deploy
cd server
python deploy_func.py
```

The script will:
- Check authentication
- Set the project
- Enable required APIs
- Deploy the function
- Test the deployed function

### 4. Manual Testing

You can also test manually with curl:

```bash
# Local testing
curl "http://localhost:8080/hello?name=Test"
curl "http://localhost:8080/health"

# GCP testing (replace with your function URL)
curl "https://us-central1-yourproject.cloudfunctions.net/game-api/hello"
curl "https://us-central1-yourproject.cloudfunctions.net/game-api/health"
```

## File Structure

```
server/
├── main.py           # Cloud Function code
├── deploy_func.py    # Deployment script
├── requirements.txt  # Python dependencies
└── README.md        # This file
```

## Deploy Script Commands

```bash
python deploy_func.py           # Deploy to GCP
python deploy_func.py local     # Run locally
python deploy_func.py test <url> # Test deployed function
python deploy_func.py help      # Show help
```

## Dependencies

- `flask` - Web framework for local testing
- `flask-cors` - CORS handling
- `redis` - For future game state storage
- `google-cloud-functions` - GCP integration

## Next Steps

Once this hello world version is working:

1. Add Redis connection for game state
2. Add game session endpoints (create, join, move)
3. Add proper error handling and validation
4. Add authentication if needed

## Troubleshooting

### Common Issues

1. **Authentication Error**: Run `gcloud auth login`
2. **Project Not Found**: Update `PROJECT_ID` in both files
3. **Permission Denied**: Make sure your account has Cloud Functions Admin role
4. **API Not Enabled**: The script tries to enable APIs automatically

### Local Testing Issues

1. **Port 8080 in use**: Change port in `main.py` at the bottom
2. **CORS errors**: Update `CORS_ORIGIN` in `main.py`
3. **Module not found**: Run `pip install -r requirements.txt` 