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

        // Create session
        const result = await this.apiController.createSession();
        if (!result.success) {
            this.showError(`Failed to create session: ${result.error}`);
            return false;
        }

        this.sessionId = result.data.sessionId;
        this.playerId = result.data.playerId;

        // Update waiting room with link
        this.updateWaitingRoomWithLink();
        
        // Start polling for opponent
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
        const result = await this.apiController.joinSession(sessionId);
        if (!result.success) {
            this.showError(`Failed to join session: ${result.error}`);
            return false;
        }

        this.playerId = result.data.playerId;
        const gameState = result.data.gameState;

        if (gameState.status === 'playing') {
            // Game already started, load current state
            await this.loadGameState(gameState);
            this.startGame();
        } else {
            // Still waiting for game to start
            this.updateWaitingRoom('Waiting for host to start game...');
            this.startPolling();
        }

        return true;
    }

    // === GAME FLOW ===

    async loadGameState(gameState) {
        console.log('[OnlineGameHandler] Loading game state:', gameState);
        
        this.currentPlayer = gameState.currentPlayer;
        this.moveCount = gameState.moveCount;
        this.rotationFrequency = gameState.rotationFrequency || 3;
        this.lastMoveReceived = gameState.moveCount;

        // Reconstruct board from moves
        this.gameController.resetGame();
        
        for (const move of gameState.moves) {
            await this.applyMoveToBoard(move, false); // Don't animate
        }
    }

    startGame() {
        console.log('[OnlineGameHandler] Starting online game');
        
        this.gameState = 'playing';
        this.hideWaitingRoom();
        this.showGameContainer();
        
        // Initialize game display
        this.updateTurnIndicator();
        this.updateCountdown();
        
        if (!this.pollingInterval) {
            this.startPolling();
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

        // Apply move locally with animation
        await this.applyMoveToBoard({
            player: this.playerId,
            column: col,
            moveNumber: result.data.moveNumber
        }, true);

        // Update game state
        this.moveCount = result.data.moveNumber;
        this.lastMoveReceived = this.moveCount;
        this.switchPlayer();
    }

    async applyMoveToBoard(move, animate = true) {
        const { player, column } = move;
        const targetRow = this.gameController.getNextAvailableRow(column);
        
        if (targetRow === null) {
            console.error('Cannot apply move - column is full:', move);
            return;
        }

        return new Promise((resolve) => {
            if (animate) {
                this.gameController.makeMove(0, column, targetRow, player, () => {
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
            
            if (playerId === this.playerId) {
                this.displayGameOverMessage('You win! 🎉');
            } else {
                this.displayGameOverMessage('You lose! 😔');
            }
        } else if (this.gameController.isBoardFull()) {
            this.gameController.setGameOver(true);
            this.gameState = 'finished';
            this.stopPolling();
            this.displayGameOverMessage("It's a draw! 🤝");
        }
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.updateTurnIndicator();
        
        // Check for rotation
        if (this.moveCount % this.rotationFrequency === 0) {
            this.updateCountdown(0);
            setTimeout(() => {
                this.rotateGrid();
            }, 100);
        } else {
            this.updateCountdown(this.rotationFrequency - (this.moveCount % this.rotationFrequency));
        }

        this.gameController.enableInput();
    }

    rotateGrid() {
        if (this.gameController.isGameOver()) {
            return;
        }

        this.gameController.rotateGrid(() => {
            // Check for win after rotation
            const winner = this.gameController.checkForWinAfterRotation();
            if (winner) {
                this.gameController.setGameOver(true);
                this.gameState = 'finished';
                this.stopPolling();
                
                if (winner === this.playerId) {
                    this.displayGameOverMessage('You win after rotation! 🎉');
                } else {
                    this.displayGameOverMessage('You lose after rotation! 😔');
                }
            } else {
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
                this.startGame();
            }

            // Apply new moves
            for (const move of moves) {
                if (move.player !== this.playerId) {
                    // Opponent's move
                    this.showMessage('Opponent is making a move...');
                    await this.applyMoveToBoard(move, true);
                    this.switchPlayer();
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
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            if (typeof turnsLeft !== 'undefined') {
                countdownElement.textContent = turnsLeft;
            }
        }
    }

    displayGameOverMessage(message) {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = message;
            turnIndicator.style.color = '#1ca433';
        }
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