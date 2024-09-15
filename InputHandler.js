export class InputHandler {
    constructor(gameController) {
        this.gameController = gameController;
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleRotateClick = this.handleRotateClick.bind(this);
    }

    bindInputEvents() {
        document.getElementById('grid').addEventListener('click', this.handleCellClick);
        document.getElementById('reset-button').addEventListener('click', () => {
            this.gameController.resetGame();
        });
        document.getElementById('rotate-button').addEventListener('click', this.handleRotateClick);
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

}
