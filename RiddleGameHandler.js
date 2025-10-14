import { Analytics } from './analytics.js';
import { HapticFeedback } from './HapticFeedback.js';
import { Stone } from './Stone.js';
import { AIPlayer } from './AIPlayer.js';

export class RiddleGameHandler {
    constructor(gameController, riddleData) {
        this.gameController = gameController;
        this.riddleData = riddleData; // { board, steps, date, rotationCounter? }
        this.humanStepsTaken = 0; // Only count human moves
        this.optimalSteps = riddleData.steps;
        this.initialBoardState = null;
        this.turnCounter = 0;
        this.rotationFrequency = 3; // Default rotation frequency
        this.humanPlayerId = 1; // Human plays as white
        this.aiPlayerId = 2; // AI plays as black
        this.currentPlayer = 1; // Start with human
        this.isAIThinking = false; // Add AI thinking flag like standard AI mode
        this.aiPlayer = new AIPlayer(gameController, { 
            difficulty: 'normal',
            aiPlayerId: this.aiPlayerId,
            humanPlayerId: this.humanPlayerId
        });
    }

    init() {
        // Store initial board state for reset functionality
        this.initialBoardState = this.cloneBoardState();
        this.humanStepsTaken = 0;
        this.turnCounter = 0;
        this.currentPlayer = this.humanPlayerId;
        this.updateRiddleIndicator();
        // If a rotation counter is provided with the riddle, prime the countdown accordingly
        if (typeof this.riddleData.rotationCounter === 'number' && this.riddleData.rotationCounter >= 0) {
            // Keep rotationFrequency at default (3) for now; just set countdown to the given value
            // This mirrors UI semantics: "turns until rotation"
            this.updateCountdown(this.riddleData.rotationCounter);
        } else {
            this.updateCountdown(this.rotationFrequency);
        }
        this.updateTurnIndicator();
        try {
            Analytics.trackEvent('riddle_start', { date: this.riddleData.date });
        } catch (_) {}
    }

    cloneBoardState() {
        const grid = [];
        for (let row = 0; row < this.gameController.board.size; row++) {
            grid[row] = [];
            for (let col = 0; col < this.gameController.board.size; col++) {
                const stone = this.gameController.board.grid[row][col];
                grid[row][col] = stone ? { playerId: stone.playerId } : null;
            }
        }
        return grid;
    }

    resetToInitialState() {
        console.log('[RiddleGameHandler] Resetting to initial state');
        
        // Clear the board completely first
        this.gameController.board.resetBoard();
        
        // Restore initial board state from the riddle data
        for (let row = 0; row < this.gameController.board.size; row++) {
            for (let col = 0; col < this.gameController.board.size; col++) {
                const stoneData = this.initialBoardState[row][col];
                if (stoneData) {
                    const stone = new Stone(stoneData.playerId);
                    this.gameController.board.placeStone(row, col, stone);
                }
            }
        }
        
        // Re-render the board
        this.gameController.boardRenderer.drawBoard();
        
        // Reset game state completely
        this.humanStepsTaken = 0;
        this.turnCounter = 0;
        this.currentPlayer = this.humanPlayerId; // Always start with human
        this.isAIThinking = false;
        this.gameController.setGameOver(false);
        this.gameController.winner = null;
        
        // Update UI to show it's the human's turn
        this.updateTurnIndicator();
        this.updateCountdown(this.rotationFrequency);
        
        // Hide game over messages and show gameplay status
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.add('hidden');
        }
        
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'flex';
        }
        
        // Hide the game over action buttons
        const topLeftActions = document.getElementById('top-left-actions');
        if (topLeftActions) {
            topLeftActions.classList.add('hidden');
        }
        
        // Enable input for the human player
        this.gameController.enableInput();
        
        HapticFeedback.light();
        
        console.log('[RiddleGameHandler] Reset complete - ready to replay puzzle');
    }

    handlePlayerInput(selectedRow, col) {
        // Use same logic as standard AI mode
        if (this.gameController.isGameOver() || this.isAIThinking || this.currentPlayer !== this.humanPlayerId) {
            return;
        }

        if (this.gameController.isInputDisabled()) {
            return;
        }

        // Temporarily disable input to prevent double clicks
        this.gameController.disableInput();

        if (this.gameController.isCellOccupied(selectedRow, col)) {
            HapticFeedback.error();
            alert('Cell is already occupied!');
            this.gameController.enableInput();
            return;
        }

        const targetRow = this.gameController.getNextAvailableRow(col);

        if (targetRow === null) {
            HapticFeedback.error();
            alert('Column is full!');
            this.gameController.enableInput();
            return;
        }

        if (selectedRow > targetRow) {
            HapticFeedback.error();
            alert('You cannot place a stone below the lowest available position!');
            this.gameController.enableInput();
            return;
        }

        // Provide haptic feedback for successful stone placement
        HapticFeedback.light();
        
        // Make the human move
        this.gameController.makeMove(selectedRow, col, targetRow, this.humanPlayerId, () => {
            // Increment human steps taken
            this.humanStepsTaken++;
            
            // Check for game end (win or draw)
            if (this.checkForGameEnd(targetRow, col, this.humanPlayerId)) {
                this.gameController.enableInput();
            } else {
                // Switch to AI turn using standard pattern
                this.switchPlayer();
            }
        });
    }

    aiTurn() {
        console.log('[RiddleGameHandler] aiTurn');
        this.isAIThinking = true;
        this.gameController.disableInput();
        this.updateTurnIndicator();

        // Add a small delay to simulate thinking (same as standard AI mode)
        setTimeout(() => {
            const col = this.aiPlayer.findBestMove();
            console.log('[RiddleGameHandler] AI Best move column', { col });
            if (col !== null) {
                const targetRow = this.gameController.getNextAvailableRow(col);
                console.log('[RiddleGameHandler] AI Computed targetRow', { targetRow });
                // Place the stone at the top row (0) so it falls down like in standard AI mode
                const selectedRow = 0; 

                // Provide subtle haptic feedback for AI moves
                HapticFeedback.light();
                
                this.gameController.makeMove(selectedRow, col, targetRow, this.aiPlayerId, () => {
                    console.log('[RiddleGameHandler] AI makeMove callback');
                    this.isAIThinking = false;
                    if (!this.checkForGameEnd(targetRow, col, this.aiPlayerId)) {
                        this.switchPlayer();
                    }
                    // Only enable input if it's the human's turn next
                    if (this.currentPlayer === this.humanPlayerId) {
                        console.log('[RiddleGameHandler] Enabling input for human after AI turn');
                        this.gameController.enableInput();
                    }
                });
            } else {
                // AI couldn't find a move
                this.isAIThinking = false;
                this.gameController.enableInput();
            }
        }, 500); // 0.5 second delay like standard AI mode
    }

    checkForGameEnd(row, col, playerId) {
        const winners = this.gameController.checkForWin(row, col, playerId);
        if (winners) {
            HapticFeedback.success();
            this.gameController.setGameOver(true);
            this.gameController.winner = playerId;
            this.gameController.displayWinners(winners);
            
            if (playerId === this.humanPlayerId) {
                this.handleRiddleSolved();
            } else {
                this.displayGameOverMessage("AI wins! Try resetting the puzzle.");
            }
            return true;
        } else if (this.gameController.isBoardFull()) {
            HapticFeedback.draw();
            this.gameController.setGameOver(true);
            this.gameController.winner = null;
            this.displayGameOverMessage("Board full! Try resetting.");
            return true;
        }
        return false;
    }

    switchPlayer() {
        console.log('[RiddleGameHandler] switchPlayer start', { currentPlayer: this.currentPlayer, turnCounter: this.turnCounter });
        this.currentPlayer = (this.currentPlayer === this.humanPlayerId) ? this.aiPlayerId : this.humanPlayerId;
        this.turnCounter++;
        this.updateTurnIndicator();

        if (this.turnCounter % this.rotationFrequency === 0) {
            this.updateCountdown(0);
            setTimeout(() => {
                this.rotateGrid();
            }, 500); // Delay rotation slightly for visual feedback
        } else {
            this.updateCountdown(this.rotationFrequency - (this.turnCounter % this.rotationFrequency));
            if (this.currentPlayer === this.aiPlayerId && !this.gameController.isGameOver()) {
                console.log('[RiddleGameHandler] Handing turn to AI');
                this.aiTurn();
            }
        }
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            if (this.gameController.isGameOver()) {
                return;
            }
            if (this.currentPlayer === this.humanPlayerId) {
                if (this.isAIThinking) {
                    turnIndicator.textContent = `AI thinking... (Steps: ${this.humanStepsTaken}/${this.optimalSteps})`;
                } else {
                    turnIndicator.textContent = `Your turn (Steps: ${this.humanStepsTaken}/${this.optimalSteps})`;
                }
            } else {
                turnIndicator.textContent = `AI thinking... (Steps: ${this.humanStepsTaken}/${this.optimalSteps})`;
            }
        }
    }

    rotateGrid() {
        console.log('[RiddleGameHandler] rotateGrid requested');
        if (this.gameController.isGameOver()) {
            return;
        }

        // Provide haptic feedback for grid rotation
        HapticFeedback.rotation();
        
        this.gameController.rotateGrid(() => {
            console.log('[RiddleGameHandler] rotateGrid completed callback');
            // Check for any win conditions after rotation
            const winner = this.gameController.checkForWinAfterRotation();
            if (winner) {
                this.gameController.setGameOver(true);
                
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
                
                // Persist winner after rotation
                this.gameController.winner = winner;
                
                if (winner === this.humanPlayerId) {
                    this.handleRiddleSolved();
                } else {
                    this.displayGameOverMessage("AI wins after rotation! Try resetting the puzzle.");
                }
            } else {
                // Continue the game
                this.updateCountdown(this.rotationFrequency);
                if (this.currentPlayer === this.aiPlayerId && !this.gameController.isGameOver()) {
                    console.log('[RiddleGameHandler] After rotation: AI to move');
                    this.aiTurn();
                } else {
                    console.log('[RiddleGameHandler] After rotation: Human to move. Enabling input');
                    this.gameController.enableInput();
                }
            }
        });
    }

    handleRiddleSolved() {
        const isOptimal = this.humanStepsTaken <= this.optimalSteps;
        
        let message = `Puzzle solved in ${this.humanStepsTaken} step${this.humanStepsTaken !== 1 ? 's' : ''}!`;
        
        if (isOptimal) {
            message += ` ⭐ Optimal solution!`;
        } else {
            message += ` (Optimal: ${this.optimalSteps})`;
        }
        
        this.displayGameOverMessage(message);
        
        // Save progress
        if (window.gameApp) {
            window.gameApp.saveRiddleProgress(this.riddleData.date, {
                solved: true,
                stepsTaken: this.humanStepsTaken,
                isOptimal: isOptimal,
                timestamp: Date.now()
            });
        }
        
        try {
            Analytics.trackEvent('riddle_solved', {
                date: this.riddleData.date,
                steps: this.humanStepsTaken,
                optimal: this.optimalSteps,
                isOptimal: isOptimal
            });
        } catch (_) {}
    }

    updateRiddleIndicator() {
        // This method is now handled by updateTurnIndicator
        this.updateTurnIndicator();
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
        
        // Show game over container
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.remove('hidden');
        }
        
        // In riddle mode we already have dedicated controls at the top;
        // keep the default game-over buttons hidden
    }

    updateCountdown(turnsLeft) {
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            countdownElement.textContent = turnsLeft;
        }
    }

    setRotationFrequency(frequency) {
        this.rotationFrequency = frequency;
        this.turnCounter = 0;
        this.updateCountdown(this.rotationFrequency);
    }
}

