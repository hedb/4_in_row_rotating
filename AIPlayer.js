// AIPlayer.js

export class AIPlayer {
    constructor(gameController) {
        this.gameController = gameController;
    }

    /**
     * Finds the best move for the AI.
     * For now, it just picks a random valid column.
     * @returns {number | null} The column number for the move, or null if no move is possible.
     */
    findBestMove() {
        const validColumns = [];
        for (let col = 0; col < this.gameController.board.size; col++) {
            if (this.gameController.getNextAvailableRow(col) !== null) {
                validColumns.push(col);
            }
        }

        if (validColumns.length > 0) {
            const randomIndex = Math.floor(Math.random() * validColumns.length);
            return validColumns[randomIndex];
        }

        return null; // No valid moves
    }
}
