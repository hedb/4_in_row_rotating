// AIPlayer.js

export class AIPlayer {
    constructor(gameController, options = {}) {
        this.gameController = gameController;
        this.difficulty = options.difficulty || 'normal'; // 'normal' | 'hard'
        this.aiPlayerId = options.aiPlayerId || 2; // AI player ID
        this.humanPlayerId = options.humanPlayerId || 1; // Human player ID
    }

    /**
     * Finds the best move for the AI using strategic priorities:
     * 1. Try to win if possible
     * 2. Block player from winning
     * 3. Make a random valid move
     * @returns {number | null} The column number for the move, or null if no move is possible.
     */
    findBestMove() {
        const validColumns = this.getValidColumns();
        if (validColumns.length === 0) {
            return null; // No valid moves
        }

        // Priority 1: Try to win
        const winningMove = this.findWinningMove(validColumns, this.aiPlayerId);
        if (winningMove !== null) {
            return winningMove;
        }

        // Priority 2: Block player from winning
        const blockingMove = this.findWinningMove(validColumns, this.humanPlayerId);
        if (blockingMove !== null) {
            return blockingMove;
        }

        if (this.difficulty === 'hard') {
            // Avoid giving opponent an immediate win next turn; prefer center columns
            const safeMoves = [];
            for (const col of validColumns) {
                // Simulate AI move
                const row = this.gameController.getNextAvailableRow(col);
                if (row === null) continue;
                this.gameController.board.grid[row][col] = { playerId: this.aiPlayerId };
                // After this move, check if human has any immediate winning response
                const oppWinning = this.findWinningMove(this.getValidColumns(), this.humanPlayerId);
                // Undo
                this.gameController.board.grid[row][col] = null;
                if (oppWinning === null) {
                    safeMoves.push(col);
                }
            }

            const candidates = safeMoves.length ? safeMoves : validColumns;
            // Center preference scoring
            const center = Math.floor(this.gameController.board.size / 2);
            candidates.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
            return candidates[0];
        }

        // Normal: random valid move
        const randomIndex = Math.floor(Math.random() * validColumns.length);
        return validColumns[randomIndex];
    }

    /**
     * Gets all columns that are not full
     * @returns {number[]} Array of valid column indices
     */
    getValidColumns() {
        const validColumns = [];
        for (let col = 0; col < this.gameController.board.size; col++) {
            if (this.gameController.getNextAvailableRow(col) !== null) {
                validColumns.push(col);
            }
        }
        return validColumns;
    }

    /**
     * Finds a move that would create a win for the specified player
     * @param {number[]} validColumns - Array of valid column indices
     * @param {number} playerId - Player ID to check wins for
     * @returns {number | null} Column that creates a win, or null if none
     */
    findWinningMove(validColumns, playerId) {
        for (const col of validColumns) {
            const targetRow = this.gameController.getNextAvailableRow(col);
            if (targetRow !== null) {
                // Simulate placing the stone
                const stone = { playerId: playerId };
                this.gameController.board.grid[targetRow][col] = stone;

                // Check if this creates a win
                const isWin = this.gameController.board.checkForWin(targetRow, col, playerId);

                // Remove the simulated stone
                this.gameController.board.grid[targetRow][col] = null;

                if (isWin) {
                    return col;
                }
            }
        }
        return null;
    }
}
