import { ApiController } from './ApiController.js';

export class OnlineGameHandler {
    constructor(gameController) {
        this.gameController = gameController;
        this.apiController = new ApiController();
        
        // Session state
        this.sessionId = null;
        this.playerId = null;
        this.isHost = false;
        this.gameState = 'waiting'; // waiting, playing, finished
        
        // Game state tracking
        this.currentPlayer = 1;
        this.moveCount = 0;
        this.lastMoveReceived = 0;
        this.rotationFrequency = 3;
        
        // Polling
        this.pollingInterval = null;
        this.pollingFrequency = 2000; // 2 seconds
        
        // Rotation tracking
        this.isRotating = false;
        this.lastRotationAtMove = -1; // Track the last move number when rotation occurred
        
        // UI elements
        this.waitingRoom = null;
        this.gameContainer = null;
    }

    // === INITIALIZATION ===

    async initAsHost() {
        console.log('[OnlineGameHandler] Initializing as host...');
        
        if (!this.apiController.isServerConfigured()) {
            this.showError('Server URL not configured. Please update SERVER_BASE_URL in ApiController.js');
            return false;
        }

        this.isHost = true;
        this.showWaitingRoom();

        // --- START OF FIX ---
        // Read the rotation frequency directly from the UI dropdown
        const rotationFrequencyEl = document.getElementById('rotationFrequency');
        const desiredFrequency = parseInt(rotationFrequencyEl.value, 10);
        console.log(`[OnlineGameHandler] Host is using frequency from UI: ${desiredFrequency}`);

        // Create session with the selected frequency
        const result = await this.apiController.createSession(desiredFrequency);
        // --- END OF FIX ---

        if (!result.success) {
            this.showError(`Failed to create session: ${result.error}`);
            return false;
        }

        this.sessionId = result.data.sessionId;
        this.playerId = result.data.playerId;
        
        // The host's local state MUST match the authoritative state from the server.
        const authoritativeState = result.data.gameState || result.data;
        this.rotationFrequency = authoritativeState.rotationFrequency;
        
        console.log('[OnlineGameHandler] Host session created. Synced state from server:', {
            sessionId: this.sessionId,
            playerId: this.playerId,
            status: authoritativeState.status,
            rotationFrequency: this.rotationFrequency // Log the synced frequency
        });
        
        // Now that settings are synced, update the UI.
        this.updateCountdownFromCurrentState();

        // Update waiting room with link
        this.updateWaitingRoomWithLink();
        
        // Start polling for opponent
        console.log('[OnlineGameHandler] Host starting to poll for opponent...');
        this.startPolling();
        
        return true;
    }

    async initAsGuest(sessionId) {
        console.log('[OnlineGameHandler] Initializing as guest for session:', sessionId);
        
        if (!this.apiController.isServerConfigured()) {
            this.showError('Server URL not configured. Please update SERVER_BASE_URL in ApiController.js');
            return false;
        }

        this.isHost = false;
        this.sessionId = sessionId;
        this.showWaitingRoom('Joining game...');

        // Join session
        console.log('[OnlineGameHandler] Guest attempting to join session:', sessionId);
        const result = await this.apiController.joinSession(sessionId);
        if (!result.success) {
            console.error('[OnlineGameHandler] Guest failed to join session:', result.error);
            this.showError(`Failed to join session: ${result.error}`);
            return false;
        }

        this.playerId = result.data.playerId;
        const gameState = result.data.gameState;
        console.log('[OnlineGameHandler] Guest joined successfully:', {
            playerId: this.playerId,
            gameStatus: gameState.status,
            playerCount: Object.keys(gameState.players || {}).length,
            moveCount: gameState.moveCount
        });

        if (gameState.status === 'playing') {
            // Game already started, load current state
            console.log('[OnlineGameHandler] Game already in progress, loading state...');
            await this.loadGameState(gameState);
            this.startGame();
        } else {
            // Still waiting for game to start
            console.log('[OnlineGameHandler] Game not started yet, guest waiting...');
            this.updateWaitingRoom('Waiting for host to start game...');
            this.startPolling();
        }

        return true;
    }

    // === GAME FLOW ===

    async loadGameState(gameState) {
        console.log('[OnlineGameHandler] Loading game state:', gameState);
        
        this.currentPlayer = gameState.currentPlayer;
        this.rotationFrequency = gameState.rotationFrequency || 3;
        
        // --- START OF NEW LOGIC ---
        // Reconstruct the board by replaying the entire game history without animation
        console.log(`[Player ${this.playerId}] Replaying ${gameState.moves.length} moves to sync board...`);
        this.gameController.resetGame();
        
        // This loop simulates the game turn by turn to ensure rotations are applied correctly.
        for (const move of gameState.moves) {
            // Place the stone directly without animation
            const targetRow = this.gameController.getNextAvailableRow(move.column);
            if (targetRow !== null) {
                const stone = new ((await import('./Stone.js')).Stone)(move.player);
                this.gameController.board.placeStone(targetRow, move.column, stone);
            }
            
            // Check if this move triggered a rotation
            if (move.moveNumber > 0 && move.moveNumber % this.rotationFrequency === 0) {
                console.log(`[Player ${this.playerId}] Applying historical rotation at move #${move.moveNumber}`);
                this.gameController.board.rotateGrid();
                this.gameController.board.applyGravity();
            }
        }
        
        // After replaying history, render the final board state once.
        this.gameController.boardRenderer.drawBoard();
        
        // Sync the final move counts
        this.moveCount = gameState.moveCount;
        this.lastMoveReceived = gameState.moveCount;
        
        console.log(`[Player ${this.playerId}] Sync complete. Final move count: ${this.moveCount}`);
        // --- END OF NEW LOGIC ---
    }

    startGame() {
        console.log('[OnlineGameHandler] Starting online game', {
            isHost: this.isHost,
            playerId: this.playerId,
            sessionId: this.sessionId,
            currentGameState: this.gameState
        });
        
        this.gameState = 'playing';
        this.hideWaitingRoom();
        this.showGameContainer();
        
        // Initialize game display
        this.updateTurnIndicator();
        this.updateCountdownFromCurrentState();
        
        if (!this.pollingInterval) {
            console.log('[OnlineGameHandler] Starting polling from startGame()...');
            this.startPolling();
        } else {
            console.log('[OnlineGameHandler] Polling already active, continuing...');
        }
    }

    // === MOVE HANDLING ===

    async handlePlayerInput(selectedRow, col) {
        if (this.gameState !== 'playing') {
            return;
        }

        if (this.currentPlayer !== this.playerId) {
            this.showMessage("It's not your turn!");
            return;
        }

        if (this.gameController.isGameOver() || this.gameController.isInputDisabled()) {
            return;
        }

        // Validate move locally first
        if (this.gameController.isCellOccupied(selectedRow, col)) {
            alert('Cell is already occupied!');
            return;
        }

        const targetRow = this.gameController.getNextAvailableRow(col);
        if (targetRow === null) {
            alert('Column is full!');
            return;
        }

        if (selectedRow > targetRow) {
            alert('You cannot place a stone below the lowest available position!');
            return;
        }

        // Submit move to server
        this.gameController.disableInput();
        this.showMessage('Submitting move...');

        const result = await this.apiController.submitMove(this.sessionId, this.playerId, col);
        
        if (!result.success) {
            this.showError(`Failed to submit move: ${result.error}`);
            this.gameController.enableInput();
            return;
        }

        // Apply move locally with animation (use the actual clicked row)
        await this.applyMoveToBoard({
            player: this.playerId,
            column: col,
            moveNumber: result.data.moveNumber,
            selectedRow: selectedRow // Use the actual clicked row for local player animation
        }, true);

        // Update game state
        this.moveCount = result.data.moveNumber;
        this.lastMoveReceived = this.moveCount;
        console.log('[OnlineGameHandler] Local move completed, updating state:', {
            moveNumber: result.data.moveNumber,
            newMoveCount: this.moveCount
        });
        
        // Only switch player if game is not over
        if (!this.gameController.isGameOver()) {
            this.switchPlayer();
        }
    }

    async applyMoveToBoard(move, animate = true) {
        const { player, column, selectedRow = 0 } = move;
        const targetRow = this.gameController.getNextAvailableRow(column);
        
        if (targetRow === null) {
            console.error('Cannot apply move - column is full:', move);
            return;
        }

        console.log('[OnlineGameHandler] Applying move to board:', { player, column, selectedRow, targetRow, animate });

        return new Promise((resolve) => {
            if (animate) {
                // Use selectedRow for animation start position, targetRow for final position
                this.gameController.makeMove(selectedRow, column, targetRow, player, () => {
                    this.checkForGameEnd(targetRow, column, player);
                    resolve();
                });
            } else {
                // Direct placement without animation
                import('./Stone.js').then(({ Stone }) => {
                    const stone = new Stone(player);
                    this.gameController.board.placeStone(targetRow, column, stone);
                    this.gameController.boardRenderer.drawBoard();
                    resolve();
                });
            }
        });
    }

    checkForGameEnd(row, col, playerId) {
        const winners = this.gameController.checkForWin(row, col, playerId);
        if (winners) {
            this.gameController.setGameOver(true);
            this.gameController.displayWinners(winners);
            this.gameState = 'finished';
            this.stopPolling();
            
            const playerName = playerId === 1 ? 'White' : 'Black';
            this.displayGameOverMessage(`${playerName} wins! ${playerId === this.playerId ? '🎉' : '😔'}`);
        } else if (this.gameController.isBoardFull()) {
            this.gameController.setGameOver(true);
            this.gameState = 'finished';
            this.stopPolling();
            this.displayGameOverMessage("It's a draw! 🤝");
        }
    }

    switchPlayer() {
        // Early return if game is over to prevent rotation logic
        if (this.gameController.isGameOver()) {
            console.log('[OnlineGameHandler] switchPlayer() called but game is over, skipping');
            return;
        }
        
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.updateTurnIndicator();
        
        console.log('[OnlineGameHandler] Player switched:', {
            currentPlayer: this.currentPlayer,
            moveCount: this.moveCount,
            rotationFrequency: this.rotationFrequency,
            shouldRotate: this.moveCount % this.rotationFrequency === 0
        });
        
        // Check for rotation - only trigger if moveCount is exactly divisible by frequency and > 0
        // Also prevent duplicate rotations by checking if we already rotated at this move count
        if (this.moveCount > 0 && 
            this.moveCount % this.rotationFrequency === 0 && 
            this.lastRotationAtMove !== this.moveCount &&
            !this.isRotating) {
            
            console.log('[OnlineGameHandler] Triggering rotation at move count:', this.moveCount);
            this.lastRotationAtMove = this.moveCount;
            this.updateCountdown(0);
            // Add a longer delay to ensure both players rotate at approximately the same time
            setTimeout(() => {
                this.rotateGrid();
            }, 500); // Increased delay for better sync
        } else {
            // Calculate correct countdown
            this.updateCountdownFromCurrentState();
        }

        this.gameController.enableInput();
    }

    rotateGrid() {
        if (this.gameController.isGameOver() || this.isRotating) {
            return;
        }

        this.isRotating = true;
        console.log('[OnlineGameHandler] Starting grid rotation at move count:', this.moveCount);

        this.gameController.rotateGrid(() => {
            console.log('[OnlineGameHandler] Grid rotation completed');
            this.isRotating = false;
            
            // Check for win after rotation
            const winner = this.gameController.checkForWinAfterRotation();
            if (winner) {
                this.gameController.setGameOver(true);
                this.gameState = 'finished';
                this.stopPolling();
                
                // Find and highlight the winning stones
                outerLoop: for (let row = 0; row < this.gameController.board.size; row++) {
                    for (let col = 0; col < this.gameController.board.size; col++) {
                        const stone = this.gameController.board.grid[row][col];
                        if (stone !== null && stone.playerId === winner) {
                            const winners = this.gameController.checkForWin(row, col, stone.playerId);
                            if (winners) {
                                this.gameController.displayWinners(winners);
                                break outerLoop;
                            }
                        }
                    }
                }
                
                const playerName = winner === 1 ? 'White' : 'Black';
                this.displayGameOverMessage(`${playerName} wins after rotation! ${winner === this.playerId ? '🎉' : '😔'}`);
            } else {
                // Reset countdown to full rotation frequency after rotation
                this.updateCountdown(this.rotationFrequency);
            }
        });
    }

    // === POLLING ===

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            await this.pollForUpdates();
        }, this.pollingFrequency);

        console.log('[OnlineGameHandler] Started polling for updates');
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        console.log('[OnlineGameHandler] Stopped polling');
    }

    async pollForUpdates() {
        try {
            const result = await this.apiController.getNewMoves(this.sessionId, this.lastMoveReceived);
            
            if (!result.success) {
                console.error('[OnlineGameHandler] Polling failed:', result.error);
                return;
            }

            const { moves, currentMoveCount } = result.data;

            // Check if game started (for guests waiting)
            if (this.gameState === 'waiting' && moves.length > 0) {
                console.log('[OnlineGameHandler] Guest detected game start, launching game...');
                this.startGame();
            }

            // For hosts waiting, check if we should start the game
            if (this.gameState === 'waiting' && this.isHost) {
                // We need to check session state to see if a second player joined
                console.log('[OnlineGameHandler] Host checking if guest joined...');
                const sessionResult = await this.apiController.getSessionState(this.sessionId);
                
                if (sessionResult.success) {
                    const sessionData = sessionResult.data;
                    const playerCount = Object.keys(sessionData.players || {}).length;
                    
                    if (playerCount >= 2 && sessionData.status === 'playing') {
                        console.log('[OnlineGameHandler] Host detected guest joined, starting game...');
                        this.startGame();
                    }
                } else {
                    console.error('[OnlineGameHandler] Failed to get session state:', sessionResult.error);
                }
            }

            // Apply new moves
            for (const move of moves) {
                if (move.player !== this.playerId) {
                    // Opponent's move - always animate from top row
                    await this.applyMoveToBoard({
                        ...move,
                        selectedRow: 0 // Always animate from top for opponent moves
                    }, true);
                    
                    // Update move count to match the server
                    this.moveCount = move.moveNumber;
                    console.log('[OnlineGameHandler] Opponent move applied, updating state:', {
                        moveNumber: move.moveNumber,
                        newMoveCount: this.moveCount
                    });
                    
                    // Only switch player if game is not over
                    if (!this.gameController.isGameOver()) {
                        this.switchPlayer();
                    }
                }
            }

            this.lastMoveReceived = currentMoveCount;
            
        } catch (error) {
            console.error('[OnlineGameHandler] Polling error:', error);
        }
    }

    // === UI MANAGEMENT ===

    showWaitingRoom(message = 'Creating game...') {
        console.log('[OnlineGameHandler] Show waiting room:', message);
        
        // Hide other screens
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('game-container').classList.add('hidden');
        
        // Show waiting room
        const waitingRoom = document.getElementById('waiting-room');
        waitingRoom.classList.remove('hidden');
        
        // Update status
        document.getElementById('waiting-status').textContent = message;
        
        // Hide sharing section initially
        document.getElementById('sharing-section').classList.add('hidden');
        
        // Bind cancel button
        document.getElementById('cancel-waiting-btn').addEventListener('click', () => {
            this.cancelWaiting();
        });
    }

    updateWaitingRoomWithLink() {
        const guestLink = this.apiController.generateGuestLink(this.sessionId);
        console.log('[OnlineGameHandler] Guest link:', guestLink);
        
        // Update status
        document.getElementById('waiting-status').textContent = 'Waiting for opponent to join...';
        
        // Show sharing section
        const sharingSection = document.getElementById('sharing-section');
        sharingSection.classList.remove('hidden');
        
        // Set the link
        document.getElementById('guest-link').value = guestLink;
        
        // Bind copy button
        document.getElementById('copy-link-btn').addEventListener('click', () => {
            this.copyLinkToClipboard(guestLink);
        });
    }

    updateWaitingRoom(message) {
        console.log('[OnlineGameHandler] Update waiting room:', message);
        document.getElementById('waiting-status').textContent = message;
    }

    hideWaitingRoom() {
        console.log('[OnlineGameHandler] Hide waiting room');
        document.getElementById('waiting-room').classList.add('hidden');
    }

    copyLinkToClipboard(link) {
        navigator.clipboard.writeText(link).then(() => {
            // Show feedback
            const feedback = document.getElementById('copy-feedback');
            feedback.classList.remove('hidden');
            
            // Hide feedback after 2 seconds
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy link:', err);
            // Fallback for older browsers
            document.getElementById('guest-link').select();
            document.execCommand('copy');
            alert('Link copied to clipboard!');
        });
    }

    cancelWaiting() {
        this.cleanup();
        this.hideWaitingRoom();
        // Return to mode selection
        document.getElementById('mode-selection').classList.remove('hidden');
    }

    showGameContainer() {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.classList.remove('hidden');
        }
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            if (this.currentPlayer === this.playerId) {
                turnIndicator.textContent = 'Your turn';
                turnIndicator.style.color = '#1ca433';
            } else {
                turnIndicator.textContent = "Opponent's turn";
                turnIndicator.style.color = '#666';
            }
        }
    }

    updateCountdown(turnsLeft) {
        if (this.playerId === 2) { // Only log for the second player
            console.log(`[Player 2] Countdown updated to: ${turnsLeft}`);
        }
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            if (typeof turnsLeft !== 'undefined') {
                countdownElement.textContent = turnsLeft;
            }
        }
    }

    updateCountdownFromCurrentState() {
        // Calculate countdown based on current move count and rotation frequency
        let turnsUntilRotation;
        if (this.moveCount === 0) {
            // At start of game, show full rotation frequency
            turnsUntilRotation = this.rotationFrequency;
        } else {
            turnsUntilRotation = this.rotationFrequency - (this.moveCount % this.rotationFrequency);
            // If result is 0, it means we're exactly at rotation point, show full frequency
            if (turnsUntilRotation === 0) {
                turnsUntilRotation = this.rotationFrequency;
            }
        }
        console.log('[OnlineGameHandler] Updating countdown from current state:', {
            moveCount: this.moveCount,
            rotationFrequency: this.rotationFrequency,
            turnsUntilRotation
        });
        this.updateCountdown(turnsUntilRotation);
    }

    // === ANALYZE MODE SUPPORT ===

    async buildGameHistoryFromMoves() {
        console.log('[OnlineGameHandler] Building game history for analyze mode...');
        
        // Get the complete move history from the server
        const result = await this.apiController.getNewMoves(this.sessionId, 0);
        if (!result.success || !result.data.moves) {
            console.error('[OnlineGameHandler] Failed to get moves for analyze mode:', result.error);
            return;
        }

        const serverMoves = result.data.moves;
        console.log(`[OnlineGameHandler] Reconstructing game history from ${serverMoves.length} server moves`);

        // Reset game controller to start fresh
        this.gameController.resetGame();
        
        // Clear any existing game history and start fresh
        this.gameController.gameHistory = [];
        this.gameController.currentStep = -1;

        // Capture initial game state (empty board)
        this.gameController.captureGameState('game_start', null, null);

        // Replay each move step by step to build complete history
        for (let i = 0; i < serverMoves.length; i++) {
            const move = serverMoves[i];
            const { player, column, moveNumber } = move;

            // Find target row for this move
            const targetRow = this.gameController.getNextAvailableRow(column);
            if (targetRow !== null) {
                // Import Stone class and place stone
                const { Stone } = await import('./Stone.js');
                const stone = new Stone(player);
                this.gameController.board.placeStone(targetRow, column, stone);

                // Capture game state after move placement
                this.gameController.captureGameState('move', targetRow, column, {
                    player: player,
                    moveNumber: moveNumber
                });

                // Check if this move triggers a rotation
                if (moveNumber > 0 && moveNumber % this.rotationFrequency === 0) {
                    console.log(`[OnlineGameHandler] Applying rotation at move #${moveNumber} during history build`);
                    
                    // Apply rotation and gravity (without animation)
                    this.gameController.board.rotateGrid();
                    
                    // Capture pre-gravity board state for analyze mode animation
                    const preRotationBoardState = this.gameController.board.grid.map(row =>
                        row.map(cell => cell ? { playerId: cell.playerId, id: cell.id } : null)
                    );
                    
                    this.gameController.board.applyGravity();

                    // Capture game state after rotation with preRotationBoardState for analyze mode
                    this.gameController.captureGameState('rotation', null, null, { 
                        preRotationBoardState,
                        moveNumber: moveNumber,
                        rotationType: 'counter_clockwise'
                    });
                }
            }
        }

        // Ensure final board state matches what was displayed
        this.gameController.boardRenderer.drawBoard();
        
        console.log(`[OnlineGameHandler] Game history built with ${this.gameController.gameHistory.length} steps`);
    }

    displayGameOverMessage(message) {
        // Hide turn indicator and rotation status on game end
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'none';
        }
        
        // Set the game over message
        const gameOverText = document.getElementById('game-over-text');
        if (gameOverText) {
            gameOverText.textContent = message;
        }
        
        // Build game history from server moves for analyze mode
        this.buildGameHistoryFromMoves();
        
        // Use GameApp's showGameOverOptions to handle UI and automatic GIF generation
        if (window.gameApp) {
            window.gameApp.showGameOverOptions();
        }
    }
    
    startReplayMode() {
        // Trigger replay mode through the global GameApp instance
        if (window.gameApp) {
            window.gameApp.initReplayMode();
        }
    }
    
    returnToModeSelection() {
        // Clean up online game
        this.stopPolling();
        
        // Hide game over container
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.add('hidden');
        }
        
        // Show turn indicator and rotation status again
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'flex';
        }
        
        // Hide game container and show mode selection
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('mode-selection').classList.remove('hidden');
        
        // Reset game state
        this.gameState = null;
        this.sessionId = null;
        this.playerId = null;
        this.currentPlayer = 1;
        this.moveCount = 0;
    }

    showMessage(message) {
        // Temporary message display - could be enhanced with a proper notification system
        console.log('[OnlineGameHandler] Message:', message);
    }

    showError(error) {
        console.error('[OnlineGameHandler] Error:', error);
        alert(`Error: ${error}`);
    }

    // === CLEANUP ===

    cleanup() {
        this.stopPolling();
        this.sessionId = null;
        this.playerId = null;
        this.gameState = 'waiting';
    }

    // === REQUIRED INTERFACE METHODS (for InputHandler compatibility) ===

    resetGame() {
        // For online games, we might want to prevent resets or handle them specially
        alert('Game reset is not available in online mode. Please start a new game.');
    }

    setRotationFrequency(frequency) {
        // In online mode, rotation frequency should be synchronized
        // Silently ignore rotation frequency changes during online play
        console.log('[OnlineGameHandler] Rotation frequency change ignored in online mode:', frequency);
    }
} 