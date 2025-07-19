#!/usr/bin/env python3
"""
Deploy script for Game API Cloud Function
"""

# Configuration - hardcoded values (update these for your project)
PROJECT_ID = "misc-445318"
FUNCTION_NAME = "game-api"
REGION = "europe-west1"
ENTRY_POINT = "hello_world"
RUNTIME = "python312"
MEMORY = "256MB"
TIMEOUT = "60s"
MAX_INSTANCES = "10"
SOURCE_DIR = "."  # Current directory (server/)

import subprocess
import sys
import json

def run_command(cmd, check=True, capture_output=False):
    """Run a shell command and return the result"""
    print(f"Running: {' '.join(cmd)}")
    
    if capture_output:
        result = subprocess.run(cmd, capture_output=True, text=True, check=check)
        return result.stdout.strip()
    else:
        result = subprocess.run(cmd, check=check)
        return result.returncode == 0

def is_api_enabled(api):
    """Check if a GCP API is enabled"""
    try:
        result = run_command([
            'gcloud', 'services', 'list',
            '--format=value(NAME)',
            f'--filter=NAME:{api}'
        ], capture_output=True)
        return api in result
    except Exception:
        return False

def get_current_project():
    """Get the currently set GCP project"""
    try:
        return run_command([
            'gcloud', 'config', 'get-value', 'project'
        ], capture_output=True)
    except Exception:
        return None

def check_gcloud_auth():
    """Check if gcloud is authenticated"""
    try:
        output = run_command(['gcloud', 'auth', 'list', '--format=json'], capture_output=True)
        accounts = json.loads(output)
        active_accounts = [acc for acc in accounts if acc.get('status') == 'ACTIVE']
        
        if not active_accounts:
            print("❌ No active gcloud authentication found")
            print("Please run: gcloud auth login")
            return False
            
        print(f"✅ Already authenticated as: {active_accounts[0]['account']}")
        return True
        
    except Exception as e:
        print(f"❌ Error checking gcloud auth: {e}")
        return False

def set_project():
    """Set the GCP project if not already set"""
    current_project = get_current_project()
    
    if current_project == PROJECT_ID:
        print(f"✅ Project already set to: {PROJECT_ID}")
        return True
        
    try:
        run_command(['gcloud', 'config', 'set', 'project', PROJECT_ID])
        print(f"✅ Project set to: {PROJECT_ID}")
        return True
    except Exception as e:
        print(f"❌ Error setting project: {e}")
        return False

def enable_apis():
    """Enable required GCP APIs if not already enabled"""
    apis = [
        'cloudfunctions.googleapis.com',
        'cloudbuild.googleapis.com',
        'redis.googleapis.com'
    ]
    
    for api in apis:
        if is_api_enabled(api):
            print(f"✅ {api} is already enabled")
            continue
            
        try:
            print(f"Enabling {api}...")
            run_command(['gcloud', 'services', 'enable', api])
            print(f"✅ Enabled: {api}")
        except Exception as e:
            print(f"⚠️  Warning: Could not enable {api}: {e}")

def get_function_status():
    """Check if function exists and get its status"""
    try:
        result = run_command([
            'gcloud', 'functions', 'describe', FUNCTION_NAME,
            '--region', REGION,
            '--format=json'
        ], capture_output=True)
        return json.loads(result)
    except Exception:
        return None

def deploy_function():
    """Deploy the Cloud Function"""
    # Check if function exists and get its current state
    existing_func = get_function_status()
    action = "Updating" if existing_func else "Creating"
    
    cmd = [
        'gcloud', 'functions', 'deploy', FUNCTION_NAME,
        '--runtime', RUNTIME,
        '--trigger-http',
        '--entry-point', ENTRY_POINT,
        '--source', SOURCE_DIR,
        '--region', REGION,
        '--memory', MEMORY,
        '--timeout', TIMEOUT,
        '--max-instances', MAX_INSTANCES,
        '--allow-unauthenticated',  # For testing
        '--quiet'  # Skip prompts
    ]
    
    try:
        print(f"\n🚀 {action} function '{FUNCTION_NAME}' in region '{REGION}'...")
        print("This may take 2-3 minutes...")
        
        run_command(cmd)
        print(f"✅ Function {action.lower()}d successfully!")
        
        # Get the function details including URL
        details_cmd = [
            'gcloud', 'functions', 'describe', FUNCTION_NAME,
            '--region', REGION,
            '--format=json'
        ]
        
        details = json.loads(run_command(details_cmd, capture_output=True))
        
        # For GEN_2 functions, use the 'uri' field, otherwise fall back to 'url'
        function_url = details.get('serviceConfig', {}).get('uri') or details.get('url')
        
        if not function_url:
            print("⚠️  Warning: Could not get function URL")
            return None
            
        print(f"\n🌍 Function URL: {function_url}")
        return function_url
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        return None

def main():
    """Main deployment function"""
    print("🎮 Game API Cloud Function Deployment Script")
    print("=" * 50)
    print(f"Project ID: {PROJECT_ID}")
    print(f"Function Name: {FUNCTION_NAME}")
    print(f"Region: {REGION}")
    print(f"Runtime: {RUNTIME}")
    print()
    
    # Check authentication
    print("🔐 Checking authentication...")
    if not check_gcloud_auth():
        sys.exit(1)
    
    # Set project
    print(f"\n📋 Checking project configuration...")
    if not set_project():
        sys.exit(1)
    
    # Enable APIs
    print("\n🔧 Checking required APIs...")
    enable_apis()
    
    # Deploy function
    print(f"\n🚀 Starting deployment...")
    function_url = deploy_function()
    
    if function_url:
        print(f"\n✅ Deployment complete!")
        print(f"🌍 Function URL: {function_url}")
    else:
        print(f"\n❌ Deployment failed!")
        sys.exit(1)

if __name__ == '__main__':
    main() 