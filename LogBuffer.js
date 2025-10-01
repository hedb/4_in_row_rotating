/**
 * Check if debug mode is enabled via URL parameter
 */
function isDebugModeEnabled() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'true';
}

/**
 * LogBuffer - A circular buffer to store the latest log messages
 * Stores the latest 100 log messages for debugging on mobile devices
 */
export class LogBuffer {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.buffer = [];
        this.currentIndex = 0;
        
        // Store original console methods
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console),
            info: console.info.bind(console)
        };
        
        // Override console methods to capture logs
        this.interceptConsole();
    }
    
    /**
     * Add a log entry to the buffer
     */
    addLogEntry(level, timestamp, args) {
        const logEntry = {
            level,
            timestamp,
            message: this.formatArgs(args),
            rawArgs: args
        };
        
        // If buffer is full, overwrite oldest entry
        if (this.buffer.length >= this.maxSize) {
            this.buffer[this.currentIndex] = logEntry;
            this.currentIndex = (this.currentIndex + 1) % this.maxSize;
        } else {
            this.buffer.push(logEntry);
        }
    }
    
    /**
     * Format console arguments into a readable string
     */
    formatArgs(args) {
        return Array.from(args).map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }
    
    /**
     * Intercept console methods to capture logs
     */
    interceptConsole() {
        const levels = ['log', 'warn', 'error', 'debug', 'info'];
        
        levels.forEach(level => {
            console[level] = (...args) => {
                // Only call original console method if debug mode is enabled
                if (isDebugModeEnabled()) {
                    this.originalConsole[level](...args);
                }
                
                // Always add to our buffer (regardless of debug mode)
                this.addLogEntry(level, new Date().toISOString(), args);
            };
        });
    }
    
    /**
     * Get all logs in chronological order (oldest first)
     */
    getAllLogs() {
        if (this.buffer.length < this.maxSize) {
            // Buffer not full yet, return in order
            return [...this.buffer];
        } else {
            // Buffer is full, need to reorganize to get chronological order
            const olderLogs = this.buffer.slice(this.currentIndex);
            const newerLogs = this.buffer.slice(0, this.currentIndex);
            return [...olderLogs, ...newerLogs];
        }
    }
    
    /**
     * Get logs formatted as text for copying
     */
    getLogsAsText() {
        const logs = this.getAllLogs();
        return logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const levelPrefix = `[${log.level.toUpperCase()}]`;
            return `${timestamp} ${levelPrefix} ${log.message}`;
        }).join('\n');
    }
    
    /**
     * Clear all logs from the buffer
     */
    clearLogs() {
        this.buffer = [];
        this.currentIndex = 0;
    }
    
    /**
     * Get current buffer statistics
     */
    getStats() {
        return {
            totalEntries: this.buffer.length,
            maxSize: this.maxSize,
            bufferFull: this.buffer.length >= this.maxSize
        };
    }
    
    /**
     * Copy logs to clipboard
     */
    async copyLogsToClipboard() {
        const logsText = this.getLogsAsText();
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(logsText);
                return { success: true, method: 'clipboard-api' };
            } else {
                // Fallback for older browsers or non-secure contexts
                return this.fallbackCopyToClipboard(logsText);
            }
        } catch (error) {
            console.error('Failed to copy logs to clipboard:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Fallback method to copy text to clipboard
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                return { success: true, method: 'execCommand' };
            } else {
                return { success: false, error: 'execCommand failed' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create and export a singleton instance
export const logBuffer = new LogBuffer();