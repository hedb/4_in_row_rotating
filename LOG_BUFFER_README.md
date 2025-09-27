# Log Buffer System

This project now includes a sophisticated log buffer system to help with debugging on mobile devices where console logs are difficult to access.

## Features

### Circular Buffer
- Stores the latest **100 log messages** in a circular buffer
- Automatically overwrites oldest logs when buffer is full
- Captures all console log levels: `log`, `warn`, `error`, `debug`, `info`

### Settings Modal Integration
- Access via clicking "Grid" in the title (easter egg)
- Shows current log statistics
- Two control buttons:
  - **Copy Logs**: Copies all buffered logs to clipboard
  - **Clear**: Clears the log buffer

### Log Format
When copied, logs are formatted as:
```
2025-09-27 10:30:15 [LOG] [Main App] Loaded with VERSION: 0.11.0
2025-09-27 10:30:15 [WARN] [LogBuffer] This is a warning message
2025-09-27 10:30:15 [ERROR] [LogBuffer] This is an error message for testing
```

### Clipboard Support
- **Modern browsers**: Uses Clipboard API (`navigator.clipboard`)
- **Fallback**: Uses `document.execCommand('copy')` for older browsers
- **Secure contexts**: Works in HTTPS and localhost environments
- **Non-secure contexts**: Falls back to manual selection method

## Technical Implementation

### Files Modified
- `LogBuffer.js` - New file containing the circular buffer implementation
- `index.js` - Integrated log buffer import and UI handlers
- `index.html` - Added log controls to settings modal
- `styles.css` - Added styling for log control buttons

### Buffer Statistics
The system tracks:
- Current number of entries
- Maximum buffer size (100)
- Whether buffer is full or still growing

### Error Handling
- Graceful fallback for clipboard access failures
- Visual feedback on button states (Copying..., Copied!, Failed)
- Console logging of copy operations for debugging

## Usage for Debugging

1. **Access Settings**: Click "Grid" in the game title
2. **Check Stats**: See current log count and buffer status
3. **Copy Logs**: Click "Copy Logs" to copy to clipboard
4. **Share/Analyze**: Paste logs into email, chat, or analysis tool
5. **Clear Buffer**: Click "Clear" to reset the buffer if needed

## Mobile Testing Benefits

- **No Developer Tools**: Access logs without mobile dev tools
- **Persistent Storage**: Logs survive page refreshes until cleared
- **Offline Capable**: Works in PWA offline mode
- **Easy Sharing**: Copy/paste logs for remote debugging
- **Circular Buffer**: Prevents memory issues with long sessions

This system is particularly valuable for debugging issues that only occur on mobile devices or in production environments where traditional debugging tools are not available.