import { PLAYER_COLORS, CELL_SIZE, STONE_SIZE, GAP_SIZE, STONE_FALLING_SPEED } from './config.js';
export class BoardRenderer {
    constructor(board, cellSize) {
        this.board = board;
        this.cellSize = cellSize;
        this.stoneSize = STONE_SIZE;
        this.gapSize = GAP_SIZE;
        this.gridWrapper = document.getElementById('grid-wrapper');
        this.gridElement = document.getElementById('grid');
        this.isAnimatingRotation = false;
        this.currentRotation = 0;
    }
    
    drawBoard() {
        // Clear the grid element
        this.gridElement.innerHTML = '';

        // Iterate over the board grid and create cell elements
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const stone = this.board.grid[row][col];
                if (stone) {
                    const stoneElement = document.createElement('div');
                    stoneElement.classList.add('stone');
                    // stone.setElement(stoneElement);
                    const stoneColor = PLAYER_COLORS[stone.playerId];
                    stoneElement.style.backgroundColor = stoneColor;

                    // Assign the stone's unique ID to the element
                    stoneElement.dataset.stoneId = stone.id;

                    cell.appendChild(stoneElement);
                    console.log(typeof(stone));
                    stone.setElement(stoneElement);
                }

                this.gridElement.appendChild(cell);
            }
        }
    }

    animateRotation(callback, options = {}) {
        const { shouldReset = true } = options;
        console.log('[BoardRenderer] animateRotation() called');

        // Prevent multiple simultaneous rotations
        if (this.isAnimatingRotation) {
            console.log('[BoardRenderer] animateRotation() - already animating, aborting');
            return;
        }
        console.log('[BoardRenderer] animateRotation() - starting rotation animation');
        this.isAnimatingRotation = true;
        
        // Always rotate by exactly 90 degrees counterclockwise from current position
        // We don't need to track accumulated rotation since we reset to 0 after each animation
        this.gridWrapper.style.transform = `rotate(-90deg)`;
    
        // Flag to prevent multiple callback executions
        let callbackExecuted = false;
        
        // Define a named handler to be able to remove it later
        const handleTransitionEnd = (event) => {
            // Ensure we are only responding to the transition on the grid wrapper itself
            if (event.target !== this.gridWrapper) {
                return;
            }
            
            // Prevent multiple executions
            if (callbackExecuted) {
                return;
            }
            callbackExecuted = true;

            // Clean up the event listener immediately
            this.gridWrapper.removeEventListener('transitionend', handleTransitionEnd);

            if (shouldReset) {
            // Reset visual rotation to 0 degrees but keep track of logical rotation
            this.gridWrapper.style.transition = 'none';
            this.gridWrapper.style.transform = 'rotate(0deg)';
            
            // Force reflow
            this.gridWrapper.getBoundingClientRect();
            
            // Re-enable transitions
            this.gridWrapper.style.transition = '';
            }

            // Reset the animation flag
            this.isAnimatingRotation = false;
            console.log('[BoardRenderer] animateRotation() - animation completed, calling callback');
    
            // Callback after animation completes
            if (callback) {
                callback();
            } else {
                console.log('[BoardRenderer] animateRotation() - no callback provided');
            }
        };
    
        // Listen for the transition end event
        this.gridWrapper.addEventListener('transitionend', handleTransitionEnd);
        
        // Fallback timeout in case transitionend doesn't fire (mobile bug protection)
        setTimeout(() => {
            if (!callbackExecuted) {
                handleTransitionEnd({ target: this.gridWrapper });
            }
        }, 2000); // 2 second fallback
    }
    
    resetGridRotation() {
        this.gridWrapper.style.transition = 'none';
        this.gridWrapper.style.transform = 'rotate(0deg)';
        this.gridWrapper.getBoundingClientRect(); // Force reflow
        this.gridWrapper.style.transition = '';
    }
    
    animateRotationBackward(callback) {
        if (this.isAnimatingRotation) {
            return;
        }
        this.isAnimatingRotation = true;

        // Apply a positive 90-degree rotation to animate backward
        this.gridWrapper.style.transform = `rotate(90deg)`;

        let callbackExecuted = false;
        const handleTransitionEnd = (event) => {
            if (event.target !== this.gridWrapper || callbackExecuted) {
                return;
            }
            callbackExecuted = true;
            this.gridWrapper.removeEventListener('transitionend', handleTransitionEnd);

            // Reset visual rotation
            this.gridWrapper.style.transition = 'none';
            this.gridWrapper.style.transform = 'rotate(0deg)';
            this.gridWrapper.getBoundingClientRect(); // Force reflow
            this.gridWrapper.style.transition = '';

            this.isAnimatingRotation = false;
            if (callback) callback();
        };

        this.gridWrapper.addEventListener('transitionend', handleTransitionEnd);

        // Fallback
        setTimeout(() => {
            if (!callbackExecuted) {
                handleTransitionEnd({ target: this.gridWrapper });
            }
        }, 2000);
    }

    // For replay: animate stones falling after rotation
    animateReplayGravity(beforeState, afterState, callback) {
        // After rotation, stones should fall from their actual rotated positions
        // First, we need to calculate where each stone in beforeState ended up after rotation
        
        const stonesToAnimate = [];
        
        // Map each stone from beforeState to its rotated position, then to its final position
        for (let beforeRow = 0; beforeRow < this.board.size; beforeRow++) {
            for (let beforeCol = 0; beforeCol < this.board.size; beforeCol++) {
                const stone = beforeState[beforeRow][beforeCol];
                if (stone) {
                    // Calculate where this stone ended up after 90-degree counterclockwise rotation
                    const rotatedRow = this.board.size - 1 - beforeCol;
                    const rotatedCol = beforeRow;
                    
                    // Find where this stone should end up in the final state
                    let finalRow = -1;
                    let finalCol = -1;
                    
                    // Find this stone in the afterState
                    for (let r = 0; r < this.board.size; r++) {
                        for (let c = 0; c < this.board.size; c++) {
                            if (afterState[r][c] && afterState[r][c].playerId === stone.playerId) {
                                // Simple matching - in a real game you'd want better stone tracking
                                finalRow = r;
                                finalCol = c;
                                afterState[r][c] = null; // Mark as used to avoid double-matching
                                break;
                            }
                        }
                        if (finalRow !== -1) break;
                    }
                    
                    if (finalRow !== -1) {
                        stonesToAnimate.push({
                            stone: stone,
                            fromRow: rotatedRow,
                            toRow: finalRow,
                            col: finalCol
                        });
                    }
                }
            }
        }
        
        // Clear the board and add empty cells
        this.gridElement.innerHTML = '';
        
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                this.gridElement.appendChild(cell);
            }
        }
        
        this.animateStonesFallingReplay(stonesToAnimate, callback);
    }
    
    // For replay: animate stones flying up before backward rotation
    animateReplayReverseGravity(beforeState, afterState, callback, highlightStoneId = null) {
        const stonesToAnimate = [];
        
        // Find stones that need to "fly up" to their pre-rotation positions
        for (let beforeRow = 0; beforeRow < this.board.size; beforeRow++) {
            for (let beforeCol = 0; beforeCol < this.board.size; beforeCol++) {
                const stone = beforeState[beforeRow][beforeCol];
                if (stone) {
                    // Find where this stone ended up after rotation
                    let afterRow = -1;
                    for (let r = 0; r < this.board.size; r++) {
                        for (let c = 0; c < this.board.size; c++) {
                            if (afterState[r][c] && afterState[r][c].playerId === stone.playerId && afterState[r][c].id === stone.id) {
                                afterRow = r;
                                break;
                            }
                        }
                        if (afterRow !== -1) break;
                    }
                    
                    if (afterRow !== -1 && afterRow !== beforeRow) {
                        stonesToAnimate.push({
                            stone: stone,
                            fromRow: afterRow,
                            toRow: beforeRow,
                            col: beforeCol
                        });
                    }
                }
            }
        }
        
        this.animateStonesRisingReplay(stonesToAnimate, callback, highlightStoneId);
    }
    
    animateStonesFallingReplay(stonesToAnimate, callback) {
        let animationsCompleted = 0;
        const totalAnimations = stonesToAnimate.length;

        if (totalAnimations === 0) {
            if (callback) callback();
            return;
        }

        // Clear the board to avoid duplicates
        this.gridElement.innerHTML = '';
        
        // Add empty cells
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                this.gridElement.appendChild(cell);
            }
        }

        stonesToAnimate.forEach(stoneInfo => {
            const { stone, fromRow, toRow, col } = stoneInfo;
            
            setTimeout(() => {
                // Create temporary stone element for animation
                const stoneElement = document.createElement('div');
                stoneElement.classList.add('stone');
                stoneElement.style.backgroundColor = PLAYER_COLORS[stone.playerId];
                stoneElement.style.position = 'absolute';
                stoneElement.style.zIndex = '100';
                
                // Position at start location
                const offset = (this.cellSize - this.stoneSize) / 2;
                const leftPos = col * (this.cellSize + this.gapSize) + offset;
                const startTop = fromRow * (this.cellSize + this.gapSize) + offset;
                const endTop = toRow * (this.cellSize + this.gapSize) + offset;
                
                stoneElement.style.left = `${leftPos}px`;
                stoneElement.style.top = `${startTop}px`;
                stoneElement.style.transition = 'top 0.5s ease-in';
                
                this.gridElement.appendChild(stoneElement);
                
                // Trigger animation
                setTimeout(() => {
                    stoneElement.style.top = `${endTop}px`;
                }, 10);
                
                // Clean up after animation
                setTimeout(() => {
                    if (stoneElement.parentNode) {
                        stoneElement.parentNode.removeChild(stoneElement);
                    }
                    animationsCompleted++;
                    if (animationsCompleted === totalAnimations && callback) {
                        callback();
                    }
                }, 600);
            }, 0);
        });
    }
    
    animateStonesRisingReplay(stonesToAnimate, callback, highlightStoneId = null) {
        let animationsCompleted = 0;
        const totalAnimations = stonesToAnimate.length;

        if (totalAnimations === 0) {
            if (callback) callback();
            return;
        }

        // Clear the board to avoid duplicates
        this.gridElement.innerHTML = '';
        
        // Add empty cells
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                this.gridElement.appendChild(cell);
            }
        }

        stonesToAnimate.forEach(stoneInfo => {
            const { stone, fromRow, toRow, col } = stoneInfo;
            
            // Create temporary stone element for animation
            const stoneElement = document.createElement('div');
            stoneElement.classList.add('stone');
            stoneElement.style.backgroundColor = PLAYER_COLORS[stone.playerId];
            stoneElement.style.position = 'absolute';
            stoneElement.style.zIndex = '100';

            // Highlight if this is the tracked stone
            if (highlightStoneId !== null && stone.id === highlightStoneId) {
                stoneElement.style.border = '3px solid red';
                stoneElement.style.borderRadius = '50%';
            }
            
            // Position at start location
            const offset = (this.cellSize - this.stoneSize) / 2;
            const leftPos = col * (this.cellSize + this.gapSize) + offset;
            const startTop = fromRow * (this.cellSize + this.gapSize) + offset;
            const endTop = toRow * (this.cellSize + this.gapSize) + offset;
            
            stoneElement.style.left = `${leftPos}px`;
            stoneElement.style.top = `${startTop}px`;
            stoneElement.style.transition = 'top 0.5s ease-out';
            
            this.gridElement.appendChild(stoneElement);
            
            // Trigger animation (stones fly up)
            setTimeout(() => {
                stoneElement.style.top = `${endTop}px`;
            }, 10);
            
            // Clean up after animation
            setTimeout(() => {
                if (stoneElement.parentNode) {
                    stoneElement.parentNode.removeChild(stoneElement);
                }
                animationsCompleted++;
                if (animationsCompleted === totalAnimations && callback) {
                    callback();
                }
            }, 600);
        });
    }

    
    animateGravity(callback, highlightStoneId = null) {
        console.log('[BoardRenderer] animateGravity() called');
        // Clear the grid element
        this.gridElement.innerHTML = '';
    
        // Store stones that need to animate
        const stonesToAnimate = [];
    
        // Iterate over the grid to create cells and stones
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
    
                const stone = this.board.grid[row][col];
                if (stone !== null) {
                    const stoneElement = document.createElement('div');
                    stoneElement.classList.add('stone');
                    stoneElement.style.backgroundColor = PLAYER_COLORS[stone.playerId];
                    stoneElement.dataset.stoneId = stone.id; // Assign unique ID

                    // If this is the highlighted stone, add red border
                    if (highlightStoneId !== null && stone.id === highlightStoneId) {
                        stoneElement.style.border = '3px solid red';
                        stoneElement.style.borderRadius = '50%';
                    }

                    // Calculate initial and target positions
                    const previousPosition = this.getPreviousStonePosition(row, col, stone);
                    const currentTop = row * (this.cellSize + this.gapSize) + (this.cellSize - this.stoneSize) / 2;
                    const currentLeft = col * (this.cellSize + this.gapSize) + (this.cellSize - this.stoneSize) / 2;
    
                    stoneElement.style.position = 'absolute';
                    stoneElement.style.left = `${currentLeft}px`;
    
                    if (previousPosition.top !== currentTop) {
                        // Start from previous top position
                        stoneElement.style.top = `${previousPosition.top}px`;
    
                        // Prepare to animate to new position
                        stonesToAnimate.push({
                            element: stoneElement,
                            fromTop: previousPosition.top,
                            toTop: currentTop,
                            stoneId: stone.id,
                        });
                    } else {
                        // Stone didn't move; set directly to current position
                        stoneElement.style.top = `${currentTop}px`;
                    }
    
                    // Append stone to grid
                    this.gridElement.appendChild(stoneElement);
                }
    
                this.gridElement.appendChild(cell);
            }
        }
    
        if (stonesToAnimate.length > 0) {
            console.log(`[BoardRenderer] animateGravity() - starting ${stonesToAnimate.length} stone animations`);
            // Start animations
            this.animateStonesFalling(stonesToAnimate, callback);
        } else {
            console.log('[BoardRenderer] animateGravity() - no stones to animate, calling callback immediately');
            // No stones to animate
            if (callback) callback();
        }
    }
    

    getPreviousStonePosition(row, col, stone) {
        // Find the stone's position before gravity was applied
        // This requires tracking the stones' positions before gravity
        // For the purpose of this implementation, we'll assume that the stones moved vertically only

        const previousRow = this.findPreviousRow(row, col, stone);
        const top = previousRow * (this.cellSize + this.gapSize) + (this.cellSize - this.stoneSize) / 2;
        return { top };
    }

    findPreviousRow(newRow, col, stone) {
        const previousGrid = this.board.previousGrid;
    
        for (let row = 0; row < this.board.size; row++) {
            const prevStone = previousGrid[row][col];
            if (prevStone && prevStone.id === stone.id) {
                return row;
            }
        }
    
        // If not found, assume it started from the newRow
        return newRow;
    }
    

    animateStonesFalling(stonesToAnimate, callback) {
        let animationsCompleted = 0;
        const totalAnimations = stonesToAnimate.length;

        if (totalAnimations === 0) {
            // No stones to animate
            if (callback) callback();
            return;
        }

        stonesToAnimate.forEach(stoneData => {
            const { element, fromTop, toTop } = stoneData;
            const distance = Math.abs(toTop - fromTop);
            const duration = distance / STONE_FALLING_SPEED;

            // Apply the transition
            element.style.transition = `top ${duration}s ease-in`;

            // Force reflow
            element.getBoundingClientRect();

            // Set the target position
            element.style.top = `${toTop}px`;

            element.addEventListener('transitionend', () => {
                animationsCompleted++;
                console.log(`[BoardRenderer] animateStonesFalling() - animation ${animationsCompleted}/${totalAnimations} completed`);
                if (animationsCompleted === totalAnimations) {
                    console.log('[BoardRenderer] animateStonesFalling() - all animations completed, calling callback');
                    // All animations completed
                    if (callback) callback();
                }
            });
        });
    }
    


    animateStoneDrop(startRow, col, targetRow, stone, callback) {
        const stoneColor = PLAYER_COLORS[stone.playerId];
        const stoneElement = document.createElement('div');
        stoneElement.classList.add('stone');
        stoneElement.style.backgroundColor = stoneColor;
        stoneElement.dataset.stoneId = stone.id;

        // Calculate the offset to center the stone within the cell
        const offset = (this.cellSize - this.stoneSize) / 2;

        // Set initial position based on the selected cell
        stoneElement.style.position = 'absolute';
        stoneElement.style.left = `${col * (this.cellSize + this.gapSize) + offset}px`;
        stoneElement.style.top = `${startRow * (this.cellSize + this.gapSize) + offset}px`;

        // Append to the grid
        this.gridElement.appendChild(stoneElement);

        if (startRow === targetRow) {
            // No animation needed, directly proceed
            setTimeout(() => {
                // Remove the temporary stone element
                this.gridElement.removeChild(stoneElement);
                this.board.placeStone(targetRow, col, stone);
                this.drawBoard();
                callback(); // Proceed with game logic
            }, 0);
        } else {
            // Calculate the distance the stone needs to fall
            const distance = Math.abs(targetRow - startRow) * (this.cellSize + this.gapSize);

            // Calculate the duration based on the constant falling speed
            const duration = distance / STONE_FALLING_SPEED; // Duration in seconds

            // Animate the stone dropping to the target position
            stoneElement.style.transition = `top ${duration}s linear`;

            const targetTop = targetRow * (this.cellSize + this.gapSize) + offset;

            // Force reflow to start the transition
            stoneElement.getBoundingClientRect();

            // Set the target position
            stoneElement.style.top = `${targetTop}px`;

            // Listen for the transition to end
            stoneElement.addEventListener('transitionend', () => {
                // Remove the animated stone
                this.gridElement.removeChild(stoneElement);
                callback(); // Proceed with game logic
            });
        }
    }

    animateReplayStoneDrop(startRow, col, targetRow, stone, callback) {
        const stoneColor = PLAYER_COLORS[stone.playerId];
        const stoneElement = document.createElement('div');
        stoneElement.classList.add('stone');
        stoneElement.style.backgroundColor = stoneColor;
        stoneElement.dataset.stoneId = stone.id;

        const offset = (this.cellSize - this.stoneSize) / 2;
        stoneElement.style.position = 'absolute';
        stoneElement.style.left = `${col * (this.cellSize + this.gapSize) + offset}px`;
        stoneElement.style.top = `${startRow * (this.cellSize + this.gapSize) + offset}px`;
        
        // Add a higher z-index to ensure it animates over existing stones
        stoneElement.style.zIndex = '10';

        this.gridElement.appendChild(stoneElement);

        if (startRow === targetRow) {
            // No animation needed
            this.gridElement.removeChild(stoneElement); // Clean up temporary element
            if (callback) callback();
            return;
        }

        const distance = Math.abs(targetRow - startRow) * (this.cellSize + this.gapSize);
        const duration = distance / STONE_FALLING_SPEED;
        stoneElement.style.transition = `top ${duration}s linear`;
        const targetTop = targetRow * (this.cellSize + this.gapSize) + offset;

        stoneElement.getBoundingClientRect(); // Force reflow
        stoneElement.style.top = `${targetTop}px`;

        stoneElement.addEventListener('transitionend', () => {
            // IMPORTANT: Do NOT remove the element, as the final board is already rendered underneath.
            // Instead, we just hide it so the permanent stone is visible.
            stoneElement.style.opacity = '0';
            // Clean up the element from the DOM after a short delay
            setTimeout(() => {
                if (stoneElement.parentElement) {
                    this.gridElement.removeChild(stoneElement);
                }
            }, 100);
            if (callback) callback();
        });
    }

    animateReplayStoneRemoval(row, col, stone, callback) {
        // Find and hide the existing static stone at this position
        const existingStone = this.getStoneElement(row, col);
        if (existingStone) {
            existingStone.style.visibility = 'hidden';
        }

        const stoneColor = PLAYER_COLORS[stone.playerId];
        const stoneElement = document.createElement('div');
        stoneElement.classList.add('stone');
        stoneElement.style.backgroundColor = stoneColor;
        stoneElement.style.zIndex = '10';

        const offset = (this.cellSize - this.stoneSize) / 2;
        const startTop = row * (this.cellSize + this.gapSize) + offset;
        const endTop = 0 - this.stoneSize; // Animate to just above the board

        stoneElement.style.position = 'absolute';
        stoneElement.style.left = `${col * (this.cellSize + this.gapSize) + offset}px`;
        stoneElement.style.top = `${startTop}px`;

        this.gridElement.appendChild(stoneElement);

        const distance = Math.abs(endTop - startTop);
        const duration = distance / STONE_FALLING_SPEED;
        stoneElement.style.transition = `top ${duration}s linear`;

        stoneElement.getBoundingClientRect(); // Force reflow
        stoneElement.style.top = `${endTop}px`;

        stoneElement.addEventListener('transitionend', () => {
            if (stoneElement.parentElement) {
                this.gridElement.removeChild(stoneElement);
            }
            if (callback) callback();
        });
    }

    animateReplayGravityFromPreRotation(preRotationState, postRotationState, callback) {
        // Clear the board and add empty cells
        this.gridElement.innerHTML = '';
        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                this.gridElement.appendChild(cell);
            }
        }

        const stonesToAnimate = [];

        for (let col = 0; col < this.board.size; col++) {
            const preRows = [];
            const postRows = [];

            for (let row = 0; row < this.board.size; row++) {
                if (preRotationState[row][col]) {
                    preRows.push({ playerId: preRotationState[row][col].playerId, row });
                }
            }
            for (let row = 0; row < this.board.size; row++) {
                if (postRotationState[row][col]) {
                    postRows.push({ playerId: postRotationState[row][col].playerId, row });
                }
            }

            const n = Math.min(preRows.length, postRows.length);
            for (let i = 0; i < n; i++) {
                stonesToAnimate.push({
                    stone: { playerId: preRows[i].playerId },
                    fromRow: preRows[i].row,
                    toRow: postRows[i].row,
                    col
                });
            }
        }

        // Use existing falling animation utility
        this.animateStonesFallingReplay(stonesToAnimate, callback);
    }


    resetRendering() {
        this.currentRotation = 0;
        this.gridWrapper.style.transform = 'rotate(0deg)';
        this.drawBoard();
    }

    getStoneElement(row, col) {
        // Find the cell at the specified row/col
        const cell = this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            // Find the stone element within that cell
            return cell.querySelector('.stone');
        }
        return null;
    }

}
