# Four-in-a-Row with a Twist: The Rotating Grid

This project is a modern, web-based implementation of the classic "Four-in-a-Row" game, designed for two players. It features a clean, professional user interface and a challenging twist: the entire 6x6 grid rotates 90 degrees counter-clockwise, forcing players to constantly adapt their strategies. It is also a fully offline-capable Progressive Web App (PWA).

## Key Features

-   **Progressive Web App:** Installable on mobile and desktop devices for an app-like experience and offline availability.
-   **Dynamic Gameplay:** Connect four of your stones horizontally, vertically, or diagonally to win.
-   **Turn-Based Grid Rotation:** The 6x6 grid rotates after a configurable number of player turns.
-   **Polished & Animated UI:** The game features a responsive interface with smooth, physics-based animations.
-   **Configurable Settings:** A slide-out settings pane allows players to adjust the rotation frequency, manage the game, and view the current app version.

## Technical Details

### Modular Architecture

The application is built using a clean, object-oriented structure that separates concerns: `GameController.js`, `Board.js`, `BoardRenderer.js`, `InputHandler.js`, and `config.js`.

### PWA & Service Worker

The game is a PWA with offline capabilities, powered by a service worker (`sw.js`).

-   **Offline First:** The service worker caches the entire application shell (HTML, CSS, JS, manifest, icons) upon installation, allowing the game to be launched and played without an internet connection.
-   **Robust Cache Versioning:** To ensure users always receive the latest version, the app uses a specific, manual versioning strategy that provides explicit control over updates.
    1.  **Dual Versioning:** The version number must be updated in two places:
        -   `config.js`: This `VERSION` constant is used by the application to display the version in the UI.
        -   `sw.js`: This `VERSION` constant is used to name the cache (e.g., `4-in-a-row-v0.6.0`).
    2.  **Update Trigger:** The browser only installs a new service worker if the `sw.js` file itself changes. Therefore, **incrementing the version in `sw.js` is the essential trigger for the entire update process.**
    3.  **Clean Installation:** The new service worker fetches fresh copies of all app files and stores them in a new, version-named cache.
    4.  **Atomic Swap:** On activation, the new service worker deletes the entire old cache, ensuring that stale files are never served.
-   **Intelligent Fetch Handling:**
    -   The service worker dynamically injects the version number as a query parameter into the CSS and JS links in `index.html` (e.g., `index.js?v=0.6.0`). This ensures the browser requests the new files after an update.
    -   For all requests, the fetch handler uses `caches.match(event.request, { ignoreSearch: true })`. This powerful option allows it to serve the correct cached file by ignoring the query string, seamlessly handling both versioned requests from the HTML and clean URL requests from ES6 module imports.

### Animations & Transitions

-   **Bouncy Grid Rotation:** The grid rotation uses a custom CSS `transition` with a `cubic-bezier` timing function to create a delightful "bouncy" effect.
-   **Robust Rendering:** To prevent rendering glitches on mobile devices, the grid wrapper uses `will-change: transform`, `backface-visibility: hidden`, and `transform: translateZ(0)` to promote the animation to its own compositing layer and ensure smooth performance.
-   **Decoupled Animation Logic:** The JavaScript animation code is carefully decoupled from the CSS, listening for `transitionend` events only on the specific element being animated.

## How to Run Locally

Because this project uses ES6 modules and a service worker, it must be run from a local server.

1.  Navigate to the project directory in your terminal.
2.  Start a simple local server. If you have Python 3:
    ```bash
    python3 -m http.server
    ```
3.  Open your web browser and go to `http://localhost:8000`.
4.  Use your browser's developer tools (e.g., the "Application" tab in Chrome) to inspect the service worker and test PWA functionality.

This project is a single-page application built with vanilla JavaScript (ES6 Modules), HTML, and CSS.