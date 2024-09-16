export class InputHandler {
    constructor(gameController) {
        this.gameController = gameController;
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleRotateClick = this.handleRotateClick.bind(this);
        this.handleRotationFrequencyChange = this.handleRotationFrequencyChange.bind(this);
    }

    bindInputEvents() {
        document.getElementById('grid').addEventListener('click', this.handleCellClick);
        document.getElementById('reset-button').addEventListener('click', () => {
            this.gameController.resetGame();
        });
        document.getElementById('rotate-button').addEventListener('click', this.handleRotateClick);
        document.getElementById('rotationFrequency').addEventListener('change', this.handleRotationFrequencyChange);

        // Set initial rotation frequency
        this.handleRotationFrequencyChange({ target: document.getElementById('rotationFrequency') });

        // Set update function for countdown
        this.gameController.update_countdown_func = this.updateCountdown;
    }

    handleRotateClick() {
        if (this.gameController.isInputDisabled()) {
            // Ignore input if disabled
            return;
        }
        this.gameController.rotateGrid();
    }

    handleCellClick(event) {
        if (this.gameController.isInputDisabled()) {
            // Ignore input if disabled
            return;
        }

        const target = event.target.closest('.cell');
        if (target) {
            const row = parseInt(target.dataset.row, 10);
            const col = parseInt(target.dataset.col, 10);
            this.gameController.handlePlayerInput(row, col);
        }
    }

    handleRotationFrequencyChange(event) {
        const frequency = parseInt(event.target.value, 10);
        this.gameController.rotationFrequency = frequency;
        this.gameController.turnCounter = 0;
        this.updateCountdown(this.gameController.rotationFrequency);
    }

    updateCountdown = (turnsLeft) => {
        if (typeof turnsLeft !== 'undefined') {
            const countdownElement = document.getElementById('countdown');
            countdownElement.textContent = '';
            countdownElement.textContent = turnsLeft;
            console.log(turnsLeft)
        }
    }
}