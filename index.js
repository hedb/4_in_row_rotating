import { GameController } from './GameController.js';
import { LocalGameHandler } from './LocalGameHandler.js';
import { AIGameHandler } from './AIGameHandler.js';
import { OnlineGameHandler } from './OnlineGameHandler.js';
import { InputHandler } from './InputHandler.js';
import { VERSION } from './config.js';

console.log(`[Main App] Loaded with VERSION: ${VERSION}`);

class GameApp {
    constructor() {
        this.gameController = null;
        this.localGameHandler = null;
        this.aiGameHandler = null;
        this.onlineGameHandler = null;
        this.inputHandler = null;
        this.currentMode = null;

        this.init();
    }

    init() {
        // Check for session ID in URL (for online mode auto-join)
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');

        if (sessionId) {
            // Auto-join online game
            this.startOnlineModeAsGuest(sessionId);
        } else {
            // Show mode selection
            this.showModeSelection();
        }

        // Bind version display and settings
        this.bindCommonUI();
    }

    showModeSelection() {
        const modeSelection = document.getElementById('mode-selection');
        const gameContainer = document.getElementById('game-container');

        modeSelection.classList.remove('hidden');
        gameContainer.classList.add('hidden');

        // Bind mode selection buttons
        document.getElementById('play-local-btn').addEventListener('click', () => {
            this.startLocalMode();
        });

        document.getElementById('play-ai-btn').addEventListener('click', () => {
            this.startAiMode();
        });

        document.getElementById('play-online-btn').addEventListener('click', () => {
            this.startOnlineModeAsHost();
        });
    }

    startLocalMode() {
        this.currentMode = 'local';

        // Clean up any existing input handlers
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Clean up any lingering UI elements
        this.cleanupGameUI();

        // Hide mode selection and show game
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');

        // Initialize game components
        this.gameController = new GameController();
        this.localGameHandler = new LocalGameHandler(this.gameController);
        this.inputHandler = new InputHandler();

        // Connect components
        this.inputHandler.setGameHandler(this.localGameHandler);
        this.inputHandler.bindInputEvents();

        // Initialize local game
        this.localGameHandler.init();

        console.log('[GameApp] Local mode started');
    }

    startAiMode() {
        this.currentMode = 'ai';

        // Clean up any existing input handlers
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Clean up any lingering UI elements
        this.cleanupGameUI();

        // Hide mode selection and show game
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');

        // Initialize game components
        this.gameController = new GameController();
        this.aiGameHandler = new AIGameHandler(this.gameController);
        this.inputHandler = new InputHandler();

        // Connect components
        this.inputHandler.setGameHandler(this.aiGameHandler);
        this.inputHandler.bindInputEvents();

        // Initialize AI game
        this.aiGameHandler.init();

        console.log('[GameApp] AI mode started');
    }

    async startOnlineModeAsHost() {
        this.currentMode = 'online-host';

        // Clean up any existing input handlers
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Clean up any lingering UI elements
        this.cleanupGameUI();

        // Initialize game components
        this.gameController = new GameController();
        this.onlineGameHandler = new OnlineGameHandler(this.gameController);
        this.inputHandler = new InputHandler();

        // Connect components
        this.inputHandler.setGameHandler(this.onlineGameHandler);

        // Initialize as host
        const success = await this.onlineGameHandler.initAsHost();
        if (success) {
            this.inputHandler.bindInputEvents();
            console.log('[GameApp] Online host mode started');
        } else {
            // Failed to initialize, return to mode selection
            this.returnToModeSelection();
        }
    }

    async startOnlineModeAsGuest(sessionId) {
        this.currentMode = 'online-guest';

        // Clean up any existing input handlers
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Initialize game components
        this.gameController = new GameController();
        this.onlineGameHandler = new OnlineGameHandler(this.gameController);
        this.inputHandler = new InputHandler();

        // Connect components
        this.inputHandler.setGameHandler(this.onlineGameHandler);

        // Initialize as guest
        const success = await this.onlineGameHandler.initAsGuest(sessionId);
        if (success) {
            this.inputHandler.bindInputEvents();
            console.log('[GameApp] Online guest mode started');
        } else {
            // Failed to initialize, return to mode selection
            this.returnToModeSelection();
        }
    }

    bindCommonUI() {
        // Version display
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) {
        versionDisplay.textContent = `v${VERSION}`;
    }

        // Settings pane functionality
const settingsIcon = document.getElementById('settings-icon');
const settingsPane = document.getElementById('settings-pane');
const closeSettingsButton = document.getElementById('close-settings');
const overlay = document.getElementById('overlay');

        const toggleSettingsPane = () => {
    settingsPane.classList.toggle('hidden');
    overlay.classList.toggle('hidden');
        };

        if (settingsIcon) settingsIcon.addEventListener('click', toggleSettingsPane);
        if (closeSettingsButton) closeSettingsButton.addEventListener('click', toggleSettingsPane);
        if (overlay) overlay.addEventListener('click', toggleSettingsPane);
    }

    // === REPLAY FUNCTIONALITY ===

    initReplayMode() {
        if (!this.gameController) return;

        // Hide game over container
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.add('hidden');
        }

        // Hide turn indicator
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.style.display = 'none';
        }

        // Show replay controls
        const replayControls = document.getElementById('replay-controls');
        if (replayControls) {
            replayControls.classList.remove('hidden');
        }

        // Enter replay mode in GameController
        this.gameController.enterReplayMode();

        // Bind replay control events
        this.bindReplayControls();
        
        // Update replay UI
        this.updateReplayUI();

        console.log('[GameApp] Replay mode initialized');
    }

    bindReplayControls() {
        const prevBtn = document.getElementById('replay-prev-btn');
        const nextBtn = document.getElementById('replay-next-btn');
        const exitBtn = document.getElementById('exit-replay-btn');

        // Remove existing listeners by cloning elements
        if (prevBtn) {
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', () => this.replayPrevStep());
        }

        if (nextBtn) {
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', () => this.replayNextStep());
        }

        if (exitBtn) {
            const newExitBtn = exitBtn.cloneNode(true);
            exitBtn.parentNode.replaceChild(newExitBtn, exitBtn);
            newExitBtn.addEventListener('click', () => this.exitReplayMode());
        }
    }

    replayNextStep() {
        if (!this.gameController) return;

        // Disable buttons during step transition
        this.setReplayButtonsEnabled(false);

        const success = this.gameController.nextStep(() => {
            // This callback is called after animations complete
            this.updateReplayUI();
            this.setReplayButtonsEnabled(true);
        });
        
        if (!success) {
            this.setReplayButtonsEnabled(true);
        }
    }

    replayPrevStep() {
        if (!this.gameController) return;

        // Disable buttons during step transition
        this.setReplayButtonsEnabled(false);

        const success = this.gameController.prevStep(() => {
            // This callback is called after animations complete
            this.updateReplayUI();
            this.setReplayButtonsEnabled(true);
        });
        
        if (!success) {
            this.setReplayButtonsEnabled(true);
        }
    }

    updateReplayUI() {
        if (!this.gameController) return;

        const replayInfo = this.gameController.getCurrentReplayInfo();
        if (!replayInfo) return;

        // Update step information
        const stepInfo = document.getElementById('replay-step-info');
        if (stepInfo) {
            stepInfo.textContent = replayInfo.description;
        }

        // Update button states based on navigation availability
        this.setReplayButtonsEnabled(true);
    }

    setReplayButtonsEnabled(enabled) {
        const prevBtn = document.getElementById('replay-prev-btn');
        const nextBtn = document.getElementById('replay-next-btn');
        const exitBtn = document.getElementById('exit-replay-btn');

        if (enabled) {
            // When re-enabling, check navigation availability
            const replayInfo = this.gameController?.getCurrentReplayInfo();
            if (replayInfo) {
                if (prevBtn) prevBtn.disabled = !replayInfo.canGoPrev;
                if (nextBtn) nextBtn.disabled = !replayInfo.canGoNext;
            }
            if (exitBtn) exitBtn.disabled = false;
        } else {
            // When disabling, disable all buttons
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (exitBtn) exitBtn.disabled = true;
        }
    }

    exitReplayMode() {
        if (!this.gameController) return;

        // Exit replay mode in GameController
        this.gameController.exitReplayMode();

        // Hide replay controls
        const replayControls = document.getElementById('replay-controls');
        if (replayControls) {
            replayControls.classList.add('hidden');
        }

        // Show game over container with "new game" option
        this.showGameOverOptions();

        console.log('[GameApp] Exited replay mode');
    }

    cleanupGameUI() {
        // Hide game over container
        const gameOverContainer = document.getElementById('game-over-container');
        if (gameOverContainer) {
            gameOverContainer.classList.add('hidden');
        }

        // Hide replay controls
        const replayControls = document.getElementById('replay-controls');
        if (replayControls) {
            replayControls.classList.add('hidden');
        }

        // Show turn indicator
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.style.display = 'block';
        }
    }

    showGameOverOptions() {
        // Show game over container
        const gameOverContainer = document.getElementById('game-over-container');
        const gameOverText = document.getElementById('game-over-text');
        const newGameBtn = document.getElementById('new-game-btn');

        if (gameOverContainer && gameOverText && newGameBtn) {
            gameOverText.textContent = 'Game Over';
            newGameBtn.textContent = 'New Game';
            gameOverContainer.classList.remove('hidden');

            // Bind new game button
            const newBtn = newGameBtn.cloneNode(true);
            newGameBtn.parentNode.replaceChild(newBtn, newGameBtn);
            
            newBtn.addEventListener('click', () => {
                this.returnToModeSelection();
            });
        }
    }

    // Method to return to mode selection (useful for future "Return to Menu" functionality)
    returnToModeSelection() {
        // Clean up current game
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Reset state
        this.gameController = null;
        this.localGameHandler = null;
        this.aiGameHandler = null;
        this.onlineGameHandler = null;
        this.inputHandler = null;
        this.currentMode = null;

        // Show mode selection
        this.showModeSelection();
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const gameApp = new GameApp();
    // Make GameApp accessible globally for handlers
    window.gameApp = gameApp;
});


