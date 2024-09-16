import { Board } from './Board.js';
import { BoardRenderer } from './BoardRenderer.js';
import { InputHandler } from './InputHandler.js';
import { Stone } from './Stone.js';
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
        this.displayGameOverMessage('')
        
        // Draw the initial board
        this.boardRenderer.drawBoard();
        
    }

    startGame() {
        this.boardRenderer.drawBoard();
        this.inputHandler.bindInputEvents();
    }

    isInputDisabled() {
        return !this.inputEnabled;
    }

    handlePlayerInput(selectedRow, col) {
        if (this.gameOver) {
            alert('Game over! Please reset the game.');
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

        const stone = new Stone(this.currentPlayer);
        this.boardRenderer.animateStoneDrop(selectedRow, col, targetRow, stone, () => {
            this.board.placeStone(targetRow, col, stone);
            this.boardRenderer.drawBoard();

            // Check for a win
            const hasWon = this.board.checkForWin(targetRow, col, this.currentPlayer);

            if (hasWon) {
                this.gameOver = true;
                this.displayGameOverMessage(`Player ${this.currentPlayer} wins!`);
            } else if (this.board.isBoardFull()) {
                this.gameOver = true;
                this.displayGameOverMessage("It's a draw!");
            } else {
                this.switchPlayer();
            }

            this.inputEnabled = true;
        });
    }



    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }


    displayGameOverMessage(message) {
        const turnIndicator = document.getElementById('turn-indicator');
        turnIndicator.textContent = message;
    }


    resetGame() {
        this.init(); // Re-initialize the game state
    }


    rotateGrid() {
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
                } else {
                    // Continue the game
                    this.inputEnabled = true;
                }
        
                this.isRotating = false;
            });
        });
        


    }

    checkForWinAfterRotation() {
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const stone = this.board.grid[row][col];
                if (stone !== null) {
                    if (this.board.checkForWin(row, col, stone.playerId)) {
                        return stone.playerId;
                    }
                }
            }
        }
        return null;
    }
    
}
