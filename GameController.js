import { Board } from './Board.js';
import { BoardRenderer } from './BoardRenderer.js';
import { Stone } from './Stone.js';
import {
    GRID_SIZE,
    CELL_SIZE,
    PLAYER_COLORS,
    WINNING_ROW_LENGTH,
} from './config.js';

export class GameController {
    constructor() {
        this.init();
    }

    init() {
        this.board = new Board(GRID_SIZE);
        this.boardRenderer = new BoardRenderer(this.board, CELL_SIZE);
        this.gameOver = false;
        this.inputEnabled = true;
        this.isRotating = false;
        
        // Draw the initial board
        this.boardRenderer.drawBoard();
    }

    // === GAME STATE METHODS ===
    
    isGameOver() {
        return this.gameOver;
    }

    setGameOver(gameOver) {
        this.gameOver = gameOver;
    }

    isInputDisabled() {
        return !this.inputEnabled;
    }

    disableInput() {
        this.inputEnabled = false;
    }

    enableInput() {
        this.inputEnabled = true;
    }

    // === BOARD QUERY METHODS ===

    isCellOccupied(row, col) {
        return this.board.isCellOccupied(row, col);
    }

    getNextAvailableRow(col) {
        return this.board.getNextAvailableRow(col);
    }

    isBoardFull() {
        return this.board.isBoardFull();
    }

    getBoardState() {
        return this.board.grid;
    }

    // === GAME ACTION METHODS ===

    makeMove(selectedRow, col, targetRow, playerId, onComplete) {
        const stone = new Stone(playerId);
        this.boardRenderer.animateStoneDrop(selectedRow, col, targetRow, stone, () => {
            this.board.placeStone(targetRow, col, stone);
            this.boardRenderer.drawBoard();
            onComplete();
        });
    }

    checkForWin(row, col, playerId) {
        return this.board.checkForWin(row, col, playerId);
    }

    displayWinners(winners) {
        for (let winner of winners) {
            const stoneElement = winner.stoneElement;
            stoneElement.style.backgroundColor = 'green';
        }
    }

    rotateGrid(onComplete) {
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

        // Animate the rotation
        this.boardRenderer.animateRotation(() => {
            // After rotation animation completes
            
            // Rotate the grid data structure
            this.board.rotateGrid();
        
            // Apply gravity to the rotated grid
            this.board.applyGravity();
        
            // Animate stones falling due to gravity
            this.boardRenderer.animateGravity(() => {
                // After gravity animation completes
                
                // Re-render the board to show the final state
                this.boardRenderer.drawBoard();
                
                this.inputEnabled = true;
                this.isRotating = false;
                
                if (onComplete) {
                    onComplete();
                }
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

    resetGame() {
        this.init();
    }

    // === LEGACY METHODS FOR BACKWARD COMPATIBILITY ===
    // These will be removed once InputHandler is updated

    startGame() {
        this.boardRenderer.drawBoard();
    }
}
