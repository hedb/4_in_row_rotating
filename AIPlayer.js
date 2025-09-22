// AIPlayer.js

export class AIPlayer {
    constructor(gameController, options = {}) {
        this.gameController = gameController;
        this.difficulty = options.difficulty || 'normal'; // 'normal' | 'hard' | 'ouch'
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

        if (this.difficulty === 'ouch') {
            const depth = 5; // Deeper lookahead for strongest play
            const best = this.findBestMoveWithMinimax(depth);
            if (best !== null) return best;
            // Fallbacks if minimax fails for any reason
            const center = Math.floor(this.gameController.board.size / 2);
            validColumns.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
            return validColumns[0];
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

    // === OUCH DIFFICULTY (Minimax with Alpha-Beta) ===

    findBestMoveWithMinimax(maxDepth) {
        const validColumns = this.getValidColumns();
        if (validColumns.length === 0) return null;

        // Move ordering: center-first for better pruning
        const ordered = this.orderColumnsByCenterPreference(validColumns);

        let bestScore = -Infinity;
        let bestColumn = ordered[0];
        let alpha = -Infinity;
        let beta = Infinity;

        for (const col of ordered) {
            const row = this.gameController.getNextAvailableRow(col);
            if (row === null) continue;
            this.gameController.board.grid[row][col] = { playerId: this.aiPlayerId };

            const score = this.minimax(maxDepth - 1, alpha, beta, false);

            this.gameController.board.grid[row][col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestColumn = col;
            }
            alpha = Math.max(alpha, bestScore);
            if (beta <= alpha) break;
        }

        return bestColumn;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        const terminalEval = this.evaluateIfTerminal();
        if (terminalEval !== null) return terminalEval;
        if (depth === 0) return this.evaluateBoardHeuristic();

        const validColumns = this.getValidColumns();
        if (validColumns.length === 0) return 0;

        const ordered = this.orderColumnsByCenterPreference(validColumns);

        if (isMaximizing) {
            let value = -Infinity;
            for (const col of ordered) {
                const row = this.gameController.getNextAvailableRow(col);
                if (row === null) continue;
                this.gameController.board.grid[row][col] = { playerId: this.aiPlayerId };
                value = Math.max(value, this.minimax(depth - 1, alpha, beta, false));
                this.gameController.board.grid[row][col] = null;
                alpha = Math.max(alpha, value);
                if (beta <= alpha) break;
            }
            return value;
        } else {
            let value = Infinity;
            for (const col of ordered) {
                const row = this.gameController.getNextAvailableRow(col);
                if (row === null) continue;
                this.gameController.board.grid[row][col] = { playerId: this.humanPlayerId };
                value = Math.min(value, this.minimax(depth - 1, alpha, beta, true));
                this.gameController.board.grid[row][col] = null;
                beta = Math.min(beta, value);
                if (beta <= alpha) break;
            }
            return value;
        }
    }

    evaluateIfTerminal() {
        const aiWin = this.hasAnyWin(this.aiPlayerId);
        const humanWin = this.hasAnyWin(this.humanPlayerId);
        if (aiWin) return 1000000;
        if (humanWin) return -1000000;
        if (this.gameController.isBoardFull()) return 0;
        return null;
    }

    hasAnyWin(playerId) {
        const size = this.gameController.board.size;
        const grid = this.gameController.board.grid;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = grid[r][c];
                if (cell && cell.playerId === playerId) {
                    if (this.gameController.board.checkForWin(r, c, playerId)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    orderColumnsByCenterPreference(columns) {
        const center = Math.floor(this.gameController.board.size / 2);
        return [...columns].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }

    evaluateBoardHeuristic() {
        // Weighted heuristic combining threats and positional preference
        const aiScore = this.scoreForPlayer(this.aiPlayerId);
        const humanScore = this.scoreForPlayer(this.humanPlayerId);
        return aiScore - humanScore;
    }

    scoreForPlayer(playerId) {
        const opponentId = playerId === this.aiPlayerId ? this.humanPlayerId : this.aiPlayerId;
        const size = this.gameController.board.size;
        const grid = this.gameController.board.grid;

        let score = 0;

        // Center control
        const centerCol = Math.floor(size / 2);
        let centerCount = 0;
        for (let r = 0; r < size; r++) {
            if (grid[r][centerCol] && grid[r][centerCol].playerId === playerId) {
                centerCount++;
            }
        }
        score += centerCount * 6;

        // Evaluate all windows of length 4 in all directions
        const addWindowScore = (cells) => {
            let playerCount = 0;
            let emptyCount = 0;
            let opponentCount = 0;
            for (const cell of cells) {
                if (!cell) emptyCount++;
                else if (cell.playerId === playerId) playerCount++;
                else if (cell.playerId === opponentId) opponentCount++;
            }
            if (playerCount === 4) score += 100000; // already handled by terminal, but helps at depth limit
            else if (playerCount === 3 && emptyCount === 1) score += 200;
            else if (playerCount === 2 && emptyCount === 2) score += 40;
            // discourage allowing opponent in same window
            if (opponentCount === 3 && emptyCount === 1) score -= 180;
            else if (opponentCount === 2 && emptyCount === 2) score -= 30;
        };

        // Horizontal
        for (let r = 0; r < size; r++) {
            for (let c = 0; c <= size - 4; c++) {
                addWindowScore([grid[r][c], grid[r][c + 1], grid[r][c + 2], grid[r][c + 3]]);
            }
        }

        // Vertical
        for (let c = 0; c < size; c++) {
            for (let r = 0; r <= size - 4; r++) {
                addWindowScore([grid[r][c], grid[r + 1][c], grid[r + 2][c], grid[r + 3][c]]);
            }
        }

        // Diagonal down-right
        for (let r = 0; r <= size - 4; r++) {
            for (let c = 0; c <= size - 4; c++) {
                addWindowScore([grid[r][c], grid[r + 1][c + 1], grid[r + 2][c + 2], grid[r + 3][c + 3]]);
            }
        }

        // Diagonal up-right
        for (let r = 3; r < size; r++) {
            for (let c = 0; c <= size - 4; c++) {
                addWindowScore([grid[r][c], grid[r - 1][c + 1], grid[r - 2][c + 2], grid[r - 3][c + 3]]);
            }
        }

        return score;
    }
}
