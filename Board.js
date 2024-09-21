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
        const cond1 = this.checkDirection(row, col, playerId, 0, 1); // Horizontal
        if (cond1[0])
            return cond1[1]
        const cond2 = this.checkDirection(row, col, playerId, 1, 0); // Vertical
        if (cond2[0])
            return cond2[1]
        const cond3 = this.checkDirection(row, col, playerId, 1, 1); // Diagonal /
        if (cond3[0])
            return cond3[1]
        const cond4 = this.checkDirection(row, col, playerId, 1, -1);   // Diagonal \
        if (cond4[0])
            return cond4[1]
        return false
    }

    checkDirection(row, col, playerId, deltaRow, deltaCol) {
        // Check in the positive direction
        let winners = this.countStones(row, col, playerId, deltaRow, deltaCol);

        // Check in the negative direction
        let ls = this.countStones(row, col, playerId, -deltaRow, -deltaCol);
        if (ls.length > 0){// Remove the stone at the center to avoid double counting
            ls.pop(0)
            winners = winners.concat(ls);
        }
        return [winners.length >= WINNING_ROW_LENGTH, winners];
    }


    countStones(startRow, startCol, playerId, deltaRow, deltaCol) {
        // let count = 0;
        let row = startRow;
        let col = startCol;
        let winners = [];
        while (
            row >= 0 &&
            row < this.size &&
            col >= 0 &&
            col < this.size &&
            this.grid[row][col] != null &&
            this.grid[row][col].playerId === playerId
        ) {
            // count++;
            winners.push(this.grid[row][col]);
            row += deltaRow;
            col += deltaCol;
        }

        return winners;
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

}
