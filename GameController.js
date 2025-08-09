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
        
        // Game history tracking for replay and undo features
        this.gameHistory = [];
        this.currentStep = 0;
        this.replayMode = false;
        this.currentPlayer = 1; // Track current player for history
        
        // Draw the initial board
        this.boardRenderer.drawBoard();
        
        // Capture initial game state
        this.captureGameState('game_start', null, null);
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

    // === GAME HISTORY METHODS ===

    captureGameState(moveType, lastMoveRow, lastMoveColumn, extra = {}) {
        // Create deep copy of the board state with ids preserved
        const boardStateCopy = this.board.grid.map(row => 
            row.map(cell => cell ? { playerId: cell.playerId, id: cell.id } : null)
        );

        const gameState = {
            stepNumber: this.gameHistory.length + 1,
            player: this.currentPlayer,
            moveType: moveType, // 'game_start', 'move', 'rotation'
            boardState: boardStateCopy,
            lastMoveRow: lastMoveRow,
            lastMoveColumn: lastMoveColumn,
            description: this.generateStepDescription(moveType, this.currentPlayer),
            ...extra
        };

        this.gameHistory.push(gameState);
        this.currentStep = this.gameHistory.length - 1;
        
        console.log('[GameController] Captured game state:', gameState.description);
    }

    generateStepDescription(moveType, player) {
        const stepNum = this.gameHistory.length + 1;
        const playerColor = player === 1 ? 'White' : 'Black';
        
        if (moveType === 'game_start') {
            return `Game Start - ${playerColor} to play`;
        } else if (moveType === 'rotation') {
            return `Step ${stepNum} - Grid Rotation`;
        } else {
            return `Step ${stepNum} - ${playerColor} move`;
        }
    }

    enterReplayMode() {
        if (this.gameHistory.length === 0) return;
        
        this.replayMode = true;
        // Start replay from the last step
        this.currentStep = this.gameHistory.length - 1; 
        this.disableInput();
        // Restore the final game state
        this.restoreGameState(this.gameHistory[this.currentStep]);
        console.log('[GameController] Entered replay mode at the last step');
    }

    exitReplayMode() {
        this.replayMode = false;
        this.currentStep = this.gameHistory.length - 1;
        if (this.currentStep >= 0) {
            this.restoreGameState(this.gameHistory[this.currentStep]);
        }
        console.log('[GameController] Exited replay mode');
    }

    goToStep(stepNumber) {
        if (stepNumber < 0 || stepNumber >= this.gameHistory.length) return false;
        
        this.currentStep = stepNumber;
        this.restoreGameState(this.gameHistory[stepNumber]);
        return true;
    }

    nextStep(onAnimationComplete) {
        if (this.currentStep < this.gameHistory.length - 1) {
            const prevState = this.gameHistory[this.currentStep];
            const nextState = this.gameHistory[this.currentStep + 1];
            
            this.currentStep++;

            // If next step is a rotation, animate it
            if (nextState.moveType === 'rotation') {
                // 1) Rotate the wrapper and reset back to 0deg (same as live game)
                this.boardRenderer.animateRotation(() => {
                    // 2) Prepare board previous/current states for gravity animation
                    // previousGrid := P2 (post-rotation, pre-gravity)
                    if (nextState.preRotationBoardState) {
                        this.board.previousGrid = nextState.preRotationBoardState.map(row =>
                            row.map(cell => (cell ? new Stone(cell.playerId, cell.id) : null))
                        );
                    } else {
                        // Fallback if older history without P2
                        this.board.previousGrid = prevState.boardState.map(row =>
                            row.map(cell => (cell ? new Stone(cell.playerId, cell.id) : null))
                        );
                    }

                    // current grid := P3 (post-gravity, final state)
                    this.board.grid = nextState.boardState.map(row =>
                        row.map(cell => (cell ? new Stone(cell.playerId, cell.id) : null))
                    );

                    // Determine which stone to keep highlighted during falling (map last move id)
                    let highlightId = null;
                    if (
                        prevState.lastMoveRow !== null && prevState.lastMoveColumn !== null &&
                        prevState.boardState[prevState.lastMoveRow][prevState.lastMoveColumn]
                    ) {
                        highlightId = prevState.boardState[prevState.lastMoveRow][prevState.lastMoveColumn].id;
                    }

                    // 3) Animate gravity (vertical) in unrotated frame, then render final
                    this.boardRenderer.animateGravity(() => {
                        this.boardRenderer.drawBoard();

                        // Keep red marker on the last-move stone, mapped through rotation+gravity
                        if (highlightId !== null) {
                            // Find this id in the next state's final board (P3)
                            let targetRow = null, targetCol = null;
                            for (let r = 0; r < this.board.size; r++) {
                                for (let c = 0; c < this.board.size; c++) {
                                    const cell = nextState.boardState[r][c];
                                    if (cell && cell.id === highlightId) {
                                        targetRow = r; targetCol = c;
                                        break;
                                    }
                                }
                                if (targetRow !== null) break;
                            }
                            if (targetRow !== null && targetCol !== null) {
                                this.highlightLastMove(targetRow, targetCol);
                            }
                        }

                        if (onAnimationComplete) onAnimationComplete();
                    }, highlightId);
                });
            }
            // If the next step is a regular move, animate the stone drop
            else if (nextState.moveType === 'move') {
                // Restore the board to the state *before* the move, so we can animate over it
                this.restoreGameState(prevState, true);

                // As soon as the new stone starts falling, remove previous marker
                this.clearMoveHighlights();
                
                // Use a timeout to allow the browser to render the previous state first
                setTimeout(() => {
                    const { lastMoveRow, lastMoveColumn, player } = nextState;
                    const stone = new Stone(player);

                    this.boardRenderer.animateReplayStoneDrop(0, lastMoveColumn, lastMoveRow, stone, () => {
                        // After animation, restore the final state, which includes the new stone
                        this.restoreGameState(nextState, true);
                        if (onAnimationComplete) onAnimationComplete();
                    });
                }, 50); // 50ms delay is enough for rendering but imperceptible to the user
            }
            // For other cases (like game_start), just update the state
            else {
                this.restoreGameState(nextState);
                if (onAnimationComplete) onAnimationComplete();
            }
            return true;
        }
        return false;
    }

    prevStep(onAnimationComplete) {
        if (this.currentStep > 0) {
            const leavingState = this.gameHistory[this.currentStep];
            const targetIndex = this.currentStep - 1;
            const destinationState = this.gameHistory[targetIndex];

            // Case C (moved up): if we are LEAVING a move step, always remove the last stone first
            if (leavingState.moveType === 'move') {
                const { lastMoveRow, lastMoveColumn, player } = leavingState;
                const stone = new Stone(player);
                this.restoreGameState(leavingState, true);
                setTimeout(() => {
                    this.boardRenderer.animateReplayStoneRemoval(lastMoveRow, lastMoveColumn, stone, () => {
                        this.restoreGameState(destinationState, true);
                        this.currentStep = targetIndex;
                        if (onAnimationComplete) onAnimationComplete();
                    });
                }, 50);
                return true;
            }

            // Case A: ARRIVE on a rotation step → reverse climb now (no rotation yet)
            if (destinationState.moveType === 'rotation') {
                const preRotation = destinationState.preRotationBoardState; // P2
                const postRotation = destinationState.boardState;           // P3

                if (preRotation) {
                    let highlightId = null;
                    if (targetIndex - 1 >= 0) {
                        const beforeRotationState = this.gameHistory[targetIndex - 1];
                        if (
                            beforeRotationState.lastMoveRow !== null &&
                            beforeRotationState.lastMoveColumn !== null &&
                            beforeRotationState.boardState[beforeRotationState.lastMoveRow][beforeRotationState.lastMoveColumn]
                        ) {
                            highlightId = beforeRotationState.boardState[beforeRotationState.lastMoveRow][beforeRotationState.lastMoveColumn].id;
                        }
                    }

                    // Show P3 and highlight immediately; no reverse-climb yet
                    this.board.grid = postRotation.map(row =>
                        row.map(cell => (cell ? new Stone(cell.playerId, cell.id) : null))
                    );
                    this.boardRenderer.drawBoard();
                    if (highlightId !== null) {
                        let hr = null, hc = null;
                        for (let r = 0; r < this.board.size; r++) {
                            for (let c = 0; c < this.board.size; c++) {
                                const cell = postRotation[r][c];
                                if (cell && cell.id === highlightId) { hr = r; hc = c; break; }
                            }
                            if (hr !== null) break;
                        }
                        if (hr !== null) this.highlightLastMove(hr, hc);
                    }

                    // Commit step and return without starting reverse climb
                    this.currentStep = targetIndex;
                    if (onAnimationComplete) onAnimationComplete();
                } else {
                    // Fallback if no P2 snapshot exists: render P3 and highlight
                    this.restoreGameState(destinationState, true);
                    this.currentStep = targetIndex;
                    if (targetIndex - 1 >= 0) {
                        const beforeRotationState = this.gameHistory[targetIndex - 1];
                        if (
                            beforeRotationState.lastMoveRow !== null &&
                            beforeRotationState.lastMoveColumn !== null &&
                            beforeRotationState.boardState[beforeRotationState.lastMoveRow][beforeRotationState.lastMoveColumn]
                        ) {
                            const highlightId = beforeRotationState.boardState[beforeRotationState.lastMoveRow][beforeRotationState.lastMoveColumn].id;
                            let hr = null, hc = null;
                            for (let r = 0; r < this.board.size; r++) {
                                for (let c = 0; c < this.board.size; c++) {
                                    const cell = destinationState.boardState[r][c];
                                    if (cell && cell.id === highlightId) { hr = r; hc = c; break; }
                                }
                                if (hr !== null) break;
                            }
                            if (hr !== null) this.highlightLastMove(hr, hc);
                        }
                    }
                    if (onAnimationComplete) onAnimationComplete();
                }
                return true;
            }

            // Case B: LEAVE a rotation step → reverse climb then rotate back
            if (leavingState.moveType === 'rotation') {
                const preRotation = leavingState.preRotationBoardState; // P2
                const postRotation = leavingState.boardState;           // P3

                if (preRotation) {
                    let highlightId = null;
                    if (
                        destinationState.lastMoveRow !== null && destinationState.lastMoveColumn !== null &&
                        destinationState.boardState[destinationState.lastMoveRow][destinationState.lastMoveColumn]
                    ) {
                        highlightId = destinationState.boardState[destinationState.lastMoveRow][destinationState.lastMoveColumn].id;
                    }

                    this.boardRenderer.animateReplayReverseGravity(preRotation, postRotation, () => {
                        this.board.grid = preRotation.map(row =>
                            row.map(cell => (cell ? new Stone(cell.playerId, cell.id) : null))
                        );
                        this.boardRenderer.drawBoard();

                        if (highlightId !== null) {
                            let r2 = null, c2 = null;
                            for (let r = 0; r < this.board.size; r++) {
                                for (let c = 0; c < this.board.size; c++) {
                                    const cell = preRotation[r][c];
                                    if (cell && cell.id === highlightId) { r2 = r; c2 = c; break; }
                                }
                                if (r2 !== null) break;
                            }
                            if (r2 !== null) this.highlightLastMove(r2, c2);
                        }

                        this.animateReplayRotationBackward(() => {
                            this.restoreGameState(destinationState, true);
                            if (highlightId !== null) {
                                const lr = destinationState.lastMoveRow, lc = destinationState.lastMoveColumn;
                                if (lr !== null && lc !== null) this.highlightLastMove(lr, lc);
                            }
                            this.currentStep = targetIndex;
                            if (onAnimationComplete) onAnimationComplete();
                        });
                    }, highlightId);
                } else {
                    this.animateReplayRotationBackward(() => {
                        this.restoreGameState(destinationState, true);
                        this.currentStep = targetIndex;
                        if (onAnimationComplete) onAnimationComplete();
                    });
                }
                return true;
            }

            // Default: simple render of destination
            this.restoreGameState(destinationState, true);
            this.currentStep = targetIndex;
            if (onAnimationComplete) onAnimationComplete();
            return true;
        }
        return false;
    }

    restoreGameState(gameState, shouldRender = true) {
        // Restore board state (data model)
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                if (gameState.boardState[row][col]) {
                    this.board.grid[row][col] = new Stone(gameState.boardState[row][col].playerId);
                } else {
                    this.board.grid[row][col] = null;
                }
            }
        }

        // Update current player
        this.currentPlayer = gameState.player;
        
        if (shouldRender) {
            // Redraw the board
            this.boardRenderer.drawBoard();
            
            // Highlight the last move if available
            if (gameState.lastMoveRow !== null && gameState.lastMoveColumn !== null) {
                this.highlightLastMove(gameState.lastMoveRow, gameState.lastMoveColumn);
            }
        }
        
        console.log('[GameController] Restored game state:', gameState.description);
    }

    animateReplayRotation(onComplete) {
        // Temporarily disable input during replay rotation animation
        this.disableInput();
        
        // Use the board renderer's rotation animation, but don't reset the grid's visual state yet
        this.boardRenderer.animateRotation(() => {
            // After rotation animation, re-enable input and call completion callback
            this.enableInput();
            if (onComplete) {
                onComplete();
            }
        }, { shouldReset: false });
    }

    animateReplayRotationBackward(onComplete) {
        // Temporarily disable input during replay rotation animation
        this.disableInput();
        
        // Use the board renderer's backward rotation animation
        this.boardRenderer.animateRotationBackward(() => {
            // After rotation animation, re-enable input and call completion callback
            this.enableInput();
            if (onComplete) {
                onComplete();
            }
        });
    }

    highlightLastMove(row, col) {
        // Find the stone element and add red border
        const stoneElement = this.boardRenderer.getStoneElement(row, col);
        if (stoneElement) {
            // Remove any existing highlights
            this.clearMoveHighlights();
            
            // Add red border to highlight the last move
            stoneElement.style.border = '3px solid red';
            stoneElement.style.borderRadius = '50%';
        }
    }

    clearMoveHighlights() {
        // Clear all existing move highlights
        const allStones = document.querySelectorAll('.stone');
        allStones.forEach(stone => {
            stone.style.border = '';
            stone.style.borderRadius = '';
        });
    }

    getCurrentReplayInfo() {
        if (this.gameHistory.length === 0) return null;
        
        const currentState = this.gameHistory[this.currentStep];
        return {
            stepNumber: this.currentStep + 1,
            totalSteps: this.gameHistory.length,
            description: currentState.description,
            canGoNext: this.currentStep < this.gameHistory.length - 1,
            canGoPrev: this.currentStep > 0,
            isReplayMode: this.replayMode
        };
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
        
        // Update current player for history tracking
        this.currentPlayer = playerId;
        
        this.boardRenderer.animateStoneDrop(selectedRow, col, targetRow, stone, () => {
            this.board.placeStone(targetRow, col, stone);
            this.boardRenderer.drawBoard();
            
            // Capture game state after move (if not in replay mode)
            if (!this.replayMode) {
                this.captureGameState('move', targetRow, col);
            }
            
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
            
            // Snapshot the board state immediately after rotation (pre-gravity)
            const preRotationBoardState = this.board.grid.map(row =>
                row.map(cell => cell ? { playerId: cell.playerId, id: cell.id } : null)
            );
        
            // Apply gravity to the rotated grid
            this.board.applyGravity();
        
            // Animate stones falling due to gravity
            this.boardRenderer.animateGravity(() => {
                // After gravity animation completes
                
                // Re-render the board to show the final state
                this.boardRenderer.drawBoard();
                
                // Capture game state after rotation (if not in replay mode)
                if (!this.replayMode) {
                    this.captureGameState('rotation', null, null, { preRotationBoardState });
                }
        
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
