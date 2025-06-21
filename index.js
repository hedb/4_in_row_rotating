import { GameController } from './GameController.js';

const gameController = new GameController();
gameController.startGame();

const settingsIcon = document.getElementById('settings-icon');
const settingsPane = document.getElementById('settings-pane');
const closeSettingsButton = document.getElementById('close-settings');
const overlay = document.getElementById('overlay');
const rotationFrequencySelect = document.getElementById('rotationFrequency');

function toggleSettingsPane() {
    settingsPane.classList.toggle('hidden');
    overlay.classList.toggle('hidden');
}

settingsIcon.addEventListener('click', toggleSettingsPane);
closeSettingsButton.addEventListener('click', toggleSettingsPane);
overlay.addEventListener('click', toggleSettingsPane);

rotationFrequencySelect.addEventListener('change', (event) => {
    const newFrequency = parseInt(event.target.value, 10);
    gameController.rotationFrequency = newFrequency;
    gameController.update_countdown_func(newFrequency - (gameController.turnCounter % newFrequency));
});


