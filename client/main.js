import './src/styles.css';
import { createWelcomeScreen } from './src/welcomeScreen.js';
import { initWorld } from './src/isometricWorld.js';
import './src/resourceDisplay.js';
import './src/audioPlayer.js';

// Check if user is logged in
const userId = localStorage.getItem('userId');

if (userId) {
  // User is logged in, show welcome screen
  createWelcomeScreen();
} else {
  // User is not logged in, show auth screen
  import('./src/authScreen.js').then(module => {
    const { createAuthScreen } = module;
    createAuthScreen();
  });
}
