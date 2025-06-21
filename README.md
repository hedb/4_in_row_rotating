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

-   **Offline First:** The service worker caches the entire application shell (HTML, CSS, JS) upon installation, allowing the game to be launched and played without an internet connection.
-   **Version-Based Cache Busting:** To ensure users always have the latest version of the game logic, the app uses a versioning system. The version is managed in `config.js`. When the version is incremented, the service worker automatically:
    1.  Creates a new, version-specific cache.
    2.  Downloads all new JavaScript files, using the version number as a cache-busting query parameter (e.g., `index.js?v=0.2.0`).
    3.  Deletes the old cache, ensuring a clean and immediate update for all users on the next page load.

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