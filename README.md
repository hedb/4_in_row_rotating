# Four-in-a-Row with a Twist: The Rotating Grid

This project is a modern, web-based implementation of the classic "Four-in-a-Row" game, designed for two players. It features a clean, professional user interface and a challenging twist: the entire 6x6 grid rotates 90 degrees counter-clockwise, forcing players to constantly adapt their strategies.

## Key Features

-   **Dynamic Gameplay:** Connect four of your stones horizontally, vertically, or diagonally to win.
-   **Turn-Based Grid Rotation:** The 6x6 grid rotates after a configurable number of player turns (defaulting to 4). After rotation, gravity is reapplied, and stones fall to their new lowest positions.
-   **Polished & Animated UI:** The game features a responsive interface with smooth, physics-based animations for a satisfying user experience.
-   **Configurable Settings:** A slide-out settings pane allows players to adjust the rotation frequency and manage the game (rotate/reset).

## Technical Details

### Modular Architecture

The application is built using a clean, object-oriented structure that separates concerns for maintainability and scalability:

-   `GameController.js`: Manages the overall game state, player turns, and the main game loop. It orchestrates interactions between the other modules.
-   `Board.js`: Contains the core game logic. It manages the grid data structure (a 2D array), handles stone placement, checks for win conditions, and implements the rotation and gravity logic.
-   `BoardRenderer.js`: Responsible for all DOM rendering and animations. It draws the board and stones and handles all visual updates.
-   `InputHandler.js`: Captures and processes user input (mouse clicks).
-   `config.js`: Stores configurable constants like grid size and colors.

### Animations & Transitions

A key focus of this project was creating a robust and visually appealing animation system.

-   **Bouncy Grid Rotation:** The grid rotation uses a custom CSS `transition` with a `cubic-bezier(0.68, -0.55, 0.27, 1.55)` timing function. This creates a delightful "bouncy" effect where the grid appears to wind up by rotating slightly backward before snapping into its final position with a slight overshoot.
-   **Decoupled Animation Logic:** The JavaScript animation code in `BoardRenderer.js` is carefully decoupled from the CSS. It listens for the `transitionend` event specifically on the `#grid-wrapper` element, ignoring other transition events (e.g., from cell hovers). This ensures that changes to the CSS animations or transitions will not break the game's event-driven logic, a problem that was solved during development.

## How to Run Locally

Because this project uses ES6 modules, it must be run from a local server to avoid browser CORS errors.

1.  Navigate to the project directory in your terminal.
2.  Start a simple local server. If you have Python 3, you can use:
    ```bash
    python3 -m http.server
    ```
3.  Open your web browser and go to `http://localhost:8000`.

This project is a single-page application built with vanilla JavaScript (ES6 Modules), HTML, and CSS.