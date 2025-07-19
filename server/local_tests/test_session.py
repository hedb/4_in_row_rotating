#!/usr/bin/env python3
"""
Test script to simulate a full game session between two players
"""

import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor

# Configuration
# API_URL = "http://localhost:8080"
API_URL = 'https://game-api-ld4c7ubata-ew.a.run.app'
POLL_INTERVAL = 2  # seconds

class GameClient:
    def __init__(self, name):
        self.name = name
        self.session_id = None
        self.player_id = None
        self.game_state = None
    
    def create_game(self):
        """Create a new game session"""
        print(f"\n{self.name}: Creating new game session...")
        print(f"Connecting to: {API_URL}/session/create")
        
        try:
            response = requests.post(
                f"{API_URL}/session/create",
                timeout=(3, 5)  # (connect timeout, read timeout) in seconds
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {response.headers}")
        except requests.ConnectTimeout:
            print("Error: Connection timed out - server might be down or unreachable")
            raise
        except requests.ReadTimeout:
            print("Error: Server took too long to respond")
            raise
        except requests.RequestException as e:
            print(f"Error: Request failed: {str(e)}")
            raise
        print(f"Response Text: {response.text}")
        
        try:
            data = response.json()
            self.session_id = data["sessionId"]
            self.player_id = data["playerId"]
            
            print(f"{self.name}: Created session {self.session_id}")
            print(f"Host Link: {data['hostLink']}")
            print(f"Guest Link: {data['guestLink']}")
            return data
        except Exception as e:
            print(f"Error parsing response: {str(e)}")
            print(f"Full response content: {response.content}")
            raise
    
    def join_game(self, session_id):
        """Join an existing game"""
        print(f"\n{self.name}: Joining game {session_id}...")
        
        try:
            response = requests.post(
                f"{API_URL}/session/join",
                json={"sessionId": session_id},
                timeout=(5, 15)
            )
            print(f"Join Status Code: {response.status_code}")
            print(f"Join Response Text: {response.text}")
            
            data = response.json()
            
            if "error" in data:
                print(f"Join Error: {data}")
                return data
            
            self.session_id = session_id
            self.player_id = data["playerId"]
            self.game_state = data["gameState"]
            
            print(f"{self.name}: Joined as Player {self.player_id}")
            return data
            
        except Exception as e:
            print(f"Error joining game: {str(e)}")
            print(f"Response content: {response.content if 'response' in locals() else 'No response'}")
            raise
    
    def wait_for_player(self):
        """Wait for another player to join"""
        print(f"\n{self.name}: Waiting for other player...")
        
        response = requests.get(f"{API_URL}/session/{self.session_id}/wait")
        data = response.json()
        
        if data.get("status") == "ready":
            print(f"{self.name}: Other player joined!")
            self.game_state = data
        else:
            print(f"{self.name}: Still waiting...")
        
        return data
    
    def get_state(self):
        """Get current game state"""
        response = requests.get(f"{API_URL}/session/{self.session_id}/state")
        self.game_state = response.json()
        return self.game_state

def simulate_game():
    """Simulate a game between two players"""
    
    # Create players
    host = GameClient("Player 1 (Host)")
    guest = GameClient("Player 2 (Guest)")
    
    # Host creates game
    game_data = host.create_game()
    session_id = game_data["sessionId"]
    
    # Start host's waiting thread
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Host waits for guest
        host_future = executor.submit(host.wait_for_player)
        
        # Small delay to ensure host is waiting
        time.sleep(1)
        
        # Guest joins
        guest_future = executor.submit(guest.join_game, session_id)
        
        # Wait for both operations to complete
        host_result = host_future.result()
        guest_result = guest_future.result()
    
    # Verify both players are connected
    print("\nFinal Status:")
    print(f"Host (Player {host.player_id}) session: {host.session_id}")
    print(f"Guest (Player {guest.player_id}) session: {guest.session_id}")
    
    if host_result.get("status") == "ready" and guest.game_state["status"] == "ready":
        print("\n✅ Test successful! Both players connected.")
        print("\nGame State:")
        print(json.dumps(guest.game_state, indent=2))
    else:
        print("\n❌ Test failed! Players not properly connected.")
        print("\nHost result:", json.dumps(host_result, indent=2))
        print("\nGuest result:", json.dumps(guest_result, indent=2))

if __name__ == "__main__":
    simulate_game() 