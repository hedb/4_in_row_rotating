import { Analytics } from './analytics.js';
import { HapticFeedback } from './HapticFeedback.js';

export class RiddleGameHandler {
    constructor(gameController, riddleData) {
        this.gameController = gameController;
        this.riddleData = riddleData; // { board, steps, date }
        this.stepsTaken = 0;
        this.optimalSteps = riddleData.steps;
        this.initialBoardState = null;
        this.turnCounter = 0;
        this.rotationFrequency = 3; // Default rotation frequency
    }

    init() {
        // Store initial board state for reset functionality
        this.initialBoardState = this.cloneBoardState();
        this.stepsTaken = 0;
        this.turnCounter = 0;
        this.updateRiddleIndicator();
        this.updateCountdown(this.rotationFrequency);
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
        
        // Clear the board
        this.gameController.board.clear();
        
        // Restore initial board state
        for (let row = 0; row < this.gameController.board.size; row++) {
            for (let col = 0; col < this.gameController.board.size; col++) {
                const stoneData = this.initialBoardState[row][col];
                if (stoneData) {
                    this.gameController.board.placeStone(row, col, stoneData.playerId);
                }
            }
        }
        
        // Re-render the board
        this.gameController.boardRenderer.render();
        
        // Reset counters
        this.stepsTaken = 0;
        this.turnCounter = 0;
        this.gameController.setGameOver(false);
        
        // Update UI
        this.updateRiddleIndicator();
        this.updateCountdown(this.rotationFrequency);
        
        // Hide game over messages
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.add('hidden');
        }
        
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'flex';
        }
        
        HapticFeedback.light();
    }

    handlePlayerInput(selectedRow, col) {
        if (this.gameController.isGameOver()) {
            return;
        }

        if (this.gameController.isInputDisabled()) {
            return;
        }

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
        
        // Riddle mode: always play as white (player 1)
        const playerId = 1;
        
        // Make the move through GameController
        this.gameController.makeMove(selectedRow, col, targetRow, playerId, () => {
            // Increment steps taken
            this.stepsTaken++;
            this.updateRiddleIndicator();

            // Check for a win
            const winners = this.gameController.checkForWin(targetRow, col, playerId);
            if (winners) {
                HapticFeedback.success();
                this.gameController.setGameOver(true);
                this.gameController.winner = playerId;
                this.gameController.displayWinners(winners);
                this.handleRiddleSolved();
            } else if (this.gameController.isBoardFull()) {
                HapticFeedback.draw();
                this.gameController.setGameOver(true);
                this.gameController.winner = null;
                this.displayGameOverMessage("Board full! Try resetting.");
            } else {
                this.incrementTurnCounter();
            }

            this.gameController.enableInput();
        });
    }

    incrementTurnCounter() {
        this.turnCounter++;
        
        if (this.turnCounter % this.rotationFrequency === 0) {
            this.updateCountdown(0);
            setTimeout(() => {
                this.rotateGrid();
            }, 0);
        } else {
            this.updateCountdown(this.rotationFrequency - (this.turnCounter % this.rotationFrequency));
        }
    }

    rotateGrid() {
        if (this.gameController.isGameOver()) {
            return;
        }

        // Provide haptic feedback for grid rotation
        HapticFeedback.rotation();
        
        this.gameController.rotateGrid(() => {
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
                
                HapticFeedback.success();
                this.gameController.winner = winner;
                
                if (winner === 1) {
                    this.handleRiddleSolved();
                } else {
                    this.displayGameOverMessage('Black wins after rotation!');
                }
            } else {
                // Continue the game
                this.updateCountdown(this.rotationFrequency);
            }
        });
    }

    handleRiddleSolved() {
        const isOptimal = this.stepsTaken <= this.optimalSteps;
        
        let message = `Puzzle solved in ${this.stepsTaken} step${this.stepsTaken !== 1 ? 's' : ''}!`;
        
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
                stepsTaken: this.stepsTaken,
                isOptimal: isOptimal,
                timestamp: Date.now()
            });
        }
        
        try {
            Analytics.trackEvent('riddle_solved', {
                date: this.riddleData.date,
                steps: this.stepsTaken,
                optimal: this.optimalSteps,
                isOptimal: isOptimal
            });
        } catch (_) {}
    }

    updateRiddleIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = `Steps: ${this.stepsTaken} / ${this.optimalSteps}`;
        }
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
        
        // Show action buttons for riddle mode
        const topLeftActions = document.getElementById('top-left-actions');
        if (topLeftActions) {
            topLeftActions.classList.remove('hidden');
        }
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

