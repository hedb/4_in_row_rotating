/**
 * HapticFeedback utility class for providing tactile feedback in PWAs
 * Supports Android Chrome via Vibration API, gracefully degrades on iOS Safari
 */
export class HapticFeedback {
    static isSupported() {
        const supported = 'vibrate' in navigator && typeof navigator.vibrate === 'function';
        console.log('[HapticFeedback] Support check:', { supported, userAgent: navigator.userAgent });
        return supported;
    }

    /**
     * Light tap feedback for subtle interactions
     * Used for: Stone placement, button hover, menu navigation
     */
    static light() {
        if (this.isSupported()) {
            console.log('[HapticFeedback] Light vibration (50ms)');
            navigator.vibrate(50);
        }
    }

    /**
     * Medium feedback for important actions
     * Used for: Grid rotation, successful moves, menu selections
     */
    static medium() {
        if (this.isSupported()) {
            navigator.vibrate(100);
        }
    }

    /**
     * Strong feedback for significant events
     * Used for: Game start, major state changes
     */
    static strong() {
        if (this.isSupported()) {
            navigator.vibrate(200);
        }
    }

    /**
     * Success pattern for positive outcomes
     * Used for: Winning the game, successful connections
     */
    static success() {
        if (this.isSupported()) {
            navigator.vibrate([100, 50, 100, 50, 150]);
        }
    }

    /**
     * Error pattern for invalid actions
     * Used for: Invalid moves, occupied cells, full columns
     */
    static error() {
        if (this.isSupported()) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    /**
     * Draw pattern for neutral outcomes
     * Used for: Game draws, ties
     */
    static draw() {
        if (this.isSupported()) {
            navigator.vibrate([150, 100, 150, 100, 150]);
        }
    }

    /**
     * Rotation pattern for grid rotation
     * Used for: When the grid rotates
     */
    static rotation() {
        if (this.isSupported()) {
            navigator.vibrate([80, 40, 80, 40, 80, 40, 120]);
        }
    }

    /**
     * Button press feedback for UI interactions
     * Used for: Button presses, toggle switches
     */
    static buttonPress() {
        if (this.isSupported()) {
            navigator.vibrate(30);
        }
    }

    /**
     * Cancel any ongoing vibration
     */
    static cancel() {
        if (this.isSupported()) {
            navigator.vibrate(0);
        }
    }

    /**
     * Get support status information for debugging
     */
    static getInfo() {
        return {
            supported: this.isSupported(),
            userAgent: navigator.userAgent,
            platform: navigator.platform || 'unknown'
        };
    }
}
