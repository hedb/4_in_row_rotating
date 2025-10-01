import { GameController } from './GameController.js';
import { LocalGameHandler } from './LocalGameHandler.js';
import { AIGameHandler } from './AIGameHandler.js';
import { OnlineGameHandler } from './OnlineGameHandler.js';
import { InputHandler } from './InputHandler.js';
import { ApiController } from './ApiController.js';
import { Analytics } from './analytics.js';
import { VERSION } from './config.js';
import { logBuffer } from './LogBuffer.js';

console.log(`[Main App] Loaded with VERSION: ${VERSION}`);
console.log('[LogBuffer] Log buffer system initialized');
console.log('[LogBuffer] Testing different log levels...');
console.warn('[LogBuffer] This is a warning message');
console.error('[LogBuffer] This is an error message for testing');
console.info('[LogBuffer] This is an info message');

class GameApp {
    constructor() {
        this.gameController = null;
        this.localGameHandler = null;
        this.aiGameHandler = null;
        this.onlineGameHandler = null;
        this.inputHandler = null;
        this.currentMode = null;
        this.analyticsSessionStartMs = null;
        this.analyticsSessionId = null;
        this.isGeneratingGif = false;
        this.userHasMovedAway = false;
        this.isStartingMode = false;
        this.currentGifGenerationId = 0; // Track GIF generation sessions

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
        const localBtn = document.getElementById('play-local-btn');
        if (localBtn) {
            const newLocalBtn = localBtn.cloneNode(true);
            localBtn.parentNode.replaceChild(newLocalBtn, localBtn);
            newLocalBtn.addEventListener('click', () => {
                this.startLocalMode();
            });
        }

        // AI difficulty buttons
        const aiNormal = document.getElementById('play-ai-normal-btn');
        const aiHard = document.getElementById('play-ai-hard-btn');
        const aiOuch = document.getElementById('play-ai-ouch-btn');
        if (aiNormal) {
            const newAiNormal = aiNormal.cloneNode(true);
            aiNormal.parentNode.replaceChild(newAiNormal, aiNormal);
            newAiNormal.addEventListener('click', () => {
                const color = this.getSelectedPlayerColor();
                this.startAiMode({ difficulty: 'normal', color });
            });
        }
        if (aiHard) {
            const newAiHard = aiHard.cloneNode(true);
            aiHard.parentNode.replaceChild(newAiHard, aiHard);
            newAiHard.addEventListener('click', () => {
                const color = this.getSelectedPlayerColor();
                this.startAiMode({ difficulty: 'hard', color });
            });
        }
        if (aiOuch) {
            const newAiOuch = aiOuch.cloneNode(true);
            aiOuch.parentNode.replaceChild(newAiOuch, aiOuch);
            newAiOuch.addEventListener('click', () => {
                const color = this.getSelectedPlayerColor();
                this.startAiMode({ difficulty: 'ouch', color });
            });
        }

        const onlineBtn = document.getElementById('play-online-btn');
        if (onlineBtn) {
            const newOnlineBtn = onlineBtn.cloneNode(true);
            onlineBtn.parentNode.replaceChild(newOnlineBtn, onlineBtn);
            newOnlineBtn.addEventListener('click', () => {
                this.startOnlineModeAsHost();
            });
        }
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
        const status = document.getElementById('top-right-status');
        if (status) status.style.display = 'flex';

        // Initialize game components
        this.gameController = new GameController();
        this.localGameHandler = new LocalGameHandler(this.gameController);
        this.inputHandler = new InputHandler();

        // Connect components
        this.inputHandler.setGameHandler(this.localGameHandler);
        this.inputHandler.bindInputEvents();

        // Initialize local game
        this.localGameHandler.init();

        // Analytics: start session and daily return
        this.beginSession();

        console.log('[GameApp] Local mode started');
    }

    startAiMode(options = {}) {
        if (this.isStartingMode) {
            console.warn('[GameApp] AI mode start already in progress');
            return;
        }
        if (this.currentMode === 'ai' && this.aiGameHandler) {
            console.warn('[GameApp] AI mode already active');
            return;
        }
        this.isStartingMode = true;
        try {
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
            const status = document.getElementById('top-right-status');
            if (status) status.style.display = 'flex';

            // Initialize game components
            this.gameController = new GameController();
            this.aiGameHandler = new AIGameHandler(this.gameController, {
                humanColor: options.color || 'white',
                difficulty: options.difficulty || 'normal'
            });
            this.inputHandler = new InputHandler();

            // Connect components
            this.inputHandler.setGameHandler(this.aiGameHandler);
            this.inputHandler.bindInputEvents();

            // Initialize AI game
            this.aiGameHandler.init();

            // Analytics: start session and daily return
            this.beginSession();

            console.log('[GameApp] AI mode started');
        } finally {
            this.isStartingMode = false;
        }
    }

    getSelectedPlayerColor() {
        const white = document.getElementById('color-white');
        return white && white.checked ? 'white' : 'black';
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
        const status = document.getElementById('top-right-status');
        if (status) status.style.display = 'flex';

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
        const status = document.getElementById('top-right-status');
        if (status) status.style.display = 'flex';

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

        // Settings modal functionality (easter egg)
        const gridEasterEgg = document.getElementById('hero-logo');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettingsBtn = document.getElementById('close-settings-btn');

        const showSettings = () => {
            console.log('[Settings] Opening settings modal...');
            if (settingsModal) {
                settingsModal.classList.remove('hidden');
                console.log('[Settings] Modal should now be visible');
                
                // Debug: Check modal styles
                const computedStyle = window.getComputedStyle(settingsModal);
                console.log('[Settings] Modal display:', computedStyle.display);
                console.log('[Settings] Modal visibility:', computedStyle.visibility);
                console.log('[Settings] Modal z-index:', computedStyle.zIndex);
                console.log('[Settings] Modal position:', computedStyle.position);
                console.log('[Settings] Modal classes:', settingsModal.className);
                
                // Update version display when modal opens
                const versionDisplay = document.getElementById('version-display');
                if (versionDisplay) {
                    versionDisplay.textContent = `v${VERSION}`;
                    console.log('[Settings] Version updated to:', `v${VERSION}`);
                }
                
                // Update log statistics
                this.updateLogStats();
            } else {
                console.error('[Settings] Settings modal not found!');
            }
        };

        const hideSettings = () => {
            if (settingsModal) {
                settingsModal.classList.add('hidden');
            }
        };

        if (gridEasterEgg) {
            gridEasterEgg.addEventListener('click', showSettings);
        }
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', hideSettings);
        }
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                // Close modal when clicking outside the content
                if (e.target === settingsModal) {
                    hideSettings();
                }
            });
        }

        // Log control functionality
        const copyLogsBtn = document.getElementById('copy-logs-btn');
        const clearLogsBtn = document.getElementById('clear-logs-btn');

        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', async () => {
                console.log('[Settings] Copy logs clicked');
                await this.copyLogsToClipboard();
            });
        }

        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                console.log('[Settings] Clear logs clicked');
                this.clearLogs();
            });
        }

        // Top-left global actions (work when visible)
        const analyzeBtn = document.getElementById('analyze-btn');
        const shareGifBtn = document.getElementById('share-gif-btn');
        const newGameBtn = document.getElementById('new-game-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                console.log('[UI] Analyze Game clicked');
                this.initReplayMode();
            });
        }
        if (shareGifBtn) {
            shareGifBtn.addEventListener('click', () => {
                console.log('[UI] Share GIF clicked');
                this.shareGameGif();
            });
        }
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                console.log('[UI] New Game clicked');
                this.returnToModeSelection();
            });
        }
    }

    // === REPLAY FUNCTIONALITY ===

    initReplayMode() {
        if (!this.gameController) return;

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

        // Show turn indicator and rotation status
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'flex';
        }
    }

    showGameOverOptions() {
        // Show game over container
        const gameOverContainer = document.getElementById('game-over-container');
        const gameOverText = document.getElementById('game-over-text');
        const newGameBtn = document.getElementById('new-game-btn');
        const analyzeBtn = document.getElementById('analyze-btn');
        const topLeft = document.getElementById('top-left-actions');

        if (gameOverContainer && gameOverText && newGameBtn && analyzeBtn && topLeft) {
            // Prefer a detailed message if one was set by the handler
            const existing = (gameOverText.textContent || '').trim();
            if (!existing || existing.toLowerCase() === 'game over') {
                // Derive winner label from game state if available
                let suffix = '';
                try {
                    const winner = this.gameController && this.gameController.winner;
                    if (winner === 1) suffix = ': White won';
                    else if (winner === 2) suffix = ': Black won';
                } catch (_) {}
                gameOverText.textContent = `Game Over${suffix}`;
            }
            gameOverContainer.classList.remove('hidden');
            topLeft.classList.remove('hidden');

            // Reset listeners
            const aBtn = analyzeBtn.cloneNode(true);
            analyzeBtn.parentNode.replaceChild(aBtn, analyzeBtn);
            const nBtn = newGameBtn.cloneNode(true);
            newGameBtn.parentNode.replaceChild(nBtn, newGameBtn);

            aBtn.addEventListener('click', () => {
                this.initReplayMode();
            });
            nBtn.addEventListener('click', () => {
                this.returnToModeSelection();
            });

            // Automatically generate and display GIF only if not already generated
            if (!this.gifAlreadyGenerated) {
                this.generateAndShowGif();
            }
        }
    }

    showGifInTopPanel(blob) {
        const center = document.getElementById('top-center-display');
        if (!center) {
            return;
        }
        const url = URL.createObjectURL(blob);
        center.innerHTML = '';

        // Column wrapper to center GIF and caption together
        const col = document.createElement('div');
        col.className = 'gif-share-col';

        // Create GIF image (clickable to share)
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Game GIF';
        img.addEventListener('click', () => this.shareGameGif());
        col.appendChild(img);

        // Caption below GIF
        const caption = document.createElement('p');
        caption.className = 'share-text';
        caption.textContent = 'Click to share';
        caption.style.cursor = 'pointer';
        caption.addEventListener('click', () => this.shareGameGif());
        col.appendChild(caption);

        center.appendChild(col);
    }

    showGifLoadingSpinner() {
        const center = document.getElementById('top-center-display');
        if (!center) {
            return;
        }
        center.innerHTML = '';

        // Just the spinner, centered
        const spinner = document.createElement('div');
        spinner.className = 'gif-loading-spinner';
        center.appendChild(spinner);
    }

    async generateAndShowGif() {
        try {
            if (!this.gameController) {
                throw new Error('No game in progress');
            }
            
            // Increment generation ID to track this specific GIF generation
            const generationId = ++this.currentGifGenerationId;
            console.log(`[GameApp] Starting GIF generation ${generationId}`);
            
            this.isGeneratingGif = true;
            
            // Show loading spinner while generating
            this.showGifLoadingSpinner();
            
            const blob = await this.generateGifClientSide({
                version: VERSION,
                gridSize: 6,
                playerColors: { 1: '#FFFFFF', 2: '#000000' },
                history: this.gameController.gameHistory,
                winners: this.gameController.lastWinningStoneIds || [],
                headerText: this.computeGifFooter(),
                footerText: ''
            });
            
            this.isGeneratingGif = false;
            
            // Only show GIF if this generation is still the current one
            if (generationId === this.currentGifGenerationId) {
                console.log(`[GameApp] Showing GIF for generation ${generationId}`);
                this.showGifInTopPanel(blob);
            } else {
                console.log(`[GameApp] Discarding GIF for generation ${generationId} (current: ${this.currentGifGenerationId})`);
            }
        } catch (e) {
            this.isGeneratingGif = false;
            console.error('[GameApp] Auto GIF generation failed', e);
            // Don't show alert for auto-generation, just log the error
        }
    }

    async downloadGameGif() {
        if (!this.gameController) return;

        // Build a compact replay payload the server or client-side encoder can use
        const payload = {
            version: VERSION,
            gridSize: 6,
            playerColors: { 1: '#FFFFFF', 2: '#000000' },
            history: this.gameController.gameHistory,
            winners: this.gameController.lastWinningStoneIds || [],
            headerText: this.computeGifFooter(),
            footerText: ''
        };

        try {
            const blob = await this.generateGifClientSide(payload);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'four-in-a-row.gif';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e2) {
            console.error('[GameApp] Client-side GIF generation failed', e2);
            alert('Failed to generate GIF.');
        }
    }

    async shareGameGif() {
        if (!this.gameController) {
            console.error('[GameApp] No game controller available for GIF sharing');
            return;
        }

        const payload = {
            version: VERSION,
            gridSize: 6,
            playerColors: { 1: '#FFFFFF', 2: '#000000' },
            history: this.gameController.gameHistory,
            winners: this.gameController.lastWinningStoneIds || [],
            headerText: this.computeGifFooter(),
            footerText: ''
        };

        if (!payload.history || payload.history.length === 0) {
            console.error('[GameApp] No game data available for GIF sharing');
            return;
        }

        try {
            console.log('[GameApp] Generating client-side GIF for sharing...');
            
            // Generate GIF locally (same as auto-display)
            const gifBlob = await this.generateGifClientSide(payload);
            
            // Determine game outcome and create sharing message
            const winner = this.gameController.winner;
            const gameUrl = window.location.origin + window.location.pathname;
            
            let outcomeText = '';
            let shareTitle = 'Four-in-a-Row Game';
            
            if (winner) {
                const winnerName = winner === 1 ? 'White' : 'Black';
                
                // Determine if user won based on game mode
                if (this.currentMode === 'ai') {
                    // In AI mode, check if human player won
                    const humanPlayerId = this.aiGameHandler ? this.aiGameHandler.humanPlayerId : 1;
                    if (winner === humanPlayerId) {
                        outcomeText = 'I won! 🎉';
                        shareTitle = 'I Won at Four-in-a-Row!';
                    } else {
                        outcomeText = 'I lost to the computer 🤖';
                        shareTitle = 'Challenging Game vs Computer';
                    }
                } else if (this.currentMode === 'online') {
                    // In online mode, check if current player won
                    const myPlayerId = this.onlineGameHandler ? this.onlineGameHandler.playerId : null;
                    if (winner === myPlayerId) {
                        outcomeText = 'I won! 🎉';
                        shareTitle = 'I Won at Four-in-a-Row!';
                    } else {
                        outcomeText = 'I lost 😔';
                        shareTitle = 'Great Game of Four-in-a-Row';
                    }
                } else {
                    // Local mode - just show winner
                    outcomeText = `${winnerName} won!`;
                    shareTitle = 'Four-in-a-Row Game Result';
                }
            } else {
                outcomeText = "It was a draw! 🤝";
                shareTitle = 'Four-in-a-Row Draw';
            }
            
            const shareText = `${outcomeText}\n\nPlay Four-in-a-Row with rotating grid: ${gameUrl}`;
            
            // Try native sharing first (mobile)
            if (navigator.share && navigator.canShare) {
                try {
                    const files = [new File([gifBlob], '4-in-a-row-replay.gif', { type: 'image/gif' })];
                    if (navigator.canShare({ files })) {
                        await navigator.share({
                            title: shareTitle,
                            text: shareText,
                            url: gameUrl,
                            files: files
                        });
                        console.log('[GameApp] GIF shared via native API');
                        return;
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('[GameApp] User cancelled sharing');
                        return; // Don't fallback if user cancelled
                    }
                    console.log('[GameApp] Native share failed, falling back to download:', error);
                }
            }
            else {
                console.log('[GameApp] Native share not supported, falling back to download');
            }

            // Fallback: Download with helpful instructions
            console.log('[GameApp] Falling back to download');
            this.downloadGifWithInstructions(gifBlob, shareText);
            
        } catch (error) {
            console.error('[GameApp] Client-side GIF generation failed:', error);
            alert(`Failed to generate GIF for sharing: ${error.message}`);
        }

        /* SERVER-SIDE IMPLEMENTATION (kept for future reference):
        try {
            console.log('[GameApp] Generating server-side GIF for sharing...');
            
            // Call server-side GIF generation endpoint using ApiController
            const apiController = new ApiController();
            const response = await fetch(`${apiController.baseUrl}/generate_gif`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Get the GIF blob from server
            const gifBlob = await response.blob();
            
            // ... rest of sharing logic
            
        } catch (error) {
            console.error('[GameApp] Server-side GIF generation failed:', error);
            alert(`Failed to generate GIF for sharing: ${error.message}`);
        }
        */
    }

    downloadGifWithInstructions(gifBlob, shareText = null) {
        const url = URL.createObjectURL(gifBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '4-in-a-row-replay.gif';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        // Show helpful instructions for sharing
        this.showShareInstructions(shareText);
    }

    showShareInstructions(shareText = null) {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        let message = 'GIF downloaded! 📱\n\n';
        
        if (shareText) {
            message += 'Suggested message to copy:\n';
            message += `"${shareText}"\n\n`;
        }
        
        if (isMobile) {
            message += 'To share to WhatsApp:\n';
            message += '1. Open WhatsApp\n';
            message += '2. Tap the 📎 attachment button\n';
            message += '3. Select "Gallery"\n';
            message += '4. Find "4-in-a-row-game.gif"\n';
            message += '5. Send! 🎮';
        } else {
            message += 'To share to WhatsApp:\n';
            message += '1. Open WhatsApp Web\n';
            message += '2. Drag & drop the GIF file\n';
            message += '3. Or use the 📎 attachment button\n';
            message += '4. Select the downloaded GIF\n';
            message += '5. Send! 🎮';
        }
        
        alert(message);
    }

    async loadGifJs() {
        if (window.GIF) {
            return;
        }
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/vendor/gif.js';
            script.async = true;
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load gif.js'));
            };
            document.head.appendChild(script);
        });
    }

    async generateGifClientSide(payload) {
        await this.loadGifJs();

        const { gridSize, playerColors, history, winners, headerText = '', footerText = '' } = payload;
        // Balanced scaling: reduce output size while keeping clarity reasonable
        const scale = 0.75;
        const CELL = Math.max(10, Math.floor(60 * scale));
        const GAP = Math.max(1, Math.floor(5 * scale));
        const STONE = Math.max(8, Math.floor(50 * scale));
        const PAD = Math.max(4, Math.floor(10 * scale));
        const WIDTH = gridSize * CELL + (gridSize - 1) * GAP + 2 * PAD;
        const BOARD_HEIGHT = WIDTH;
        // Header and footer layout
        const HEADER_PAD = Math.max(8, Math.floor(16 * scale));
        const HEADER_LINE_HEIGHT = Math.max(12, Math.floor(24 * scale));
        const HEADER_HEIGHT = headerText ? (HEADER_PAD + HEADER_LINE_HEIGHT + HEADER_PAD) : HEADER_PAD;
        const FOOTER_PAD = Math.max(8, Math.floor(16 * scale));
        const FOOTER_LINE_HEIGHT = Math.max(12, Math.floor(24 * scale));
        const FOOTER_HEIGHT = footerText ? (FOOTER_PAD + FOOTER_LINE_HEIGHT + FOOTER_PAD) : FOOTER_PAD;
        const HEIGHT = HEADER_HEIGHT + BOARD_HEIGHT + FOOTER_HEIGHT;

        const canvas = document.createElement('canvas');
        // Render at device-1x to cut output dimensions and file size
        const pixelRatio = 1.0;
        canvas.width = Math.round(WIDTH * pixelRatio);
        canvas.height = Math.round(HEIGHT * pixelRatio);
        const ctx = canvas.getContext('2d');
        ctx.scale(pixelRatio, pixelRatio);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const gif = new window.GIF({
            workers: 3,
            // Higher numeric quality => more compression, smaller file
            quality: 12,
            workerScript: '/vendor/gif.worker.js',
            // Match encoder dimensions to actual canvas to avoid cropping
            width: canvas.width,
            height: canvas.height,
            repeat: 0, // loop forever
            dither: false,
        });

        const BG = '#f7f8fc';
        const GRID_FILL = '#e0e0e0';
        const GRID_STROKE = '#dcdcdc';
        const HEADER_BG = '#ffffff';
        const HEADER_COLOR = '#2c3e50';
        const FOOTER_BG = '#ffffff';
        const FOOTER_COLOR = '#2c3e50';

        const clear = () => {
            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        };

        const drawGrid = () => {
            ctx.fillStyle = GRID_FILL;
            ctx.strokeStyle = GRID_STROKE;
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    const x = PAD + c * (CELL + GAP);
                    const y = PAD + r * (CELL + GAP);
                    ctx.beginPath();
                    ctx.rect(x, y, CELL, CELL);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        };

        const drawBoard = (boardState) => {
            clear();
            drawHeader();
            // Draw board contents within translated context so y=0 is top of board area
            ctx.save();
            ctx.translate(0, HEADER_HEIGHT);
            drawGrid();
            if (boardState) {
                for (let r = 0; r < gridSize; r++) {
                    for (let c = 0; c < gridSize; c++) {
                        const cell = boardState[r][c];
                        if (!cell) continue;
                        const color = playerColors[cell.playerId] || '#000000';
                        const x = PAD + c * (CELL + GAP) + (CELL - STONE) / 2;
                        const y = PAD + r * (CELL + GAP) + (CELL - STONE) / 2;
                        ctx.beginPath();
                        ctx.fillStyle = color;
                        ctx.arc(x + STONE / 2, y + STONE / 2, STONE / 2, 0, Math.PI * 2);
                        ctx.fill();
                        // winner ring
                        if (winners && winners.length >= 4 && winners.includes(cell.id)) {
                            ctx.lineWidth = Math.max(2, Math.floor(5 * scale));
                            ctx.strokeStyle = '#00a000';
                            ctx.beginPath();
                            ctx.arc(x + STONE / 2, y + STONE / 2, STONE / 2 + 2, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    }
                }
            }
            ctx.restore();
            drawFooter();
        };

        const addFrame = (delayMs) => {
            gif.addFrame(ctx, { copy: true, delay: delayMs });
        };

        const drawHeader = () => {
            // Header background area
            ctx.fillStyle = HEADER_BG;
            ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
            if (headerText) {
                ctx.fillStyle = HEADER_COLOR;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                // Slightly larger, with offscreen supersampling from pixelRatio
                ctx.font = `${Math.max(16, Math.floor(24 * scale))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
                // Add subtle shadow to improve contrast on varied backgrounds
                ctx.shadowColor = 'rgba(0,0,0,0.08)';
                ctx.shadowBlur = 1;
                ctx.fillText(headerText, WIDTH / 2, HEADER_PAD);
                ctx.shadowBlur = 0;
            }
        };

        const drawFooter = () => {
            // Footer background area (below board)
            ctx.fillStyle = FOOTER_BG;
            ctx.fillRect(0, HEADER_HEIGHT + BOARD_HEIGHT, WIDTH, FOOTER_HEIGHT);
            if (footerText) {
                ctx.fillStyle = FOOTER_COLOR;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.font = `${Math.max(14, Math.floor(20 * scale))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
                ctx.fillText(footerText, WIDTH / 2, HEADER_HEIGHT + BOARD_HEIGHT + FOOTER_PAD);
            }
        };

        const drawDropAnimation = (prevBoard, row, col, playerId) => {
            const steps = 10, delay = 80;
            // Pre-draw background
            drawBoard(prevBoard);
            const color = playerColors[playerId] || '#000000';
            const startY = PAD + (0 * (CELL + GAP)) + (CELL - STONE) / 2 - (CELL + 2 * GAP);
            const endY = PAD + row * (CELL + GAP) + (CELL - STONE) / 2;
            const x = PAD + col * (CELL + GAP) + (CELL - STONE) / 2;
            for (let i = 0; i < steps; i++) {
                const t = (i + 1) / steps;
                const iy = Math.round(startY + (endY - startY) * t);
                drawBoard(prevBoard);
                ctx.save();
                ctx.translate(0, HEADER_HEIGHT);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x + STONE / 2, iy + STONE / 2, STONE / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                addFrame(delay);
            }
        };

        const drawRotationFrames = (prevBoard) => {
            const steps = 10, delay = 70;
            // draw prev to an image (includes header/footer)
            drawBoard(prevBoard);
            const baseImg = new Image();
            baseImg.src = canvas.toDataURL('image/png');
            return new Promise((resolve) => {
                baseImg.onload = () => {
                    for (let i = 0; i < steps; i++) {
                        const angle = -(Math.PI / 2) * ((i + 1) / steps); // CW 90deg to match game
                        clear();
                        drawHeader();
                        ctx.save();
                        ctx.translate(WIDTH / 2, HEADER_HEIGHT + BOARD_HEIGHT / 2);
                        ctx.rotate(angle);
                        // draw only the board portion from the source image into the rotated board area
                        ctx.drawImage(baseImg, 0, HEADER_HEIGHT, WIDTH, BOARD_HEIGHT, -WIDTH / 2, -BOARD_HEIGHT / 2, WIDTH, BOARD_HEIGHT);
                        ctx.restore();
                        // keep footer static below the board
                        drawFooter();
                        addFrame(delay);
                    }
                    resolve();
                };
            });
        };

        const drawGravityAnimation = (preRot, postRot) => {
            const steps = 10, delay = 80;
            // Build motions per column
            const motions = [];
            for (let c = 0; c < gridSize; c++) {
                const startRows = [];
                const endRows = [];
                for (let r = 0; r < gridSize; r++) if (preRot && preRot[r][c]) startRows.push({ playerId: preRot[r][c].playerId, row: r });
                for (let r = 0; r < gridSize; r++) if (postRot && postRot[r][c]) endRows.push({ playerId: postRot[r][c].playerId, row: r });
                const n = Math.min(startRows.length, endRows.length);
                for (let i = 0; i < n; i++) motions.push({ col: c, playerId: startRows[i].playerId, startRow: startRows[i].row, endRow: endRows[i].row });
            }

            // Prepare a background board equal to the post-rotation settled state
            // but with the moving stones removed so they are only drawn once.
            const baseBoard = postRot ? postRot.map(row => row.map(cell => (cell ? { ...cell } : null))) : null;
            motions.forEach(m => {
                if (baseBoard && baseBoard[m.endRow] && baseBoard[m.endRow][m.col]) {
                    baseBoard[m.endRow][m.col] = null;
                }
            });

            for (let s = 0; s < steps; s++) {
                const t = (s + 1) / steps;
                // Draw board without the moving stones, then overlay them at intermediate positions
                drawBoard(baseBoard);
                ctx.save();
                ctx.translate(0, HEADER_HEIGHT);
                motions.forEach(m => {
                    const x = PAD + m.col * (CELL + GAP) + (CELL - STONE) / 2;
                    const sy = PAD + m.startRow * (CELL + GAP) + (CELL - STONE) / 2;
                    const ey = PAD + m.endRow * (CELL + GAP) + (CELL - STONE) / 2;
                    const iy = Math.round(sy + (ey - sy) * t);
                    ctx.fillStyle = playerColors[m.playerId] || '#000000';
                    ctx.beginPath();
                    ctx.arc(x + STONE / 2, iy + STONE / 2, STONE / 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();
                addFrame(delay);
            }
        };

        // Build frames from history
        for (let i = 0; i < history.length; i++) {
            const step = history[i];
            if (step.moveType === 'move') {
                const prev = i > 0 ? history[i - 1].boardState : history[0].boardState;
                const row = step.lastMoveRow, col = step.lastMoveColumn;
                const player = step.player || 1;
                if (row != null && col != null) {
                    drawDropAnimation(prev, row, col, player);
                }
                drawBoard(step.boardState);
                addFrame(400);
            } else if (step.moveType === 'rotation') {
                const prev = i > 0 ? history[i - 1].boardState : step.preRotationBoardState;
                if (prev) await drawRotationFrames(prev);
                if (step.preRotationBoardState && step.boardState) {
                    drawGravityAnimation(step.preRotationBoardState, step.boardState);
                }
                drawBoard(step.boardState);
                addFrame(400);
            } else {
                drawBoard(step.boardState);
                addFrame(300);
            }
        }

        // Final hold with winners
        if (history.length) {
            drawBoard(history[history.length - 1].boardState);
            addFrame(800);
        }

        return new Promise((resolve, reject) => {
            gif.on('finished', (blob) => resolve(blob));
            gif.on('abort', () => reject(new Error('GIF encoding aborted')));
            gif.render();
        });
    }

    computeGifFooter() {
        const winner = this.gameController ? this.gameController.winner : null;
        if (winner === 1 || winner === 2) {
            if (this.currentMode === 'ai') {
                const humanId = this.aiGameHandler ? this.aiGameHandler.humanPlayerId : 1;
                return winner === humanId ? 'I won' : 'I lost';
            }
            if (this.currentMode && this.currentMode.startsWith('online')) {
                const myId = this.onlineGameHandler ? this.onlineGameHandler.playerId : null;
                if (myId) return winner === myId ? 'I won' : 'I lost';
                return winner === 1 ? 'White won' : 'Black won';
            }
            return winner === 1 ? 'White won' : 'Black won';
        }
        return 'Draw';
    }

    // Method to return to mode selection (useful for future "Return to Menu" functionality)
    returnToModeSelection() {
        // Increment generation ID to invalidate any ongoing GIF generation
        this.currentGifGenerationId++;
        console.log(`[GameApp] Switching to new game - invalidating GIF generation (new ID: ${this.currentGifGenerationId})`);
        
        // Analytics: end active session as quit
        this.endSession('quit');
        // Clean up current game
        if (this.inputHandler) {
            this.inputHandler.unbindInputEvents();
        }

        // Clear GIF display
        const centerDisplay = document.getElementById('top-center-display');
        if (centerDisplay) {
            centerDisplay.innerHTML = '';
        }

        // Hide game over buttons
        const topLeftActions = document.getElementById('top-left-actions');
        if (topLeftActions) {
            topLeftActions.classList.add('hidden');
        }

        // Show gameplay status
        const gameplayStatus = document.getElementById('gameplay-status');
        if (gameplayStatus) {
            gameplayStatus.style.display = 'flex';
        }

        // Reset state
        this.gameController = null;
        this.localGameHandler = null;
        this.aiGameHandler = null;
        this.onlineGameHandler = null;
        this.inputHandler = null;
        this.currentMode = null;
        this.isGeneratingGif = false;

        // Show mode selection
        this.showModeSelection();
    }

    beginSession(sessionIdOverride = null) {
        try {
            // Ensure a module session exists for future events
            Analytics.startSession();
            this.analyticsSessionId = sessionIdOverride || this.analyticsSessionId || `session_${Date.now()}`;
            this.analyticsSessionStartMs = Date.now();
            Analytics.maybeTrackDailyReturn();
            Analytics.trackEvent('game_start', {
                session_id: this.analyticsSessionId,
            });
        } catch (e) {
            console.warn('[Analytics] Failed to start session', e);
        }
    }

    endSession(reason = 'quit') {
        try {
            if (!this.analyticsSessionId) return;
            const durationSeconds = this.analyticsSessionStartMs ? Math.round((Date.now() - this.analyticsSessionStartMs) / 1000) : null;
            Analytics.trackEvent('game_end', {
                session_id: this.analyticsSessionId,
                duration_seconds: durationSeconds,
                reason,
            });
            Analytics.endSession();
        } catch (e) {
            console.warn('[Analytics] Failed to end session', e);
        } finally {
            this.analyticsSessionId = null;
            this.analyticsSessionStartMs = null;
        }
    }

    // === LOG MANAGEMENT FUNCTIONALITY ===

    updateLogStats() {
        const logStatsElement = document.getElementById('log-stats');
        if (!logStatsElement) return;

        const stats = logBuffer.getStats();
        const logText = `Logs: ${stats.totalEntries}/${stats.maxSize} entries
Buffer: ${stats.bufferFull ? 'Full' : 'Growing'}`;
        
        logStatsElement.textContent = logText;
    }

    async copyLogsToClipboard() {
        const copyButton = document.getElementById('copy-logs-btn');
        if (!copyButton) return;

        // Update button state to show copying
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copying...';
        copyButton.classList.add('copying');
        copyButton.disabled = true;

        try {
            const result = await logBuffer.copyLogsToClipboard();
            
            if (result.success) {
                copyButton.textContent = 'Copied!';
                console.log(`[Settings] Logs copied to clipboard using ${result.method}`);
                
                // Reset button after short delay
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.classList.remove('copying');
                    copyButton.disabled = false;
                }, 1500);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            copyButton.textContent = 'Failed';
            copyButton.classList.remove('copying');
            console.error('[Settings] Failed to copy logs:', error);
            
            // Reset button after delay
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.disabled = false;
            }, 2000);
        }
    }

    clearLogs() {
        const clearButton = document.getElementById('clear-logs-btn');
        if (!clearButton) return;

        // Update button state
        const originalText = clearButton.textContent;
        clearButton.textContent = 'Cleared';
        clearButton.disabled = true;

        // Clear the logs
        logBuffer.clearLogs();
        console.log('[Settings] Log buffer cleared');

        // Update stats display
        this.updateLogStats();

        // Reset button after short delay
        setTimeout(() => {
            clearButton.textContent = originalText;
            clearButton.disabled = false;
        }, 1000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const gameApp = new GameApp();
    // Make GameApp accessible globally for handlers
    window.gameApp = gameApp;
});


