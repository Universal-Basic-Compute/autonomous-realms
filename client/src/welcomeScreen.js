import { initWorld } from './isometricWorld.js';

// Function to check if Phantom wallet is installed
function getProvider() {
  if ('phantom' in window) {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) {
      return provider;
    }
  }
  return null;
}

// Function to connect to Phantom wallet
async function connectWallet() {
  try {
    const provider = getProvider();
    if (!provider) {
      // Phantom wallet not found
      const notification = document.createElement('div');
      notification.className = 'notification error-notification';
      notification.textContent = 'Phantom wallet not found. Please install it first.';
      document.body.appendChild(notification);
      
      // Remove notification after a delay
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 1000);
      }, 5000);
      
      // Open Phantom website in a new tab
      window.open('https://phantom.app/', '_blank');
      return null;
    }
    
    // Connect to wallet
    console.log('Attempting to connect to Phantom wallet...');
    const resp = await provider.connect();
    const walletAddress = resp.publicKey.toString();
    
    console.log('Wallet connected successfully:', walletAddress);
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = `Wallet connected: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 3000);
    
    // Update the wallet button text
    updateWalletButtonText(walletAddress);
    
    // Store wallet address in localStorage
    localStorage.setItem('walletAddress', walletAddress);
    
    // Show compute transfer dialog with a slight delay to ensure UI is updated
    console.log('Preparing to show COMPUTE transfer dialog...');
    setTimeout(() => {
      console.log('Showing COMPUTE transfer dialog now');
      showComputeTransferDialog(walletAddress);
    }, 800); // Increased delay to ensure UI is ready
    
    return walletAddress;
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    
    // Show error notification
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.textContent = `Error connecting to wallet: ${error.message}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 5000);
    
    return null;
  }
}

// Add a new function to update the wallet button text
function updateWalletButtonText(walletAddress) {
  console.log('Updating wallet button text for address:', walletAddress);
  
  // Find all wallet buttons in the DOM (in case there are multiple screens)
  const walletButtons = document.querySelectorAll('.welcome-button');
  
  walletButtons.forEach(button => {
    if (button.textContent === 'Connect Wallet') {
      console.log('Found wallet button to update');
      button.textContent = `Wallet: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
      
      // Update the click handler to show the transfer dialog instead of connecting again
      button.removeEventListener('click', connectWalletHandler);
      button.addEventListener('click', () => {
        console.log('Wallet button clicked, showing transfer dialog');
        showComputeTransferDialog(walletAddress);
      });
    }
  });
}

// Extract the wallet button click handler to a named function so we can remove it later
function connectWalletHandler() {
  connectWallet().then(walletAddress => {
    if (walletAddress) {
      // The rest of the handler is now in the connectWallet function
    }
  });
}

// Function to transfer $COMPUTE tokens
async function transferCompute(amount, walletAddress) {
  try {
    if (!amount || isNaN(amount) || amount < 100000) {
      throw new Error('Please enter a valid amount (minimum 100,000)');
    }
    
    const provider = getProvider();
    if (!provider) {
      throw new Error('Phantom wallet not connected');
    }
    
    // Create a transaction to transfer tokens
    const destinationWallet = 'GcWA4LwbGyoryPvauWkuVadi69FcEaWMmLxu4rxg7hVk';
    const tokenMint = 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'; // $COMPUTE token mint address
    
    // Show loading notification
    const loadingNotification = document.createElement('div');
    loadingNotification.className = 'notification';
    loadingNotification.textContent = `Transferring ${amount} $COMPUTE...`;
    document.body.appendChild(loadingNotification);
    
    // In a real implementation, we would create and send the transaction here
    // For now, we'll simulate a successful transfer
    
    // Remove loading notification
    setTimeout(() => {
      loadingNotification.remove();
      
      // Show success notification
      const successNotification = document.createElement('div');
      successNotification.className = 'notification';
      successNotification.textContent = `Successfully transferred ${amount} $COMPUTE to the game wallet!`;
      document.body.appendChild(successNotification);
      
      // Remove notification after a delay
      setTimeout(() => {
        successNotification.classList.add('fade-out');
        setTimeout(() => successNotification.remove(), 1000);
      }, 5000);
      
      // Update the user's compute balance in Airtable
      updateUserCompute(walletAddress, amount);
    }, 2000);
    
    return true;
  } catch (error) {
    console.error('Error transferring $COMPUTE:', error);
    
    // Show error notification
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.textContent = `Error transferring $COMPUTE: ${error.message}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 5000);
    
    return false;
  }
}

// Function to update user's compute balance in Airtable
async function updateUserCompute(walletAddress, amount) {
  try {
    // Get the user ID from localStorage
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn('No user ID found, cannot update compute balance');
      return;
    }
    
    // Make API request to update the user's compute balance
    const response = await fetch('http://localhost:3000/api/auth/update-compute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        walletAddress,
        computeAmount: amount
      })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update compute balance');
    }
    
    // Store wallet address in localStorage
    localStorage.setItem('walletAddress', walletAddress);
    localStorage.setItem('computeBalance', amount);
    
    console.log('Successfully updated compute balance in Airtable');
  } catch (error) {
    console.error('Error updating compute balance:', error);
  }
}

// Helper function to validate and format audio URLs
function getValidAudioUrl(url) {
  if (!url) return null;
  
  // Add server URL prefix if the path is relative
  if (url.startsWith('/')) {
    return `http://localhost:3000${url}`;
  }
  
  // Check if URL is valid
  try {
    new URL(url);
    return url;
  } catch (e) {
    console.warn('Invalid audio URL:', url);
    return null;
  }
}

// Create a welcome screen with menu options
function createWelcomeScreen() {
  // Create container
  const welcomeContainer = document.createElement('div');
  welcomeContainer.id = 'welcome-screen';
  welcomeContainer.className = 'fullscreen-overlay';
  
  // Add title
  const title = document.createElement('h1');
  title.textContent = 'Autonomous Realms';
  title.className = 'welcome-title';
  welcomeContainer.appendChild(title);
  
  // Add subtitle
  const subtitle = document.createElement('h2');
  subtitle.textContent = 'An AI-powered settlement simulation';
  subtitle.className = 'welcome-subtitle';
  welcomeContainer.appendChild(subtitle);
  
  // Add description about the tribe
  const tribeDescription = document.createElement('p');
  tribeDescription.className = 'tribe-description';
  tribeDescription.innerHTML = 'You lead a small tribe of 20 settlers armed only with stones and sticks, ready to start an adventure that will traverse millennia. Together, you will build a civilization from the ground up.';
  welcomeContainer.appendChild(tribeDescription);
  
  // Create menu container
  const menuContainer = document.createElement('div');
  menuContainer.className = 'welcome-menu';
  
  // Add start new colony button
  const startButton = document.createElement('button');
  startButton.textContent = 'Start New Colony';
  startButton.className = 'welcome-button';
  startButton.addEventListener('click', () => {
    welcomeContainer.remove();
    createColonyNamingScreen();
  });
  menuContainer.appendChild(startButton);
  
  // Add continue button
  const continueButton = document.createElement('button');
  continueButton.textContent = 'Continue';
  continueButton.className = 'welcome-button';
  
  // Check if there's a saved colony to continue
  const hasExistingColony = localStorage.getItem('languageInitialized') === 'true';
  
  if (!hasExistingColony) {
    continueButton.disabled = true;
    continueButton.title = 'No saved colony found';
  } else {
    continueButton.addEventListener('click', () => {
      welcomeContainer.remove();
      initWorld();
    });
  }
  menuContainer.appendChild(continueButton);
  
  // Add load colony button
  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load Colony';
  loadButton.className = 'welcome-button';

  // Check if there are any saved colonies
  const hasColonies = getSavedColonies().length > 0;
  if (!hasColonies) {
    loadButton.disabled = true;
    loadButton.title = 'No saved colonies found';
  } else {
    loadButton.addEventListener('click', () => {
      welcomeContainer.remove();
      createLoadColonyScreen();
    });
  }
  menuContainer.appendChild(loadButton);
  
  // Add wallet button
  const walletButton = document.createElement('button');
  walletButton.textContent = 'Connect Wallet';
  walletButton.className = 'welcome-button';
  walletButton.addEventListener('click', connectWalletHandler);
  menuContainer.appendChild(walletButton);
  
  // Check if wallet is already connected and update button accordingly
  const savedWalletAddress = localStorage.getItem('walletAddress');
  if (savedWalletAddress) {
    updateWalletButtonText(savedWalletAddress);
  }
  
  // Add settings button (disabled for now)
  const settingsButton = document.createElement('button');
  settingsButton.textContent = 'Settings';
  settingsButton.className = 'welcome-button';
  settingsButton.disabled = true;
  menuContainer.appendChild(settingsButton);
  
  // Add logout button
  const logoutButton = document.createElement('button');
  logoutButton.textContent = 'Logout';
  logoutButton.className = 'welcome-button';
  logoutButton.addEventListener('click', () => {
    // Clear user authentication data
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    
    // Remove the welcome screen
    welcomeContainer.remove();
    
    // Show the auth screen
    import('./authScreen.js').then(module => {
      const { createAuthScreen } = module;
      createAuthScreen();
    });
  });
  menuContainer.appendChild(logoutButton);
  
  welcomeContainer.appendChild(menuContainer);
  
  // Add version info
  const versionInfo = document.createElement('div');
  versionInfo.className = 'version-info';
  versionInfo.textContent = 'Version 0.1.0';
  welcomeContainer.appendChild(versionInfo);
  
  document.body.appendChild(welcomeContainer);
}


// Create a screen for naming the colony
function createColonyNamingScreen() {
  // Create container
  const namingContainer = document.createElement('div');
  namingContainer.id = 'naming-screen';
  namingContainer.className = 'fullscreen-overlay';
  
  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Name Your Colony';
  title.className = 'naming-title';
  namingContainer.appendChild(title);
  
  // Create form
  const form = document.createElement('div');
  form.className = 'naming-form';
  
  // Leader name field
  const leaderLabel = document.createElement('label');
  leaderLabel.textContent = 'Your Name:';
  leaderLabel.htmlFor = 'leader-name';
  form.appendChild(leaderLabel);
  
  const leaderInput = document.createElement('input');
  leaderInput.type = 'text';
  leaderInput.id = 'leader-name';
  leaderInput.placeholder = 'Enter your name';
  form.appendChild(leaderInput);
  
  // Leader name dice button
  const leaderDiceButton = document.createElement('button');
  leaderDiceButton.textContent = '🎲';
  leaderDiceButton.className = 'dice-button';
  leaderDiceButton.title = 'Generate random name';
  leaderDiceButton.addEventListener('click', () => {
    leaderInput.value = generateRandomName('leader');
  });
  form.appendChild(leaderDiceButton);
  
  // Colony name field
  const colonyLabel = document.createElement('label');
  colonyLabel.textContent = 'Colony Name:';
  colonyLabel.htmlFor = 'colony-name';
  form.appendChild(colonyLabel);
  
  const colonyInput = document.createElement('input');
  colonyInput.type = 'text';
  colonyInput.id = 'colony-name';
  colonyInput.placeholder = 'Enter colony name';
  form.appendChild(colonyInput);
  
  // Colony name dice button
  const colonyDiceButton = document.createElement('button');
  colonyDiceButton.textContent = '🎲';
  colonyDiceButton.className = 'dice-button';
  colonyDiceButton.title = 'Generate random name';
  colonyDiceButton.addEventListener('click', () => {
    colonyInput.value = generateRandomName('colony');
  });
  form.appendChild(colonyDiceButton);
  
  // Dream for civilization field
  const dreamLabel = document.createElement('label');
  dreamLabel.textContent = 'Dream for your civilization:';
  dreamLabel.htmlFor = 'civilization-dream';
  form.appendChild(dreamLabel);

  const dreamInput = document.createElement('textarea');
  dreamInput.id = 'civilization-dream';
  dreamInput.placeholder = 'What is your long-term vision for your people?';
  dreamInput.rows = 3;
  form.appendChild(dreamInput);

  // Empty cell for grid alignment
  const emptyCell = document.createElement('div');
  form.appendChild(emptyCell);

  // Tribe appearance field
  const appearanceLabel = document.createElement('label');
  appearanceLabel.textContent = 'Tribe appearance:';
  appearanceLabel.htmlFor = 'tribe-appearance';
  form.appendChild(appearanceLabel);

  const appearanceInput = document.createElement('textarea');
  appearanceInput.id = 'tribe-appearance';
  appearanceInput.placeholder = 'What do you and your tribespeople look like?';
  appearanceInput.rows = 3;
  form.appendChild(appearanceInput);

  // Empty cell for grid alignment
  const emptyCell2 = document.createElement('div');
  form.appendChild(emptyCell2);
  
  namingContainer.appendChild(form);
  
  // Add buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  
  // Back button
  const backButton = document.createElement('button');
  backButton.textContent = 'Back';
  backButton.className = 'secondary-button';
  backButton.addEventListener('click', () => {
    namingContainer.remove();
    createWelcomeScreen();
  });
  buttonContainer.appendChild(backButton);
  
  // Start button
  const startButton = document.createElement('button');
  startButton.textContent = 'Begin Settlement';
  startButton.className = 'primary-button';
  startButton.addEventListener('click', async () => {
    const leaderName = leaderInput.value.trim();
    const colonyName = colonyInput.value.trim();
    const dream = dreamInput.value.trim();
    const appearance = appearanceInput.value.trim();
    
    if (!leaderName || !colonyName) {
      alert('Please enter both your name and a colony name.');
      return;
    }
    
    if (!dream) {
      alert('Please share your dream for your civilization.');
      return;
    }
    
    if (!appearance) {
      alert('Please describe what your tribe looks like.');
      return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Creating your colony';
    loadingIndicator.style.position = 'fixed'; // Ensure fixed positioning
    loadingIndicator.style.top = '50%';        // Center vertically
    loadingIndicator.style.left = '50%';       // Center horizontally
    loadingIndicator.style.transform = 'translate(-50%, -50%)'; // Perfect centering
    loadingIndicator.style.zIndex = '2000';    // Ensure it's above everything
    namingContainer.appendChild(loadingIndicator);
    
    try {
      // Create a sanitized version of the colony name for the KinOS API
      const sanitizedColonyName = colonyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Create a new kin in KinOS
      const kinResponse = await createKinOSKin(sanitizedColonyName, leaderName, colonyName, dream, appearance);
      
      if (kinResponse.error) {
        throw new Error(kinResponse.error);
      }
      
      // Store colony info in localStorage
      localStorage.setItem('colonyName', colonyName);
      localStorage.setItem('leaderName', leaderName);
      localStorage.setItem('kinId', kinResponse.id || kinResponse.existing_kin?.id);
      localStorage.setItem('kinName', sanitizedColonyName);
      localStorage.setItem('tribeDream', dream);
      localStorage.setItem('tribeAppearance', appearance);
      localStorage.setItem('lastPlayed', new Date().toISOString());
      
      // Remove the naming screen
      namingContainer.remove();
      
      // Show the language initialization screen
      createLanguageInitScreen(colonyName);
    } catch (error) {
      console.error('Error creating colony:', error);
      alert(`Failed to create colony: ${error.message}`);
      loadingIndicator.remove();
    }
  });
  buttonContainer.appendChild(startButton);
  
  namingContainer.appendChild(buttonContainer);
  
  document.body.appendChild(namingContainer);
  
  // Focus the leader name input
  leaderInput.focus();
}

// Create the language initialization screen
function createLanguageInitScreen(colonyName) {
  // Check if we have a tribe intro
  const introText = localStorage.getItem('tribeIntroText');
  const introAudio = localStorage.getItem('tribeIntroAudio');
  
  // If we have an intro, show it before proceeding to language screen
  if (introText) {
    // Create intro container
    const introContainer = document.createElement('div');
    introContainer.id = 'tribe-intro-screen';
    introContainer.className = 'fullscreen-overlay';
    
    // Create a centered content wrapper with proper styling
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'centered-content';
    contentWrapper.style.width = '800px'; // Ensure consistent width
    contentWrapper.style.maxWidth = '90%'; // Responsive constraint
    contentWrapper.style.margin = '0 auto'; // Center horizontally
    introContainer.appendChild(contentWrapper);
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = colonyName;
    title.className = 'intro-title';
    contentWrapper.appendChild(title);
    
    // Add tribe image if available
    const tribeImageUrl = localStorage.getItem('tribeImageUrl');
    const tribeImagePath = localStorage.getItem('tribeImagePath');
    
    if (tribeImageUrl || tribeImagePath) {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'tribe-image-container';
      
      const tribeImage = document.createElement('img');
      tribeImage.className = 'tribe-image';
      
      // Set the image source based on what's available
      if (tribeImageUrl) {
        tribeImage.src = tribeImageUrl;
      } else if (tribeImagePath) {
        // If we have a local path, construct the URL
        tribeImage.src = `http://localhost:5000/${tribeImagePath}`;
      }
      
      // Add loading and error handling
      tribeImage.onload = () => {
        console.log('Tribe image loaded successfully');
      };
      
      tribeImage.onerror = (e) => {
        console.warn('Failed to load tribe image:', e);
        imageContainer.style.display = 'none'; // Hide the container if image fails to load
      };
      
      imageContainer.appendChild(tribeImage);
      contentWrapper.appendChild(imageContainer);
    }
    
    // Add intro text
    const introTextElement = document.createElement('p');
    introTextElement.className = 'intro-text';
    introTextElement.textContent = introText;
    contentWrapper.appendChild(introTextElement);
    
    // Add continue button
    const continueButton = document.createElement('button');
    continueButton.textContent = 'Continue';
    continueButton.className = 'primary-button';
    continueButton.style.marginTop = '30px';
    continueButton.addEventListener('click', () => {
      introContainer.remove();
      // Now show the language screen
      showLanguageScreen();
    });
    contentWrapper.appendChild(continueButton);
    
    document.body.appendChild(introContainer);
    
    // Play the audio if available
    if (introAudio) {
      // Add server URL prefix if the path is relative
      const fullAudioUrl = introAudio.startsWith('/') 
        ? `http://localhost:3000${introAudio}` 
        : introAudio;
      
      console.log('Playing intro audio from URL:', fullAudioUrl);
      
      const audio = new Audio(fullAudioUrl);
      
      // Add error handling with more detailed logging
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.error('Audio error code:', audio.error ? audio.error.code : 'unknown');
        console.error('Audio error message:', audio.error ? audio.error.message : 'unknown');
        console.error('Audio source:', audio.src);
      });
      
      // Add debugging listeners
      audio.addEventListener('loadstart', () => console.log('Audio loading started'));
      audio.addEventListener('canplay', () => console.log('Audio can start playing'));
      audio.addEventListener('canplaythrough', () => console.log('Audio can play through'));
      
      audio.play().catch(err => console.warn('Could not play intro audio:', err));
    }
    
    return; // Exit early, the continue button will call showLanguageScreen
  }
  
  // If no intro, just show the language screen directly
  showLanguageScreen();
  
  // Define the showLanguageScreen function that contains the original code
  function showLanguageScreen() {
    // Create container
    const languageContainer = document.createElement('div');
    languageContainer.id = 'language-init-screen';
    languageContainer.className = 'fullscreen-overlay';
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Language Development';
    title.className = 'language-title';
    languageContainer.appendChild(title);
    
    // Add explanation
    const explanation = document.createElement('p');
    explanation.className = 'language-explanation';
    explanation.innerHTML = `Your settlers in <strong>${colonyName}</strong> don't yet know how to communicate effectively. 
      As their leader, you need to guide the initial development of their language. 
      How will your people begin to form words and meaning?`;
    languageContainer.appendChild(explanation);
    
    // Add input area
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'How will you start developing your colony\'s language?';
    inputLabel.htmlFor = 'language-input';
    inputLabel.className = 'language-input-label';
    languageContainer.appendChild(inputLabel);
    
    const inputArea = document.createElement('textarea');
    inputArea.id = 'language-input';
    inputArea.className = 'language-input';
    inputArea.placeholder = 'Describe how your settlers will begin to communicate. For example: "They will start by using simple gestures and sounds to identify important resources like water and food..."';
    inputArea.rows = 6;
    languageContainer.appendChild(inputArea);
    
    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    // Back button
    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.className = 'secondary-button';
    backButton.addEventListener('click', () => {
      languageContainer.remove();
      createColonyNamingScreen();
    });
    buttonContainer.appendChild(backButton);
    
    // Continue button
    const continueButton = document.createElement('button');
    continueButton.textContent = 'Establish Language';
    continueButton.className = 'primary-button';
    continueButton.addEventListener('click', async () => {
      const languageDescription = inputArea.value.trim();
      
      if (!languageDescription) {
        alert('Please describe how your settlers will begin to communicate.');
        return;
      }
      
      // Show loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.textContent = 'Establishing language foundations';
      languageContainer.appendChild(loadingIndicator);
      
      try {
        // Get colony info from localStorage
        const colonyName = localStorage.getItem('colonyName');
        const kinName = localStorage.getItem('kinName');
        
        // Initialize language with KinOS
        const languageResponse = await initializeLanguage(kinName, languageDescription, colonyName);
        
        if (languageResponse.error) {
          throw new Error(languageResponse.error);
        }
        
        // Store language initialization in localStorage
        localStorage.setItem('languageInitialized', 'true');
        localStorage.setItem('languageDescription', languageDescription);
        
        // Remove the language screen
        languageContainer.remove();
        
        // Start the game
        initWorld();
      } catch (error) {
        console.error('Error initializing language:', error);
        alert(`Failed to initialize language: ${error.message}`);
        loadingIndicator.remove();
      }
    });
    buttonContainer.appendChild(continueButton);
    
    languageContainer.appendChild(buttonContainer);
    
    document.body.appendChild(languageContainer);
    
    // Focus the input area
    inputArea.focus();
  }
}

// Function to create a new kin in KinOS
async function createKinOSKin(kinName, leaderName, colonyName, dream, appearance) {
  try {
    const response = await fetch('http://localhost:3000/api/kinos/kins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: kinName
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // If the kin already exists, we can still use it
      if (response.status === 409 && data.existing_kin) {
        console.log('Kin already exists, using existing kin:', data.existing_kin);
        
        // Send a message to save the dream and appearance
        await sendInitialTribeInfo(kinName, leaderName, colonyName, dream, appearance);
        
        return data;
      }
      
      throw new Error(data.error || 'Failed to create kin');
    }
    
    // Send a message to save the dream and appearance
    await sendInitialTribeInfo(kinName, leaderName, colonyName, dream, appearance);
    
    return data;
  } catch (error) {
    console.error('Error creating KinOS kin:', error);
    return { error: error.message };
  }
}

// Add a new function to send the initial tribe information
async function sendInitialTribeInfo(kinName, leaderName, colonyName, dream, appearance) {
  try {
    const messageContent = `
Initial Tribe Information:

Colony Name: ${colonyName}
Leader Name: ${leaderName}

Dream for Civilization:
${dream}

Tribe Appearance:
${appearance}

Please create an epic, inspiring introduction for this tribe that captures their appearance and ambitious dreams. Make it dramatic and cinematic - something that would make an amazing opening narration for their story. This will be read aloud to the player, so make it sound great when spoken.
`;

    const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        mode: "tribe_initialization",
        addSystem: "You are an epic storyteller creating a powerful introduction for a new tribe. Create a dramatic, inspiring narrative that captures both their physical appearance and their dreams for the future. Your introduction should be 3-5 sentences long and have a cinematic quality - like the opening narration to an epic saga."
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.warn('Failed to save tribe information, but continuing:', errorData.error);
      // We don't throw here to allow the process to continue even if this fails
    }
    
    const responseData = await response.json();
    
    // Extract the introduction text from the response
    const introText = responseData.content || "A new tribe begins their journey...";
    
    // Generate TTS for the introduction
    try {
      console.log("Generating TTS for tribe introduction");
      const ttsResponse = await fetch('http://localhost:3000/api/kinos/tts?format=mp3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: introText,
          voice_id: "IKne3meq5aSn9XLyUdCD", // Epic narrator voice
          model: "eleven_monolingual_v1"
        })
      });
      
      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        
        // Check if there was an error but we still got a response with an audio_url
        if (ttsData.error && ttsData.audio_url) {
          console.warn('TTS generation had an error but provided a fallback URL:', ttsData.error);
          // Still use the audio URL even if there was an error
          const audioUrl = ttsData.audio_url;
          
          // Add server URL prefix if the path is relative
          const fullAudioUrl = audioUrl.startsWith('/') 
            ? `http://localhost:3000${audioUrl}` 
            : audioUrl;
          
          console.log('Using audio URL:', fullAudioUrl);
          
          const audio = new Audio(fullAudioUrl);
          audio.play().catch(err => console.warn('Could not play intro audio:', err));
          
          // Store the intro text and audio URL in localStorage
          localStorage.setItem('tribeIntroText', introText);
          localStorage.setItem('tribeIntroAudio', fullAudioUrl);
        }
        // Normal successful case
        else if (ttsData.audio_url || ttsData.result_url) {
          const audioUrl = ttsData.audio_url || ttsData.result_url;
          
          // Add server URL prefix if the path is relative
          const fullAudioUrl = audioUrl.startsWith('/') 
            ? `http://localhost:3000${audioUrl}` 
            : audioUrl;
          
          console.log('Using audio URL:', fullAudioUrl);
          
          const audio = new Audio(fullAudioUrl);
          audio.play().catch(err => console.warn('Could not play intro audio:', err));
          
          // Store the intro text and audio URL in localStorage
          localStorage.setItem('tribeIntroText', introText);
          localStorage.setItem('tribeIntroAudio', fullAudioUrl);
        }
        else {
          console.warn('No audio URL found in TTS response:', ttsData);
        }
      } else {
        console.warn('Failed to generate TTS for tribe introduction');
      }
    } catch (ttsError) {
      console.warn('Error generating TTS:', ttsError);
    }
    
    // Generate an image of the tribe using Ideogram API
    try {
      console.log("Generating image of the tribe");
      
      // Create a prompt for the image based on tribe information
      const imagePrompt = `Epic cinematic portrait of a primitive tribe: ${appearance}. They are standing together as a group in their natural environment, looking determined and hopeful. Their dream is: ${dream}. Dramatic lighting, detailed, realistic style, high quality.`;
      
      const imageResponse = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspect_ratio: "1:1",
          model: "ideogram-v2",
          magic_prompt: true,
          message: "Generate an image of our tribe" // Add required message parameter
        })
      });
      
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        
        // Check if there was an error but we still got a URL
        if (imageData.error && imageData.data && imageData.data.url) {
          console.warn('Image generation had an error but provided a URL:', imageData.error);
          localStorage.setItem('tribeImageUrl', imageData.data.url);
        }
        // Normal successful case
        else if (imageData.data && imageData.data.url) {
          localStorage.setItem('tribeImageUrl', imageData.data.url);
          console.log("Tribe image generated successfully:", imageData.data.url);
        } 
        else if (imageData.local_path) {
          // If we have a local path instead of a direct URL
          localStorage.setItem('tribeImagePath', imageData.local_path);
          console.log("Tribe image saved locally:", imageData.local_path);
        }
        else {
          console.warn('No image URL found in response:', imageData);
        }
      } else {
        console.warn('Failed to generate tribe image');
      }
    } catch (imageError) {
      console.warn('Error generating tribe image:', imageError);
    }
    
    return responseData;
  } catch (error) {
    console.warn('Error saving tribe information, but continuing:', error);
    // We don't throw here to allow the process to continue even if this fails
    return { warning: error.message };
  }
}

// Function to initialize language with KinOS
async function initializeLanguage(kinName, languageDescription, colonyName) {
  try {
    const messageContent = `
I need to establish the initial language development for my new colony named "${colonyName}".

Here's how I want to approach language development:
${languageDescription}

Please analyze this approach and provide:
1. What basic vocabulary might emerge first
2. How communication methods will develop
3. Any challenges or advantages of this approach
4. Initial cultural implications of this language development

Format your response as a language initialization report that I can share with my settlers.
`;

    const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        mode: "language_initialization",
        addSystem: "You are a linguistic anthropologist specializing in the development of early human languages. Analyze the proposed language development approach and provide realistic insights on how this language might form and evolve."
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to initialize language');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error initializing language:', error);
    return { error: error.message };
  }
}

// Generate a random name with improved variety
function generateRandomName(type) {
  // Leader first names - expanded with more diverse options
  const leaderFirstNames = [
    // Fantasy/Mythic names
    'Aria', 'Thorne', 'Elara', 'Kael', 'Lyra', 'Orion', 'Seraphina', 'Rowan',
    'Nova', 'Galen', 'Freya', 'Talon', 'Isolde', 'Caspian', 'Elowen', 'Alaric',
    'Octavia', 'Finnian', 'Thalia', 'Darian', 'Maeve', 'Evander', 'Aurelia', 'Silas',
    'Liora', 'Kieran', 'Ember', 'Lysander', 'Selene', 'Gareth', 'Zephyr', 'Rhiannon',
    // Historical/Traditional names
    'Adira', 'Bram', 'Calista', 'Darius', 'Eleanor', 'Felix', 'Gwendolyn', 'Henrik',
    'Imogen', 'Jasper', 'Kira', 'Leif', 'Matilda', 'Nikolai', 'Ophelia', 'Perseus',
    'Quinn', 'Roland', 'Soren', 'Theodora', 'Ulric', 'Vivienne', 'Wren', 'Xander',
    // Nature-inspired names
    'Aspen', 'Brook', 'Cedar', 'Dawn', 'Fern', 'Hazel', 'Iris', 'Juniper',
    'Lark', 'Moss', 'Raven', 'Sage', 'Terra', 'Willow', 'Yarrow', 'Zephyr'
  ];
  
  // Leader last names - expanded with more thematic options
  const leaderLastNames = [
    // Elemental/Nature surnames
    'Blackwood', 'Silverstone', 'Thornfield', 'Nightshade', 'Ravencrest', 'Stormwind',
    'Ironheart', 'Winterfall', 'Sunhaven', 'Moonshadow', 'Starforge', 'Oakenshield',
    'Fireheart', 'Wolfsbane', 'Dawnbreaker', 'Shadowvale', 'Lightbringer', 'Frostpeak',
    // Geographic surnames
    'Highcliff', 'Deepvale', 'Riverstone', 'Mistridge', 'Stonebrook', 'Wildmoor',
    'Greenfield', 'Northcrest', 'Westwind', 'Eastbrook', 'Southmeadow', 'Clearwater',
    // Profession/Trait surnames
    'Fletcher', 'Smith', 'Hunter', 'Shepherd', 'Thatcher', 'Mason', 'Weaver', 'Fisher',
    'Swift', 'Strong', 'Wise', 'Keen', 'Brave', 'Hardy', 'Sharp', 'Bright',
    // Compound surnames
    'Goldenhawk', 'Proudfoot', 'Swiftarrow', 'Strongheart', 'Trueheart', 'Longstrider',
    'Fairwind', 'Brightwater', 'Wildrunner', 'Silverthorn', 'Darkwater', 'Fireforge'
  ];
  
  // Colony name prefixes - expanded with more descriptive options
  const colonyPrefixes = [
    // Directional
    'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Far', 'High', 'Deep',
    // Descriptive
    'New', 'Old', 'Great', 'Little', 'Fair', 'Golden', 'Silver', 'Crystal', 'Emerald',
    'Bright', 'Shadow', 'Hidden', 'Sacred', 'Ancient', 'Eternal', 'Wild', 'Free',
    // Protective
    'Fort', 'Haven', 'Refuge', 'Sanctuary', 'Bastion', 'Citadel', 'Stronghold', 'Shield',
    // Water-related
    'Port', 'Harbor', 'Bay', 'Tide', 'River', 'Lake', 'Spring', 'Mist',
    // Elevated
    'Mount', 'Peak', 'Ridge', 'Hill', 'Crest', 'Summit', 'Highland', 'Mesa'
  ];
  
  // Colony name roots - expanded with more diverse terrain features
  const colonyRoots = [
    // Natural features
    'Haven', 'Ridge', 'Vale', 'Creek', 'Harbor', 'Glen', 'Field', 'Wood', 'Stone',
    'River', 'Lake', 'Hill', 'Dale', 'Forge', 'Bridge', 'Crest', 'Hollow', 'Meadow',
    'Spring', 'Falls', 'Grove', 'Glade', 'Reach', 'Crossing', 'Landing', 'Rest',
    // Additional natural features
    'Canyon', 'Prairie', 'Marsh', 'Cliff', 'Coast', 'Delta', 'Dune', 'Forest',
    'Gorge', 'Island', 'Jungle', 'Mesa', 'Oasis', 'Plateau', 'Reef', 'Tundra',
    // Settlement types
    'Village', 'Hamlet', 'Outpost', 'Camp', 'Keep', 'Refuge', 'Homestead', 'Settlement',
    'Colony', 'Enclave', 'Bastion', 'Sanctuary', 'Stronghold', 'Township', 'Hearth',
    // Aspirational names
    'Hope', 'Faith', 'Unity', 'Harmony', 'Bounty', 'Plenty', 'Fortune', 'Destiny',
    'Promise', 'Prospect', 'Venture', 'Liberty', 'Solace', 'Serenity', 'Triumph'
  ];
  
  // Additional colony name patterns
  const compoundColonyNames = [
    'Stonebridge', 'Oakvale', 'Highgarden', 'Deephollow', 'Fairhaven', 'Winterhold',
    'Sunspire', 'Ravenwood', 'Silverstream', 'Ironforge', 'Goldcrest', 'Stormwatch',
    'Brightwater', 'Shadowfen', 'Frostpeak', 'Greenmeadow', 'Redcliff', 'Bluewater',
    'Blackstone', 'Whitehill', 'Greywood', 'Wildwood', 'Clearwater', 'Darkhollow'
  ];
  
  // Thematic colony names
  const thematicColonyNames = [
    'Newbeginning', 'Firstlight', 'Hopesend', 'Laststand', 'Safehold', 'Freehaven',
    'Homecoming', 'Journeysend', 'Starfall', 'Moonrise', 'Sunrest', 'Dawnbreak',
    'Twilighthaven', 'Morningstar', 'Eveningtide', 'Dayspring', 'Nighthaven'
  ];
  
  if (type === 'leader') {
    const firstName = leaderFirstNames[Math.floor(Math.random() * leaderFirstNames.length)];
    const lastName = leaderLastNames[Math.floor(Math.random() * leaderLastNames.length)];
    return `${firstName} ${lastName}`;
  } else if (type === 'colony') {
    // Choose from multiple colony name patterns
    const namePattern = Math.floor(Math.random() * 4); // 0-3 for four different patterns
    
    switch (namePattern) {
      case 0: // Prefix + Root (e.g., "New Haven")
        const prefix = colonyPrefixes[Math.floor(Math.random() * colonyPrefixes.length)];
        const root = colonyRoots[Math.floor(Math.random() * colonyRoots.length)];
        return `${prefix} ${root}`;
        
      case 1: // Single Root (e.g., "Meadow")
        return colonyRoots[Math.floor(Math.random() * colonyRoots.length)];
        
      case 2: // Compound Name (e.g., "Stonebridge")
        return compoundColonyNames[Math.floor(Math.random() * compoundColonyNames.length)];
        
      case 3: // Thematic Name (e.g., "Newbeginning")
        return thematicColonyNames[Math.floor(Math.random() * thematicColonyNames.length)];
    }
  }
  
  return 'Unknown';
}

// Helper function to get saved colonies from localStorage
function getSavedColonies() {
  const colonies = [];
  
  // Check if we have a saved colony
  if (localStorage.getItem('colonyName') && localStorage.getItem('leaderName')) {
    // Get the last played timestamp or use current time if not available
    const lastPlayed = localStorage.getItem('lastPlayed') || new Date().toISOString();
    
    colonies.push({
      id: 'current', // Use 'current' as ID for the main colony
      colonyName: localStorage.getItem('colonyName'),
      leaderName: localStorage.getItem('leaderName'),
      lastPlayed: lastPlayed
    });
  }
  
  // Check for additional colonies in the 'savedColonies' array
  try {
    const savedColoniesJSON = localStorage.getItem('savedColonies');
    if (savedColoniesJSON) {
      const savedColonies = JSON.parse(savedColoniesJSON);
      colonies.push(...savedColonies);
    }
  } catch (error) {
    console.error('Error parsing saved colonies:', error);
  }
  
  // Sort by last played date (most recent first)
  return colonies.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
}

// Function to load a colony
function loadColony(colonyId) {
  try {
    console.log(`Loading colony with ID: ${colonyId}`);
    
    // Update last played timestamp
    const now = new Date().toISOString();
    localStorage.setItem('lastPlayed', now);
    
    // If it's not the current colony, we need to swap data
    if (colonyId !== 'current') {
      // Get the saved colonies
      const savedColoniesJSON = localStorage.getItem('savedColonies');
      if (savedColoniesJSON) {
        const savedColonies = JSON.parse(savedColoniesJSON);
        
        // Find the colony to load
        const colonyToLoad = savedColonies.find(colony => colony.id === colonyId);
        
        if (colonyToLoad) {
          // Save current colony data to savedColonies if it exists
          if (localStorage.getItem('colonyName') && localStorage.getItem('leaderName')) {
            // Create a backup of current colony
            const currentColony = {
              id: 'backup_' + Date.now(),
              colonyName: localStorage.getItem('colonyName'),
              leaderName: localStorage.getItem('leaderName'),
              kinId: localStorage.getItem('kinId'),
              kinName: localStorage.getItem('kinName'),
              tribeDream: localStorage.getItem('tribeDream'),
              tribeAppearance: localStorage.getItem('tribeAppearance'),
              languageInitialized: localStorage.getItem('languageInitialized'),
              languageDescription: localStorage.getItem('languageDescription'),
              tribeIntroText: localStorage.getItem('tribeIntroText'),
              tribeIntroAudio: localStorage.getItem('tribeIntroAudio'),
              tribeImageUrl: localStorage.getItem('tribeImageUrl'),
              tribeImagePath: localStorage.getItem('tribeImagePath'),
              languageDevelopment: localStorage.getItem('languageDevelopment'),
              lastPlayed: localStorage.getItem('lastPlayed') || now
            };
            
            // Add to saved colonies, replacing the one we're loading
            const updatedColonies = savedColonies
              .filter(colony => colony.id !== colonyId)
              .concat(currentColony);
            
            localStorage.setItem('savedColonies', JSON.stringify(updatedColonies));
          }
          
          // Load the selected colony data into main localStorage
          localStorage.setItem('colonyName', colonyToLoad.colonyName);
          localStorage.setItem('leaderName', colonyToLoad.leaderName);
          localStorage.setItem('kinId', colonyToLoad.kinId || '');
          localStorage.setItem('kinName', colonyToLoad.kinName || '');
          localStorage.setItem('tribeDream', colonyToLoad.tribeDream || '');
          localStorage.setItem('tribeAppearance', colonyToLoad.tribeAppearance || '');
          localStorage.setItem('languageInitialized', colonyToLoad.languageInitialized || 'false');
          localStorage.setItem('languageDescription', colonyToLoad.languageDescription || '');
          localStorage.setItem('tribeIntroText', colonyToLoad.tribeIntroText || '');
          localStorage.setItem('tribeIntroAudio', colonyToLoad.tribeIntroAudio || '');
          localStorage.setItem('tribeImageUrl', colonyToLoad.tribeImageUrl || '');
          localStorage.setItem('tribeImagePath', colonyToLoad.tribeImagePath || '');
          localStorage.setItem('languageDevelopment', colonyToLoad.languageDevelopment || '');
          localStorage.setItem('lastPlayed', now);
          
          console.log(`Colony "${colonyToLoad.colonyName}" loaded successfully`);
        } else {
          console.error(`Colony with ID ${colonyId} not found`);
        }
      }
    }
    
    // Initialize the world
    initWorld();
  } catch (error) {
    console.error('Error loading colony:', error);
    alert(`Failed to load colony: ${error.message}`);
  }
}

// Helper function to format date
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    // If it's today, show time
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise show the date
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown date';
  }
}

// Create a screen for loading saved colonies
function createLoadColonyScreen() {
  // Create container
  const loadContainer = document.createElement('div');
  loadContainer.id = 'load-colony-screen';
  loadContainer.className = 'fullscreen-overlay';
  
  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Load Colony';
  title.className = 'naming-title';
  loadContainer.appendChild(title);
  
  // Create colonies list container
  const coloniesContainer = document.createElement('div');
  coloniesContainer.className = 'colonies-container';
  
  // Get saved colonies from localStorage
  const savedColonies = getSavedColonies();
  
  if (savedColonies.length === 0) {
    // No saved colonies
    const noColoniesMessage = document.createElement('p');
    noColoniesMessage.className = 'no-colonies-message';
    noColoniesMessage.textContent = 'No saved colonies found.';
    coloniesContainer.appendChild(noColoniesMessage);
  } else {
    // Create a list of colonies
    const coloniesList = document.createElement('div');
    coloniesList.className = 'colonies-list';
    
    savedColonies.forEach(colony => {
      const colonyItem = document.createElement('div');
      colonyItem.className = 'colony-item';
      
      // Add colony info
      const colonyInfo = document.createElement('div');
      colonyInfo.className = 'colony-info';
      
      const colonyName = document.createElement('h3');
      colonyName.textContent = colony.colonyName;
      colonyInfo.appendChild(colonyName);
      
      const leaderName = document.createElement('p');
      leaderName.textContent = `Leader: ${colony.leaderName}`;
      colonyInfo.appendChild(leaderName);
      
      const lastPlayed = document.createElement('p');
      lastPlayed.className = 'last-played';
      lastPlayed.textContent = `Last played: ${formatDate(colony.lastPlayed)}`;
      colonyInfo.appendChild(lastPlayed);
      
      colonyItem.appendChild(colonyInfo);
      
      // Add load button
      const loadButton = document.createElement('button');
      loadButton.className = 'load-colony-button';
      loadButton.textContent = 'Load';
      loadButton.addEventListener('click', () => {
        loadColony(colony.id);
        loadContainer.remove();
      });
      colonyItem.appendChild(loadButton);
      
      // Add delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-colony-button';
      deleteButton.textContent = '🗑️';
      deleteButton.title = 'Delete colony';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the load action
        confirmDeleteColony(colony.id, colonyItem);
      });
      colonyItem.appendChild(deleteButton);
      
      coloniesList.appendChild(colonyItem);
    });
    
    coloniesContainer.appendChild(coloniesList);
  }
  
  loadContainer.appendChild(coloniesContainer);
  
  // Add buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  
  // Back button
  const backButton = document.createElement('button');
  backButton.textContent = 'Back';
  backButton.className = 'secondary-button';
  backButton.addEventListener('click', () => {
    loadContainer.remove();
    createWelcomeScreen();
  });
  buttonContainer.appendChild(backButton);
  
  loadContainer.appendChild(buttonContainer);
  
  document.body.appendChild(loadContainer);
}

// Function to show compute transfer dialog
function showComputeTransferDialog(walletAddress) {
  console.log('showComputeTransferDialog called with address:', walletAddress);
  
  // Make sure we don't have multiple dialogs
  const existingDialog = document.querySelector('.dialog');
  if (existingDialog) {
    console.log('Removing existing dialog before showing new one');
    existingDialog.remove();
  }
  
  // Create dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.className = 'dialog';
  
  // Create dialog content
  const dialogContent = document.createElement('div');
  dialogContent.className = 'dialog-content';
  
  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Transfer $COMPUTE';
  dialogContent.appendChild(title);
  
  // Add description
  const description = document.createElement('p');
  description.textContent = 'Transfer $COMPUTE tokens to power your colony. A minimum of 100,000 $COMPUTE is required.';
  dialogContent.appendChild(description);
  
  // Add wallet info
  const walletInfo = document.createElement('p');
  walletInfo.innerHTML = `Connected wallet: <strong>${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}</strong>`;
  dialogContent.appendChild(walletInfo);
  
  // Create form
  const form = document.createElement('div');
  form.style.marginTop = '20px';
  
  // Add amount input
  const amountLabel = document.createElement('label');
  amountLabel.textContent = 'Amount of $COMPUTE:';
  amountLabel.style.display = 'block';
  amountLabel.style.marginBottom = '5px';
  form.appendChild(amountLabel);
  
  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.min = '100000';
  amountInput.value = '500000';
  amountInput.style.width = '100%';
  amountInput.style.padding = '10px';
  amountInput.style.marginBottom = '15px';
  amountInput.style.borderRadius = '5px';
  amountInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  amountInput.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
  amountInput.style.color = 'white';
  form.appendChild(amountInput);
  
  // Add suggestion buttons
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.style.display = 'flex';
  suggestionsContainer.style.gap = '10px';
  suggestionsContainer.style.marginBottom = '20px';
  
  const suggestions = [500000, 1000000, 2500000];
  suggestions.forEach(amount => {
    const suggestionButton = document.createElement('button');
    suggestionButton.textContent = amount.toLocaleString();
    suggestionButton.className = 'secondary-button';
    suggestionButton.style.flex = '1';
    suggestionButton.addEventListener('click', () => {
      amountInput.value = amount;
    });
    suggestionsContainer.appendChild(suggestionButton);
  });
  
  form.appendChild(suggestionsContainer);
  dialogContent.appendChild(form);
  
  // Add buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.marginTop = '20px';
  
  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'secondary-button';
  cancelButton.style.flex = '1';
  cancelButton.addEventListener('click', () => {
    dialogContainer.remove();
  });
  buttonContainer.appendChild(cancelButton);
  
  // Transfer button
  const transferButton = document.createElement('button');
  transferButton.textContent = 'Transfer';
  transferButton.className = 'primary-button';
  transferButton.style.flex = '1';
  transferButton.addEventListener('click', async () => {
    const amount = parseInt(amountInput.value);
    const success = await transferCompute(amount, walletAddress);
    if (success) {
      dialogContainer.remove();
    }
  });
  buttonContainer.appendChild(transferButton);
  
  dialogContent.appendChild(buttonContainer);
  dialogContainer.appendChild(dialogContent);
  
  // Add to document
  document.body.appendChild(dialogContainer);
  console.log('COMPUTE transfer dialog added to document');
}

export { createWelcomeScreen, createColonyNamingScreen, createLanguageInitScreen, createLoadColonyScreen, loadColony, showComputeTransferDialog };
