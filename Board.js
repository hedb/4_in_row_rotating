import { WINNING_ROW_LENGTH } from './config.js';
import { Stone } from './Stone.js';


export class Board {
    constructor(size) {
        this.size = size;
        this.grid = this.createGrid();
        this.previousGrid = null; // Store previous grid state
    }

    createGrid() {
        return Array.from({ length: this.size }, () =>
            Array.from({ length: this.size }, () => null)
        );
    }

    getNextAvailableRow(col) {
        for (let row = this.size - 1; row >= 0; row--) {
            if (this.grid[row][col] === null) {
                return row;
            }
        }
        return null; // Column is full
    }

    isCellOccupied(row, col) {
        return this.grid[row][col] !== null;
    }
    
    placeStone(row, col, stone) {
        this.grid[row][col] = stone;
    }
    


    resetBoard() {
        this.grid = this.createGrid();
    }

    isBoardFull() {
        return this.grid.every(row => row.every(cell => cell !== null));
    }

    checkForWin(row, col, playerId) {
        return (
            this.checkDirection(row, col, playerId, 0, 1) || // Horizontal
            this.checkDirection(row, col, playerId, 1, 0) || // Vertical
            this.checkDirection(row, col, playerId, 1, 1) || // Diagonal /
            this.checkDirection(row, col, playerId, 1, -1)   // Diagonal \
        );
    }

    checkDirection(row, col, playerId, deltaRow, deltaCol) {
        let count = 1;

        // Check in the positive direction
        count += this.countStones(row, col, playerId, deltaRow, deltaCol);

        // Check in the negative direction
        count += this.countStones(row, col, playerId, -deltaRow, -deltaCol);

        return count >= WINNING_ROW_LENGTH;
    }



    rotateGrid() {
        // Rotate the grid 90 degrees counterclockwise
        const newGrid = this.createGrid();

        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                newGrid[this.size - col - 1][row] = this.grid[row][col];
            }
        }

        this.grid = newGrid;
    }

    

    applyGravity() {
        // Store the current grid as the previous grid before gravity is applied
        this.previousGrid = this.grid.map(row => row.slice());

        for (let col = 0; col < this.size; col++) {
            let emptyRow = this.size - 1;
            for (let row = this.size - 1; row >= 0; row--) {
                if (this.grid[row][col] !== null) {
                    if (row !== emptyRow) {
                        // Move stone down to the emptyRow position
                        this.grid[emptyRow][col] = this.grid[row][col];
                        this.grid[row][col] = null;
                    }
                    emptyRow--;
                }
            }
        }
    }

    countStones(startRow, startCol, playerId, deltaRow, deltaCol) {
        let count = 0;
        let row = startRow + deltaRow;
        let col = startCol + deltaCol;

        while (
            row >= 0 &&
            row < this.size &&
            col >= 0 &&
            col < this.size &&
            this.grid[row][col] != null &&
            this.grid[row][col].playerId === playerId
        ) {
            count++;
            row += deltaRow;
            col += deltaCol;
        }

        return count;
    }
}
