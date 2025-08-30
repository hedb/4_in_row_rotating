// AIGameHandler.js

import { AIPlayer } from './AIPlayer.js';

export class AIGameHandler {
    constructor(gameController) {
        this.gameController = gameController;
        this.aiPlayer = new AIPlayer(gameController);
        this.humanPlayerId = 1; // Human is player 1
        this.aiPlayerId = 2;    // AI is player 2
        this.currentPlayer = this.humanPlayerId;
        this.isAIThinking = false;
        this.turnCounter = 0;
        this.rotationFrequency = 3; // Default rotation frequency
    }

    init() {
        this.gameController.resetGame();
        this.currentPlayer = this.humanPlayerId;
        this.isAIThinking = false;
        this.turnCounter = 0;
        this.gameController.enableInput();
        this.displayTurnMessage();
        this.updateCountdown(this.rotationFrequency);
    }

    handlePlayerInput(selectedRow, col) {
        if (this.gameController.isGameOver() || this.isAIThinking || this.currentPlayer !== this.humanPlayerId) {
            return;
        }

        if (this.gameController.isInputDisabled()) {
            return;
        }

        // Temporarily disable input to prevent double clicks
        this.gameController.disableInput();

        if (this.gameController.isCellOccupied(selectedRow, col)) {
            alert('Cell is already occupied!');
            this.gameController.enableInput();
            return;
        }

        const targetRow = this.gameController.getNextAvailableRow(col);

        if (targetRow === null) {
            alert('Column is full!');
            this.gameController.enableInput();
            return;
        }

        if (selectedRow > targetRow) {
            alert('You cannot place a stone below the lowest available position!');
            this.gameController.enableInput();
            return;
        }

        this.gameController.makeMove(selectedRow, col, targetRow, this.humanPlayerId, () => {
            if (this.checkForGameEnd(targetRow, col, this.humanPlayerId)) {
                this.gameController.enableInput();
            } else {
                this.switchPlayer();
            }
        });
    }

    aiTurn() {
        this.isAIThinking = true;
        this.gameController.disableInput();
        this.displayTurnMessage();

        // Add a small delay to simulate thinking
        setTimeout(() => {
            const col = this.aiPlayer.findBestMove();
            if (col !== null) {
                const targetRow = this.gameController.getNextAvailableRow(col);
                // Place the stone at the top row (0) so it falls down like in local multiplayer
                const selectedRow = 0; 

                this.gameController.makeMove(selectedRow, col, targetRow, this.aiPlayerId, () => {
                    this.isAIThinking = false;
                    if (!this.checkForGameEnd(targetRow, col, this.aiPlayerId)) {
                        this.switchPlayer();
                    }
                    // Only enable input if it's the human's turn next
                    if (this.currentPlayer === this.humanPlayerId) {
                        this.gameController.enableInput();
                    }
                });
            }
        }, 500); // 0.5 second delay
    }

    checkForGameEnd(row, col, playerId) {
        const winners = this.gameController.checkForWin(row, col, playerId);
        if (winners) {
            this.gameController.setGameOver(true);
            this.gameController.displayWinners(winners);
            const playerName = playerId === 1 ? 'White' : 'Black';
            this.displayGameOverMessage(`${playerName} wins! ${playerId === this.humanPlayerId ? '🎉' : '🤖'}`);
            
            return true;
        } else if (this.gameController.isBoardFull()) {
            this.gameController.setGameOver(true);
            this.displayGameOverMessage("It's a draw! 🤝");
            return true;
        }
        return false;
    }

    switchPlayer() {
        this.currentPlayer = (this.currentPlayer === this.humanPlayerId) ? this.aiPlayerId : this.humanPlayerId;
        this.turnCounter++;
        this.displayTurnMessage();

        if (this.turnCounter % this.rotationFrequency === 0) {
            this.updateCountdown(0);
            setTimeout(() => {
                this.rotateGrid();
            }, 500); // Delay rotation slightly for visual feedback
        } else {
            this.updateCountdown(this.rotationFrequency - (this.turnCounter % this.rotationFrequency));
            if (this.currentPlayer === this.aiPlayerId && !this.gameController.isGameOver()) {
                this.aiTurn();
            } else {
                this.gameController.enableInput();
            }
        }
    }

    displayTurnMessage() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            if (this.gameController.isGameOver()) {
                return;
            }
            if (this.currentPlayer === this.humanPlayerId) {
                turnIndicator.textContent = "Your turn";
            } else {
                turnIndicator.textContent = "Computer is thinking...";
            }
        }
    }

    displayGameOverMessage(message) {
        // Hide turn indicator and rotation status on game end
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'none';
        }
        
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
    
    startNewGame() {
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
        
        // Return to mode selection
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('mode-selection').classList.remove('hidden');
    }

    rotateGrid() {
        if (this.gameController.isGameOver()) {
            return;
        }

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
                
                const playerName = winner === 1 ? 'White' : 'Black';
                this.displayGameOverMessage(`${playerName} wins after rotation! ${winner === this.humanPlayerId ? '🎉' : '🤖'}`);
            } else {
                // Continue the game
                this.updateCountdown(this.rotationFrequency);
                if (this.currentPlayer === this.aiPlayerId && !this.gameController.isGameOver()) {
                    this.aiTurn();
                } else {
                    this.gameController.enableInput();
                }
            }
        });
    }

    setRotationFrequency(frequency) {
        this.rotationFrequency = frequency;
        this.turnCounter = 0;
        this.updateCountdown(this.rotationFrequency);
    }

    updateCountdown(turnsLeft) {
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            countdownElement.textContent = turnsLeft;
        }
    }
}
