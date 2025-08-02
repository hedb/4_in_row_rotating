export class LocalGameHandler {
    constructor(gameController) {
        this.gameController = gameController;
        this.currentPlayer = 1; // Start with Player 1
        this.turnCounter = 0;
        this.rotationFrequency = 3; // Default rotation frequency
    }

    init() {
        this.currentPlayer = 1;
        this.turnCounter = 0;
        this.updateTurnIndicator();
        this.updateCountdown(this.rotationFrequency);
    }

    handlePlayerInput(selectedRow, col) {
        if (this.gameController.isGameOver()) {
            alert('Game over! Please reset the game.');
            return;
        }

        if (this.gameController.isInputDisabled()) {
            return;
        }

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

        // Make the move through GameController
        this.gameController.makeMove(selectedRow, col, targetRow, this.currentPlayer, () => {
            // This callback is executed after the move animation completes

            // Check for a win
            const winners = this.gameController.checkForWin(targetRow, col, this.currentPlayer);
            if (winners) {
                this.gameController.setGameOver(true);
                this.gameController.displayWinners(winners);
                this.displayGameOverMessage(`Player ${this.currentPlayer} wins!`);
            } else if (this.gameController.isBoardFull()) {
                this.gameController.setGameOver(true);
                this.displayGameOverMessage("It's a draw!");
            } else {
                this.switchPlayer();
            }

            this.gameController.enableInput();
        });
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.turnCounter++;
        this.updateTurnIndicator();
        
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
            alert('Game over! Please reset the game.');
            return;
        }

        this.gameController.rotateGrid(() => {
            // This callback is executed after rotation and gravity animations complete
            
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
                
                this.displayGameOverMessage(`Player ${winner} wins after rotation!`);
            } else {
                // Continue the game
                this.updateCountdown(this.rotationFrequency);
            }
        });
    }

    resetGame() {
        this.gameController.resetGame();
        this.init();
    }

    setRotationFrequency(frequency) {
        this.rotationFrequency = frequency;
        this.turnCounter = 0;
        this.updateCountdown(this.rotationFrequency);
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = `Player ${this.currentPlayer}'s turn`;
        }
    }

    displayGameOverMessage(message) {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = message;
        }
    }

    updateCountdown(turnsLeft) {
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            countdownElement.textContent = turnsLeft;
        }
    }
} 