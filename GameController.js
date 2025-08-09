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

                    // 3) Animate gravity (vertical) in unrotated frame, then render final
                    this.boardRenderer.animateGravity(() => {
                        this.boardRenderer.drawBoard();
                        if (nextState.lastMoveRow !== null && nextState.lastMoveColumn !== null) {
                            this.highlightLastMove(nextState.lastMoveRow, nextState.lastMoveColumn);
                        }
                        if (onAnimationComplete) onAnimationComplete();
                    });
                });
            }
            // If the next step is a regular move, animate the stone drop
            else if (nextState.moveType === 'move') {
                // Restore the board to the state *before* the move, so we can animate over it
                this.restoreGameState(prevState, true);
                
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
            const currentState = this.gameHistory[this.currentStep];
            const prevState = this.gameHistory[this.currentStep - 1];

            this.currentStep--;

            if (currentState.moveType === 'rotation') {
                // Backward rotation: instantly show the pre-rotation state, then rotate back
                this.restoreGameState(prevState, true);
                this.animateReplayRotationBackward(() => {
                    if (onAnimationComplete) onAnimationComplete();
                });
            } else if (currentState.moveType === 'move') {
                const { lastMoveRow, lastMoveColumn, player } = currentState;
                const stone = new Stone(player);
                
                // Show the board with the stone we're about to remove
                this.restoreGameState(currentState, true);

                // Use a timeout to allow the browser to render the current state first
                setTimeout(() => {
                    this.boardRenderer.animateReplayStoneRemoval(lastMoveRow, lastMoveColumn, stone, () => {
                        // After the stone is gone, show the board in its previous state
                        this.restoreGameState(prevState, true); 
                        if (onAnimationComplete) onAnimationComplete();
                    });
                }, 50);
            } else {
                this.restoreGameState(prevState, true);
                if (onAnimationComplete) onAnimationComplete();
            }
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
