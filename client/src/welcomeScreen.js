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
  
  // Add load colony button (disabled for now)
  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load Colony';
  loadButton.className = 'welcome-button';
  loadButton.disabled = true;
  menuContainer.appendChild(loadButton);
  
  // Add settings button (disabled for now)
  const settingsButton = document.createElement('button');
  settingsButton.textContent = 'Settings';
  settingsButton.className = 'welcome-button';
  settingsButton.disabled = true;
  menuContainer.appendChild(settingsButton);
  
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
    
    if (!leaderName || !colonyName) {
      alert('Please enter both your name and a colony name.');
      return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Creating your colony';
    namingContainer.appendChild(loadingIndicator);
    
    try {
      // Create a sanitized version of the colony name for the KinOS API
      const sanitizedColonyName = colonyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Create a new kin in KinOS
      const kinResponse = await createKinOSKin(sanitizedColonyName);
      
      if (kinResponse.error) {
        throw new Error(kinResponse.error);
      }
      
      // Store colony info in localStorage
      localStorage.setItem('colonyName', colonyName);
      localStorage.setItem('leaderName', leaderName);
      localStorage.setItem('kinId', kinResponse.id || kinResponse.existing_kin?.id);
      localStorage.setItem('kinName', sanitizedColonyName);
      
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

// Function to create a new kin in KinOS
async function createKinOSKin(kinName) {
  try {
    const response = await fetch('http://localhost:5000/v2/blueprints/autonomousrealms/kins', {
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
        return data;
      }
      
      throw new Error(data.error || 'Failed to create kin');
    }
    
    return data;
  } catch (error) {
    console.error('Error creating KinOS kin:', error);
    return { error: error.message };
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

    const response = await fetch(`http://localhost:5000/v2/blueprints/autonomousrealms/kins/${kinName}/messages`, {
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

// Generate a random name
function generateRandomName(type) {
  const leaderFirstNames = [
    'Aria', 'Thorne', 'Elara', 'Kael', 'Lyra', 'Orion', 'Seraphina', 'Rowan',
    'Nova', 'Galen', 'Freya', 'Talon', 'Isolde', 'Caspian', 'Elowen', 'Alaric',
    'Octavia', 'Finnian', 'Thalia', 'Darian', 'Maeve', 'Evander', 'Aurelia', 'Silas',
    'Liora', 'Kieran', 'Ember', 'Lysander', 'Selene', 'Gareth', 'Zephyr', 'Rhiannon'
  ];
  
  const leaderLastNames = [
    'Blackwood', 'Silverstone', 'Thornfield', 'Nightshade', 'Ravencrest', 'Stormwind',
    'Ironheart', 'Winterfall', 'Sunhaven', 'Moonshadow', 'Starforge', 'Oakenshield',
    'Fireheart', 'Wolfsbane', 'Dawnbreaker', 'Shadowvale', 'Lightbringer', 'Frostpeak'
  ];
  
  const colonyPrefixes = [
    'New', 'Fort', 'Haven', 'Port', 'Mount', 'North', 'South', 'East', 'West',
    'Upper', 'Lower', 'Great', 'Little', 'Old', 'High', 'Far', 'Deep', 'Golden'
  ];
  
  const colonyRoots = [
    'Haven', 'Ridge', 'Vale', 'Creek', 'Harbor', 'Glen', 'Field', 'Wood', 'Stone',
    'River', 'Lake', 'Hill', 'Dale', 'Forge', 'Bridge', 'Crest', 'Hollow', 'Meadow',
    'Spring', 'Falls', 'Grove', 'Glade', 'Reach', 'Crossing', 'Landing', 'Rest'
  ];
  
  if (type === 'leader') {
    const firstName = leaderFirstNames[Math.floor(Math.random() * leaderFirstNames.length)];
    const lastName = leaderLastNames[Math.floor(Math.random() * leaderLastNames.length)];
    return `${firstName} ${lastName}`;
  } else if (type === 'colony') {
    // 50% chance to use a prefix
    if (Math.random() > 0.5) {
      const prefix = colonyPrefixes[Math.floor(Math.random() * colonyPrefixes.length)];
      const root = colonyRoots[Math.floor(Math.random() * colonyRoots.length)];
      return `${prefix} ${root}`;
    } else {
      const root = colonyRoots[Math.floor(Math.random() * colonyRoots.length)];
      return root;
    }
  }
  
  return 'Unknown';
}

export { createWelcomeScreen, createColonyNamingScreen, createLanguageInitScreen };
