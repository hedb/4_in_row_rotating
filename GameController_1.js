import { Board } from './Board.js';
import { BoardRenderer } from './BoardRenderer.js';
import { InputHandler } from './InputHandler.js';
import {
    GRID_SIZE,
    CELL_SIZE,
    PLAYER_COLORS,
    WINNING_ROW_LENGTH,
} from './config.js';

export class GameController {
    constructor() {
        this.inputHandler = new InputHandler(this);
        this.init();
        this.inputHandler.bindInputEvents();
    }

    init() {
        this.board = new Board(GRID_SIZE);
        this.boardRenderer = new BoardRenderer(this.board, CELL_SIZE);
        this.currentPlayer = 1; // Start with Player 1
        this.gameOver = false;
        this.inputEnabled = true; // Control input state
        this.isRotating = false; // Indicates if a rotation is in progress

        this.rotationInterval = 2; // Default rotation interval
        this.rotationCountdown = this.rotationInterval;

        this.updateTurnIndicator();
        this.updateRotationCountdownDisplay();
        this.boardRenderer.drawBoard();
    }

    startGame() {
        // Method retained for compatibility; initialization is done in init()
    }

    isInputDisabled() {
        return !this.inputEnabled;
    }

    setRotationInterval(newInterval) {
        this.rotationInterval = newInterval;
        this.rotationCountdown = newInterval;
        this.updateRotationCountdownDisplay();
    }

    updateRotationCountdownDisplay() {
        const rotationCountdownElement = document.getElementById('rotation-countdown');
        rotationCountdownElement.textContent = `Next rotation in ${this.rotationCountdown} turn${this.rotationCountdown !== 1 ? 's' : ''}`;
    }

    handlePlayerInput(selectedRow, col) {
        if (this.gameOver) {
            alert('Game over! Please reset the game.');
            return;
        }

        if (this.isRotating || !this.inputEnabled) {
            // Ignore input if rotation is in progress or input is disabled
            return;
        }

        this.inputEnabled = false;

        if (this.board.isCellOccupied(selectedRow, col)) {
            alert('Cell is already occupied!');
            this.inputEnabled = true;
            return;
        }

        const targetRow = this.board.getNextAvailableRow(col);

        if (targetRow === null) {
            alert('Column is full!');
            this.inputEnabled = true;
            return;
        }

        if (selectedRow > targetRow) {
            alert('You cannot place a stone below the lowest available position!');
            this.inputEnabled = true;
            return;
        }

        this.boardRenderer.animateStoneDrop(selectedRow, col, targetRow, this.currentPlayer, () => {
            // Place the stone in the board's data structure
            this.board.placeStone(targetRow, col, this.currentPlayer);
            // Redraw the board to reflect the new state
            this.boardRenderer.drawBoard();

            // Proceed with post-move logic
            this.afterMove(targetRow, col);
        });
    }

    afterMove(row, col) {
        // Check for a win
        const hasWon = this.board.checkForWin(row, col, this.currentPlayer);

        if (hasWon) {
            this.gameOver = true;
            this.displayGameOverMessage(`Player ${this.currentPlayer} wins!`);
            this.inputEnabled = false; // Disable input since the game is over
        } else if (this.board.isBoardFull()) {
            this.gameOver = true;
            this.displayGameOverMessage("It's a draw!");
            this.inputEnabled = false; // Disable input since the game is over
        } else {
            // Decrement rotation countdown
            this.rotationCountdown--;
            if (this.rotationCountdown === 0) {
                // Reset the countdown
                this.rotationCountdown = this.rotationInterval;
                this.updateRotationCountdownDisplay();

                // Trigger automatic rotation
                this.rotateGrid(() => {
                    // After rotation, switch players and re-enable input
                    this.switchPlayer();
                    this.updateTurnIndicator();
                    this.inputEnabled = true;
                });
            } else {
                // Update the countdown display
                this.updateRotationCountdownDisplay();

                // Switch players and re-enable input
                this.switchPlayer();
                this.updateTurnIndicator();
                this.inputEnabled = true;
            }
        }
    }

    rotateGrid(callback) {
        if (this.gameOver) {
            alert('Game over! Please reset the game.');
            return;
        }

        if (this.isRotating) {
            // Prevent multiple rotations at the same time
            return;
        }

        this.isRotating = true;
        this.inputEnabled = false;

        // Rotate the grid data structure
        this.board.rotateGrid();

        // Animate the rotation
        this.boardRenderer.animateRotation(() => {
            // After rotation animation completes

            // Apply gravity to the rotated grid
            this.board.applyGravity();

            // Animate stones falling due to gravity
            this.boardRenderer.animateGravity(() => {
                // After gravity animation completes

                // Re-render the board to show the final state
                this.boardRenderer.drawBoard();

                // Check for any win conditions after rotation
                const winner = this.checkForWinAfterRotation();

                if (winner) {
                    this.gameOver = true;
                    this.displayGameOverMessage(`Player ${winner} wins after rotation!`);
                    this.inputEnabled = false; // Disable input since the game is over
                } else {
                    // Continue the game
                    this.isRotating = false;

                    // Execute the callback if provided
                    if (callback) callback();
                }
            });
        });
    }

    checkForWinAfterRotation() {
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const playerId = this.board.grid[row][col];
                if (playerId !== null) {
                    if (this.board.checkForWin(row, col, playerId)) {
                        return playerId;
                    }
                }
            }
        }
        return null;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        turnIndicator.textContent = `Player ${this.currentPlayer}'s turn`;
    }

    displayGameOverMessage(message) {
        const turnIndicator = document.getElementById('turn-indicator');
        turnIndicator.textContent = message;
    }

    resetGame() {
        this.board.resetBoard();
        this.boardRenderer.resetRendering();
        this.currentPlayer = 1; // Reset to Player 1
        this.gameOver = false;
        this.inputEnabled = true; // Re-enable input
        this.isRotating = false;
        this.rotationInterval = parseInt(document.getElementById('rotation-interval').value, 10) || 2;
        this.rotationCountdown = this.rotationInterval;
        this.updateTurnIndicator();
        this.updateRotationCountdownDisplay();
    }
}
