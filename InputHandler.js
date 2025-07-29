export class InputHandler {
    constructor() {
        this.gameHandler = null; // Will be set by the active game handler
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleRotateClick = this.handleRotateClick.bind(this);
        this.handleRotationFrequencyChange = this.handleRotationFrequencyChange.bind(this);
        this.handleResetClick = this.handleResetClick.bind(this);
    }

    setGameHandler(gameHandler) {
        this.gameHandler = gameHandler;
    }

    bindInputEvents() {
        // Remove any existing event listeners first
        this.unbindInputEvents();

        document.getElementById('grid').addEventListener('click', this.handleCellClick);
        document.getElementById('reset-button').addEventListener('click', this.handleResetClick);
        document.getElementById('rotate-button').addEventListener('click', this.handleRotateClick);
        document.getElementById('rotationFrequency').addEventListener('change', this.handleRotationFrequencyChange);

        // Set initial rotation frequency only for local games
        if (this.gameHandler && this.gameHandler.constructor.name === 'LocalGameHandler') {
        this.handleRotationFrequencyChange({ target: document.getElementById('rotationFrequency') });
        }
    }

    unbindInputEvents() {
        const grid = document.getElementById('grid');
        const resetButton = document.getElementById('reset-button');
        const rotateButton = document.getElementById('rotate-button');
        const rotationFrequency = document.getElementById('rotationFrequency');

        if (grid) grid.removeEventListener('click', this.handleCellClick);
        if (resetButton) resetButton.removeEventListener('click', this.handleResetClick);
        if (rotateButton) rotateButton.removeEventListener('click', this.handleRotateClick);
        if (rotationFrequency) rotationFrequency.removeEventListener('change', this.handleRotationFrequencyChange);
    }

    handleRotateClick() {
        if (!this.gameHandler) return;
        
        if (this.gameHandler.gameController && this.gameHandler.gameController.isInputDisabled()) {
            // Ignore input if disabled
            return;
        }
        
        if (this.gameHandler.rotateGrid) {
            this.gameHandler.rotateGrid();
        }
    }

    handleCellClick(event) {
        if (!this.gameHandler) return;

        if (this.gameHandler.gameController && this.gameHandler.gameController.isInputDisabled()) {
            // Ignore input if disabled
            return;
        }

        const target = event.target.closest('.cell');
        if (target) {
            const row = parseInt(target.dataset.row, 10);
            const col = parseInt(target.dataset.col, 10);
            
            if (this.gameHandler.handlePlayerInput) {
                this.gameHandler.handlePlayerInput(row, col);
            }
        }
    }

    handleResetClick() {
        if (!this.gameHandler) return;
        
        if (this.gameHandler.resetGame) {
            this.gameHandler.resetGame();
        }
    }

    handleRotationFrequencyChange(event) {
        if (!this.gameHandler) return;
        
        const frequency = parseInt(event.target.value, 10);
        
        if (this.gameHandler.setRotationFrequency) {
            this.gameHandler.setRotationFrequency(frequency);
        }
    }
}