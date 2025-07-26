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
        print(f"\n{self.name}: Waiting for other player to join...")
        
        while True:
            state = self.get_state()
            if state and state.get('status') == 'playing':
                print(f"{self.name}: Other player joined! Game is now 'playing'.")
                self.game_state = state
                return state
            
            print(f"{self.name}: Still waiting for game to start... (Status: {state.get('status') if state else 'N/A'})")
            time.sleep(POLL_INTERVAL)
    
    def get_state(self):
        """Get current game state"""
        if not self.session_id:
            print("Error: No session ID available for get_state")
            return None
        
        try:
            response = requests.get(
                f"{API_URL}/session/{self.session_id}",
                timeout=(5, 10)
            )
            
            if response.status_code == 200:
                self.game_state = response.json()
                return self.game_state
            else:
                print(f"Error getting state ({response.status_code}): {response.text}")
                return None
                
        except Exception as e:
            print(f"Error in get_state: {str(e)}")
            return None

    def submit_move(self, column):
        """Submit a move to the game"""
        print(f"\n{self.name}: Submitting move - column {column}")
        
        try:
            response = requests.post(
                f"{API_URL}/move",
                json={
                    "sessionId": self.session_id,
                    "playerId": self.player_id,
                    "column": column
                },
                timeout=(5, 10)
            )
            print(f"Move Status Code: {response.status_code}")
            print(f"Move Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"{self.name}: Move submitted successfully! Move #{data.get('moveNumber')}")
                return data
            else:
                print(f"{self.name}: Move failed: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error submitting move: {str(e)}")
            return None

    def get_moves(self, since=0):
        """Get moves since a specific move number"""
        print(f"\n{self.name}: Getting moves since #{since}")
        
        try:
            url = f"{API_URL}/moves/{self.session_id}"
            if since > 0:
                url += f"?since={since}"
                
            response = requests.get(url, timeout=(5, 10))
            print(f"Get Moves Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"{self.name}: Retrieved {len(data.get('moves', []))} new moves")
                return data
            else:
                print(f"{self.name}: Failed to get moves: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error getting moves: {str(e)}")
            return None

def test_move_functionality():
    """Test the move submission and polling functionality"""
    print("\n" + "="*60)
    print("TESTING MOVE FUNCTIONALITY")
    print("="*60)
    
    # Create players
    host = GameClient("Player 1 (Host)")
    guest = GameClient("Player 2 (Guest)")
    
    # Host creates game
    game_data = host.create_game()
    session_id = game_data["sessionId"]
    
    # Guest joins
    guest.join_game(session_id)
    
    # Test move submission
    print("\n--- Testing Move Submission ---")
    
    # Player 1 makes first move
    move1_result = host.submit_move(3)  # Column 3
    if move1_result:
        print(f"✅ Move 1 successful: {move1_result}")
    else:
        print("❌ Move 1 failed")
        return
    
    # Player 2 gets moves
    moves_result = guest.get_moves(since=0)
    if moves_result:
        print(f"✅ Move polling successful: {moves_result}")
        print(f"   Moves retrieved: {len(moves_result.get('moves', []))}")
        print(f"   Current move count: {moves_result.get('currentMoveCount')}")
    else:
        print("❌ Move polling failed")
        return
    
    # Player 2 makes second move
    move2_result = guest.submit_move(4)  # Column 4
    if move2_result:
        print(f"✅ Move 2 successful: {move2_result}")
    else:
        print("❌ Move 2 failed")
        return
    
    # Player 1 gets new moves (since move 1)
    new_moves = host.get_moves(since=1)
    if new_moves:
        print(f"✅ Incremental move polling successful: {new_moves}")
        print(f"   New moves since #1: {len(new_moves.get('moves', []))}")
    else:
        print("❌ Incremental move polling failed")
        return
    
    # Get all moves to see the complete history
    all_moves = host.get_moves(since=0)
    if all_moves:
        print(f"\n--- Complete Move History ---")
        print(f"Total moves: {all_moves.get('currentMoveCount')}")
        for i, move in enumerate(all_moves.get('moves', [])):
            print(f"  Move {i+1}: Player {move.get('player')} -> Column {move.get('column')} (#{move.get('moveNumber')})")
    
    print("\n✅ All move functionality tests passed!")

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
    # First test session creation/joining
    simulate_game()
    
    # Then test move functionality
    test_move_functionality() 