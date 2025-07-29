// TODO: Update this URL to your actual deployed server URL
// Example: 'https://us-central1-your-project.cloudfunctions.net/game-api'
// Leave as-is to see configuration instructions when testing
const SERVER_BASE_URL = 'https://game-api-ld4c7ubata-ew.a.run.app';


export class ApiController {
    constructor() {
        this.baseUrl = SERVER_BASE_URL;
        this.defaultTimeout = 10000; // 10 seconds
    }

    // === UTILITY METHODS ===

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - please check your connection');
            }
            
            throw error;
        }
    }

    // === SESSION MANAGEMENT ===

    async createSession(rotationFrequency) {
        console.log(`[ApiController] Creating new session with frequency: ${rotationFrequency}...`);
        
        try {
            const result = await this.makeRequest('/session/create', {
                method: 'POST',
                body: JSON.stringify({ rotationFrequency })
            });
            
            console.log('[ApiController] Session created:', result);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Failed to create session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async joinSession(sessionId) {
        console.log('[ApiController] Joining session:', sessionId);
        
        try {
            const result = await this.makeRequest('/session/join', {
                method: 'POST',
                body: JSON.stringify({ sessionId })
            });
            
            console.log('[ApiController] Joined session:', result);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Failed to join session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getSessionState(sessionId) {
        console.log('[ApiController] Getting session state:', sessionId);
        
        try {
            const result = await this.makeRequest(`/session/${sessionId}`, {
                method: 'GET'
            });
            
            console.log('[ApiController] Session state response:', result);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Failed to get session state:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // === MOVE MANAGEMENT ===

    async submitMove(sessionId, playerId, column) {
        console.log('[ApiController] Submitting move:', { sessionId, playerId, column });
        
        try {
            const result = await this.makeRequest('/move', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId,
                    playerId,
                    column
                })
            });
            
            console.log('[ApiController] Move submitted:', result);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Failed to submit move:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getNewMoves(sessionId, sinceMove = 0) {
        try {
            const result = await this.makeRequest(`/moves/${sessionId}?since=${sinceMove}`, {
                method: 'GET'
            });
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Failed to get moves:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // === HEALTH CHECK ===

    async healthCheck() {
        console.log('[ApiController] Performing health check...');
        
        try {
            const result = await this.makeRequest('/health', {
                method: 'GET'
            });
            
            console.log('[ApiController] Health check passed:', result);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[ApiController] Health check failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // === UTILITY METHODS ===

    generateGuestLink(sessionId) {
        const currentUrl = new URL(window.location);
        currentUrl.searchParams.set('sessionId', sessionId);
        currentUrl.searchParams.set('role', 'guest');
        return currentUrl.toString();
    }

    generateHostLink(sessionId) {
        const currentUrl = new URL(window.location);
        currentUrl.searchParams.set('sessionId', sessionId);
        currentUrl.searchParams.set('role', 'host');
        return currentUrl.toString();
    }

    isServerConfigured() {
        return this.baseUrl !== 'https://your-cloud-function-url-here';
    }
} 