import { PLAYER_COLORS, CELL_SIZE, STONE_SIZE, GAP_SIZE, STONE_FALLING_SPEED } from './config.js';
export class BoardRenderer {
    constructor(board, cellSize) {
        this.board = board;
        this.cellSize = cellSize;
        this.stoneSize = STONE_SIZE;
        this.gapSize = GAP_SIZE;
        this.gridWrapper = document.getElementById('grid-wrapper');
        this.gridElement = document.getElementById('grid');
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
                    const stoneColor = PLAYER_COLORS[stone.playerId];
                    stoneElement.style.backgroundColor = stoneColor;

                    // Assign the stone's unique ID to the element
                    stoneElement.dataset.stoneId = stone.id;

                    cell.appendChild(stoneElement);
                }

                this.gridElement.appendChild(cell);
            }
        }
    }

    animateRotation(callback) {
        // Apply the rotation to the grid wrapper
        this.gridWrapper.style.transform = `rotate(-90deg)`;
    
        // Listen for the transition end event
        this.gridWrapper.addEventListener('transitionend', () => {
            // Remove the rotation and transition
            this.gridWrapper.style.transition = 'none';
            this.gridWrapper.style.transform = 'rotate(0deg)';
    
            // Force reflow to re-enable transitions
            void this.gridWrapper.offsetWidth;
            this.gridWrapper.style.transition = 'transform 1s ease-in-out';
    
            // Re-render the grid to reflect the new state
            this.drawBoard();
    
            // Callback after animation completes
            if (callback) callback();
        }, { once: true });
    }
    

    animateGravity(callback) {
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
                    stoneElement.dataset.stoneId = stone.id; 

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
            // Start animations
            this.animateStonesFalling(stonesToAnimate, callback);
        } else {
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
                if (animationsCompleted === totalAnimations) {
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
                this.board.placeStone(targetRow, col, stone.playerId);
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


    resetRendering() {
        this.rotationDegrees = 0;
        this.gridWrapper.style.transform = 'rotate(0deg)';
        this.drawBoard();
    }

}
