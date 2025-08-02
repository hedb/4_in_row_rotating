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
});


