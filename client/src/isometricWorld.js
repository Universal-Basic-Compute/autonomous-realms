import audioPlayer from './audioPlayer.js';
import { createWelcomeScreen } from './welcomeScreen.js';

// Language caching variables
let languageCache = null;
let languageCacheTimestamp = 0;
const LANGUAGE_CACHE_DURATION = 600000; // 10 minutes in milliseconds

// Function to check if a pixel is transparent
function isTransparentPixel(img, x, y) {
  try {
    // Create a temporary canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Make sure the canvas is the same size as the image
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0);
    
    // Make sure x and y are within bounds and are integers
    x = Math.floor(x);
    y = Math.floor(y);
    
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
      console.log(`Pixel coordinates out of bounds: ${x},${y} for image ${img.width}x${img.height}`);
      return true; // Consider out-of-bounds as transparent
    }
    
    // Get the pixel data
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    
    // Check if the alpha channel (4th value) is less than a threshold (using 10 instead of 0 for better detection)
    const isTransparent = pixelData[3] < 10;
    
    return isTransparent;
  } catch (error) {
    console.error('Error checking pixel transparency:', error);
    return false; // Default to non-transparent on error
  }
}

// Configuration
const config = {
    tileWidth: 512,
    tileHeight: 512,
    initialZoom: 0.5,
    minZoom: 0.2,
    maxZoom: 2.0,
    zoomStep: 0.1,
    serverUrl: 'http://localhost:3000',
    gridSize: 16, // Size of the terrain map (16x16)
    visibleRadius: 5, // How many tiles to load around the center
    isometricAngle: 30, // Degrees for isometric projection
    debugMode: false // Set to true to enable debug visualization
};

// State
const state = {
    zoom: config.initialZoom,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastOffsetX: 0,
    lastOffsetY: 0,
    loadedTiles: new Map(), // Map to track loaded tiles
    selectedTile: null,
    isLoading: false,
    availableActions: [], // Store available actions for selected tile
    actionMenuVisible: false, // Track if action menu is visible
    contextMenu: null, // Track the current context menu
    hasDragged: false  // Track if dragging has occurred
};

// DOM Elements
const worldContainer = document.getElementById('isometric-world');
const tileInfoElement = document.getElementById('tile-info');

// Initialize the world
export function initWorld() {
    // Calculate the center of the grid in isometric coordinates
    const centerX = Math.floor(config.gridSize / 2);
    const centerY = Math.floor(config.gridSize / 2);
    const centerPosition = gridToIso(centerX, centerY);
    
    // Set initial offset to center the view on the middle of the map
    // We need to negate the position because we're moving the world in the opposite direction
    state.offsetX = -centerPosition.x * config.initialZoom + window.innerWidth / 2;
    state.offsetY = -centerPosition.y * config.initialZoom + window.innerHeight / 2;
    
    // Set initial transform
    updateWorldTransform();
    
    // Add event listeners
    setupEventListeners();
    
    // Load initial tiles
    loadVisibleTiles();
    
    // Show the circular menu immediately
    showCircularMenu();
    
    // Fetch language data in the background
    fetchAndCacheLanguageData().then(data => {
        if (data) {
            console.log('Language data pre-loaded successfully');
        }
    });
    
    // Fetch culture data in the background
    fetchAndCacheCultureData().then(data => {
        if (data) {
            console.log('Culture data pre-loaded successfully');
        }
    });
}

// Fetch available actions for a terrain type
async function fetchAvailableActions(terrainCode) {
    if (!terrainCode) return [];
    
    try {
        // Extract the base terrain code (before any | character)
        const baseTerrainCode = terrainCode.split('|')[0];
        
        console.log(`Fetching actions for terrain: ${terrainCode} (base: ${baseTerrainCode})`);
        
        // Use the AI-powered endpoint to get actions
        const response = await fetch(`${config.serverUrl}/api/data/actions/ai/${terrainCode}`);
        
        if (!response.ok) {
            console.error(`Failed to fetch actions for terrain ${terrainCode}: ${response.status} ${response.statusText}`);
            return [];
        }
        
        const actions = await response.json();
        console.log(`Received ${actions.length} actions for terrain ${terrainCode}`);
        
        return actions;
    } catch (error) {
        console.error('Error fetching available actions:', error);
        return [];
    }
}

// Fetch narration for a terrain type
async function fetchTerrainNarration(terrainCode) {
    if (!terrainCode) return null;
    
    try {
        console.log(`Fetching narration for terrain: ${terrainCode}`);
        const response = await fetch(`${config.serverUrl}/api/data/actions/ai/${terrainCode}/narration`);
        
        if (!response.ok) {
            try {
                // Try to parse as JSON first
                const errorData = await response.json();
                console.error(`Failed to fetch narration for terrain ${terrainCode}:`, errorData);
                showErrorNotification(`Failed to fetch narration: ${errorData.message || response.statusText}`);
            } catch (parseError) {
                // If it's not JSON, get the text
                const errorText = await response.text();
                console.error(`Failed to fetch narration for terrain ${terrainCode}: ${response.status} ${response.statusText}`, errorText);
                showErrorNotification(`Failed to fetch narration: ${response.status} ${response.statusText}`);
            }
            return null;
        }
        
        // Check content type to determine how to handle the response
        const contentType = response.headers.get('content-type');
        
        // If it's JSON, parse it
        if (contentType && contentType.includes('application/json')) {
            try {
                const narrationData = await response.json();
                console.log('Received narration data:', narrationData);
                
                if (narrationData.error) {
                    console.error('Narration data contains error:', narrationData.error);
                    showErrorNotification(`Narration error: ${narrationData.error.message || 'Unknown error'}`);
                }
                
                return narrationData;
            } catch (jsonError) {
                console.error('Error parsing narration JSON:', jsonError);
                showErrorNotification(`Error parsing narration data: ${jsonError.message}`);
                return null;
            }
        } else {
            // For non-JSON responses, create a simple object with the narration text
            console.warn(`Received non-JSON response with content-type: ${contentType}`);
            return {
                terrainCode,
                narration: "A new land awaits exploration...", // Fallback narration text
                audio: {
                    audio_url: null,
                    error: {
                        message: `Unexpected content type: ${contentType}`
                    }
                }
            };
        }
    } catch (error) {
        console.error('Error fetching terrain narration:', error);
        showErrorNotification(`Error fetching narration: ${error.message}`);
        return null;
    }
}

// Play audio narration
function playNarration(audioData) {
    if (!audioData) {
        console.error('No audio data provided');
        showErrorNotification('Failed to load audio narration');
        return;
    }
    
    if (audioData.error) {
        console.error('Audio data contains error:', audioData.error);
        showErrorNotification('Failed to generate audio narration');
        return;
    }
    
    try {
        // Create an audio element
        const audioElement = new Audio();
        
        // Set the source to the audio data
        if (audioData.audio_url) {
            console.log('Playing audio from URL:', audioData.audio_url);
            // Check if it's a relative or absolute URL
            if (audioData.audio_url.startsWith('/')) {
                // It's a server path, prepend the server URL
                audioElement.src = `${config.serverUrl}${audioData.audio_url}`;
            } else {
                // It's already a full URL
                audioElement.src = audioData.audio_url;
            }
        } else if (audioData.result_url) {
            console.log('Playing audio from result URL:', audioData.result_url);
            audioElement.src = audioData.result_url;
        } else if (audioData.audio_base64) {
            console.log('Playing audio from base64 data');
            audioElement.src = `data:audio/mp3;base64,${audioData.audio_base64}`;
        } else {
            console.error('No audio URL or base64 data found in:', audioData);
            showErrorNotification('Audio data format not supported');
            return;
        }
        
        // Add error handling for audio playback
        audioElement.onerror = (e) => {
            console.error('Error playing audio:', e);
            showErrorNotification('Failed to play audio narration');
        };
        
        // Add loading indicator
        audioElement.onloadstart = () => {
            console.log('Audio started loading');
        };
        
        audioElement.oncanplaythrough = () => {
            console.log('Audio can play through');
        };
        
        // Play the audio
        audioElement.play().catch(error => {
            console.error('Error playing audio:', error);
            showErrorNotification(`Failed to play audio: ${error.message}`);
        });
    } catch (error) {
        console.error('Error setting up audio playback:', error);
        showErrorNotification('Failed to set up audio playback');
    }
}

// Helper function to show error notifications
function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 1000);
    }, 5000);
}

// Display the action menu
function showActionMenu(actions) {
    // Clear any existing action menu
    const existingMenu = document.getElementById('action-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create action menu container
    const actionMenu = document.createElement('div');
    actionMenu.id = 'action-menu';
    actionMenu.className = 'action-menu';
    
    // Add title
    const menuTitle = document.createElement('h3');
    menuTitle.textContent = 'Available Actions';
    actionMenu.appendChild(menuTitle);
    
    // Create action list
    const actionList = document.createElement('ul');
    
    if (actions.length === 0) {
        const noActions = document.createElement('li');
        noActions.textContent = 'No actions available for this terrain';
        noActions.className = 'no-actions';
        actionList.appendChild(noActions);
    } else {
        // Add each action as a button
        actions.forEach(action => {
            const actionItem = document.createElement('li');
            
            const actionButton = document.createElement('button');
            actionButton.className = 'action-button';
            actionButton.dataset.actionCode = action.code;
            
            // Add emoji if available, otherwise use a default
            const emoji = action.emoji || '▶️';
            actionButton.textContent = `${emoji} ${action.name}`;
            
            // Add click handler for the action
            actionButton.addEventListener('click', () => {
                performAction(action);
            });
            
            // Add tooltip with description
            actionButton.title = action.description;
            
            actionItem.appendChild(actionButton);
            actionList.appendChild(actionItem);
        });
    }
    
    actionMenu.appendChild(actionList);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'close-button';
    closeButton.addEventListener('click', () => {
        actionMenu.remove();
        state.actionMenuVisible = false;
    });
    actionMenu.appendChild(closeButton);
    
    // Add to document
    document.body.appendChild(actionMenu);
    state.actionMenuVisible = true;
    
    // Show circular menu for the selected tile
    showCircularMenu();
}

// Create and show circular menu
function showCircularMenu() {
    // Remove any existing circular menu
    const existingMenu = document.getElementById('circular-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu container
    const circularMenu = document.createElement('div');
    circularMenu.id = 'circular-menu';
    circularMenu.className = 'edge-menu'; // Using edge-menu class
    
    // Add menu items
    const menuItems = [
        { icon: '🗣️', label: 'Language', action: showLanguageMenu },
        { icon: '🏛️', label: 'Culture', action: showCultureMenu },
        { icon: '🛠️', label: 'Crafting', action: () => console.log('Crafting clicked') },
        { icon: '🏠', label: 'Building', action: () => console.log('Building clicked') },
        { icon: '🔍', label: 'Explore', action: () => console.log('Explore clicked') }
    ];
    
    // Create menu items with icons only and tooltips
    menuItems.forEach((item) => {
        // Create menu item
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        
        // Create button with icon only
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.innerHTML = `<span class="menu-icon">${item.icon}</span>`;
        button.title = item.label; // Add native tooltip as fallback
        button.addEventListener('click', item.action);
        
        // Create tooltip label
        const tooltip = document.createElement('span');
        tooltip.className = 'menu-label';
        tooltip.textContent = item.label;
        
        // Add button and tooltip to menu item
        menuItem.appendChild(button);
        menuItem.appendChild(tooltip);
        circularMenu.appendChild(menuItem);
    });
    
    // Add to document body
    document.body.appendChild(circularMenu);
    
    // Position the menu at the left edge of the screen
    circularMenu.style.left = '20px';
    circularMenu.style.top = '100px';
}

// Show language development menu
function showLanguageMenu() {
  // Remove any existing language menu
  const existingMenu = document.getElementById('language-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create language menu container
  const languageMenu = document.createElement('div');
  languageMenu.id = 'language-menu';
  languageMenu.className = 'submenu';
  
  // Add header with close button
  const menuHeader = document.createElement('div');
  menuHeader.className = 'submenu-header';
  
  const menuTitle = document.createElement('h3');
  menuTitle.textContent = 'Language Development';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'close-submenu';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    languageMenu.remove();
  });
  
  menuHeader.appendChild(menuTitle);
  menuHeader.appendChild(closeButton);
  languageMenu.appendChild(menuHeader);
  
  // Add content
  const menuContent = document.createElement('div');
  menuContent.className = 'submenu-content';
  
  // Add loading indicator
  const loadingElement = document.createElement('div');
  loadingElement.className = 'loading-language';
  loadingElement.textContent = 'Retrieving language information...';
  menuContent.appendChild(loadingElement);
  
  languageMenu.appendChild(menuContent);
  
  // Add to document body
  document.body.appendChild(languageMenu);
  
  // Check if we have cached data that's still valid
  const now = Date.now();
  if (languageCache && (now - languageCacheTimestamp < LANGUAGE_CACHE_DURATION)) {
    // Use cached data
    console.log('Using cached language data from', new Date(languageCacheTimestamp).toLocaleTimeString());
    loadingElement.remove();
    
    if (languageCache.rawContent) {
      displayLanguageDetails(menuContent, languageCache.rawContent);
    } else {
      const errorElement = document.createElement('div');
      errorElement.className = 'evolution-error';
      errorElement.textContent = 'Error: No language data available';
      menuContent.appendChild(errorElement);
    }
    
    // Add the language evolution form
    addLanguageEvolutionForm(menuContent);
  } else {
    // Fetch fresh data
    fetchLanguageDetails(menuContent, loadingElement);
  }
}

// Function to fetch and cache language data
async function fetchAndCacheLanguageData() {
  try {
    // Check if we have a valid cache
    const now = Date.now();
    if (languageCache && (now - languageCacheTimestamp < LANGUAGE_CACHE_DURATION)) {
      console.log('Using cached language data');
      return languageCache;
    }
    
    // Get the colony name and kin name from localStorage
    const colonyName = localStorage.getItem('colonyName') || 'Your Colony';
    const kinName = localStorage.getItem('kinName') || 'defaultcolony';
    
    console.log('Fetching fresh language data for', colonyName);
    
    // Prepare the message for KinOS
    const messageContent = `
Please provide a detailed analysis of the current state of the language for the tribe "${colonyName}".

Include:
1. A summary of the language's current development stage
2. Key grammatical features that have emerged
3. A comprehensive list of known words with their meanings
4. Any cultural implications of the language development
5. Examples of typical conversations or phrases in the language with translations

Format your response in markdown for better readability, with clear headings and sections. Format the word list as a table with columns for the tribe's word and its meaning in English.

Please include at least 3 example conversations or common phrases that demonstrate how tribe members would communicate in different situations.
`;

    // Make request to KinOS
    const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        history_length: 25,
        mode: "language_analysis",
        addSystem: "You are a linguistic anthropologist analyzing the development of a tribe's language. Provide a detailed, structured analysis of their current language state, including a comprehensive word list and example conversations. Format your response in markdown with clear headings, tables for word lists, and example dialogues that show how the language is used in context."
      })
    });
    
    if (!response.ok) {
      throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Check for the content in either response or content field
    const languageContent = responseData.response || responseData.content;
    
    // Update the cache
    languageCache = {
      rawContent: languageContent
    };
    languageCacheTimestamp = now;
    
    console.log('Language data cached at', new Date(languageCacheTimestamp).toLocaleTimeString());
    return languageCache;
  } catch (error) {
    console.error('Error fetching language data:', error);
    return null;
  }
}

// Function to fetch and cache culture data
async function fetchAndCacheCultureData() {
  try {
    // Get the colony name and kin name from localStorage
    const colonyName = localStorage.getItem('colonyName') || 'Your Colony';
    const kinName = localStorage.getItem('kinName') || 'defaultcolony';
    
    console.log('Fetching culture data for', colonyName);
    
    // Prepare the message for KinOS
    const messageContent = `
Please provide a detailed analysis of the current cultural development for the tribe "${colonyName}".

Return your response as a JSON object with these properties:
- language: Current language development status (string)
- belief: Current belief system development (string)
- social: Social organization status (string)
- art: Artistic expression development (string)
- knowledge: Knowledge systems status (string)
- rituals: Ritual and ceremony development (string)
- identity: Identity and community status (string)
- laws: Rules and customs status (string)
- trade: Trade and exchange development (string)
- kinship: Kinship and relations status (string)

For each category, include:
1. A brief description of the current development stage
2. A progress value between 0-100 indicating development level
3. Next possible developments

Example format:
{
  "language": {
    "stage": "Basic Communication",
    "progress": 15,
    "description": "Simple gesture system with basic sound signals",
    "nextSteps": ["Develop consistent naming system", "Create action words"]
  },
  "belief": {
    "stage": "Natural World Beliefs",
    "progress": 10,
    "description": "Recognition of weather phenomena and animal spirits",
    "nextSteps": ["Develop creation stories", "Establish sacred places"]
  },
  ...
}
`;

    // Make request to KinOS
    const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        history_length: 25,
        mode: "culture_analysis",
        addSystem: "You are a cultural anthropologist analyzing the development of a tribe's culture. Provide a detailed, structured analysis of their current cultural state in JSON format as requested. Make sure your response is valid JSON that can be parsed directly."
      })
    });
    
    if (!response.ok) {
      throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Try to extract JSON from the response
    let cultureData = null;
    
    // Check for the content in either response or content field
    const responseContent = responseData.response || responseData.content;
    
    // Try to find JSON in the response
    try {
      // Look for JSON object pattern
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cultureData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (parseError) {
      console.error('Error parsing culture data JSON:', parseError);
      
      // Create a basic fallback object
      cultureData = {
        language: { stage: "Basic Communication", progress: 10, description: "Simple gestures and sounds", nextSteps: ["Develop more consistent signals"] },
        belief: { stage: "Natural World Beliefs", progress: 5, description: "Basic recognition of natural phenomena", nextSteps: ["Develop weather interpretations"] },
        social: { stage: "Family Units", progress: 15, description: "Simple family groupings", nextSteps: ["Establish group decision processes"] },
        art: { stage: "Body Decoration", progress: 10, description: "Simple body painting and adornment", nextSteps: ["Develop symbolic markings"] },
        knowledge: { stage: "Environmental Knowledge", progress: 20, description: "Basic understanding of local resources", nextSteps: ["Improve plant identification"] },
        rituals: { stage: "Life Cycle Rituals", progress: 5, description: "Simple birth and death observances", nextSteps: ["Develop naming rituals"] },
        identity: { stage: "Personal Identity", progress: 10, description: "Individual recognition within group", nextSteps: ["Develop group symbols"] },
        laws: { stage: "Basic Rules", progress: 15, description: "Simple resource sharing protocols", nextSteps: ["Establish conflict resolution methods"] },
        trade: { stage: "Basic Exchange", progress: 10, description: "Direct gifting and food sharing", nextSteps: ["Develop reciprocity expectations"] },
        kinship: { stage: "Family Structure", progress: 20, description: "Nuclear family units", nextSteps: ["Recognize extended family networks"] }
      };
    }
    
    // Store in localStorage for persistence
    localStorage.setItem('cultureData', JSON.stringify(cultureData));
    console.log('Culture data cached successfully');
    
    return cultureData;
  } catch (error) {
    console.error('Error fetching culture data:', error);
    return null;
  }
}

// Function to fetch language details from KinOS
async function fetchLanguageDetails(menuContent, loadingElement) {
  try {
    // Fetch and cache the language data
    const cacheData = await fetchAndCacheLanguageData();
    
    // Remove loading indicator
    loadingElement.remove();
    
    // Check if we have language content before trying to display it
    if (!cacheData || !cacheData.rawContent) {
      console.error('No language content in response data');
      const errorElement = document.createElement('div');
      errorElement.className = 'evolution-error';
      errorElement.textContent = 'Error: No language data received from server';
      menuContent.appendChild(errorElement);
    } else {
      // Display the language details
      displayLanguageDetails(menuContent, cacheData.rawContent);
    }
    
    // Also display the language evolution form
    addLanguageEvolutionForm(menuContent);
    
  } catch (error) {
    console.error('Error fetching language details:', error);
    
    // Remove loading indicator and show error
    loadingElement.remove();
    
    const errorElement = document.createElement('div');
    errorElement.className = 'evolution-error';
    errorElement.textContent = `Error: ${error.message}`;
    menuContent.appendChild(errorElement);
    
    // Still show the language evolution form even if there was an error
    addLanguageEvolutionForm(menuContent);
  }
}

// Function to display language details with markdown formatting
function displayLanguageDetails(menuContent, responseText) {
  // Create language details container
  const detailsContainer = document.createElement('div');
  detailsContainer.className = 'language-details';
  
  // Add title
  const title = document.createElement('h4');
  title.textContent = 'Current Language Status';
  detailsContainer.appendChild(title);
  
  // Create a container for the markdown content
  const markdownContainer = document.createElement('div');
  markdownContainer.className = 'markdown-content';
  
  // Convert the markdown to HTML
  const htmlContent = convertMarkdownToHtml(responseText);
  markdownContainer.innerHTML = htmlContent;
  
  // Add the markdown content to the container
  detailsContainer.appendChild(markdownContainer);
  
  // Add to menu content
  menuContent.appendChild(detailsContainer);
}

// Function to convert markdown to HTML
function convertMarkdownToHtml(markdown) {
  if (!markdown) return '';
  
  // Add a wrapper with smaller text size
  let html = `<div style="font-size: 0.9em;">${markdown}</div>`;
  
  // Handle headers
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
  html = html.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
  
  // Handle bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Handle lists - MODIFIED to prevent double line breaks between items
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
  
  // Wrap lists in <ul> or <ol> - MODIFIED to prevent double spacing
  html = html.replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n');
  html = html.replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1');
  
  // Handle tables - MODIFIED to reduce space before tables
  // First, identify table sections with less space
  const tableRegex = /^\|(.*)\|\s*\n\|([-:| ]*)\|\s*\n(\|.*\|\s*\n)+/gm;
  html = html.replace(tableRegex, function(match) {
    // Process the table
    const lines = match.split('\n').filter(line => line.trim() !== '');
    
    // Extract headers
    const headerLine = lines[0];
    const headers = headerLine.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
    
    // Skip the separator line (line with dashes)
    
    // Process data rows
    const rows = lines.slice(2).map(line => {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      return cells;
    });
    
    // Build HTML table with reduced margins
    let tableHtml = '<table class="markdown-table" style="margin-top: 0.5em; margin-bottom: 0.5em;">\n<thead>\n<tr>\n';
    
    // Add headers
    headers.forEach(header => {
      tableHtml += `<th>${header}</th>\n`;
    });
    
    tableHtml += '</tr>\n</thead>\n<tbody>\n';
    
    // Add rows
    rows.forEach(row => {
      tableHtml += '<tr>\n';
      row.forEach(cell => {
        tableHtml += `<td>${cell}</td>\n`;
      });
      tableHtml += '</tr>\n';
    });
    
    tableHtml += '</tbody>\n</table>';
    
    return tableHtml;
  });
  
  // Handle paragraphs
  html = html.replace(/^([^<].*)\n$/gm, '<p>$1</p>');
  
  // Handle line breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// This function is no longer needed as we're using the markdown converter instead

// Function to add the language evolution form
function addLanguageEvolutionForm(menuContent) {
  // Check if we have language development data in localStorage
  const languageData = localStorage.getItem('languageDevelopment');
  
  // Create the evolution form
  const evolutionForm = document.createElement('div');
  evolutionForm.className = 'language-evolution-form';
  evolutionForm.innerHTML = `
    <h4>Evolve Your Language</h4>
    <p>Describe how you want your language to develop next:</p>
    <textarea id="language-evolution-input" rows="4" placeholder="Example: I want to develop more complex verbs to describe hunting activities..."></textarea>
    <button id="evolve-language-button">Evolve Language</button>
    <div id="language-evolution-loading" class="hidden">Processing language evolution...</div>
  `;
  menuContent.appendChild(evolutionForm);
  
  // Add event listener for the evolve button
  setTimeout(() => {
    const evolveButton = document.getElementById('evolve-language-button');
    if (evolveButton) {
      evolveButton.addEventListener('click', evolveLanguage);
    }
  }, 0);
}

// Function to handle language evolution
async function evolveLanguage() {
  const inputElement = document.getElementById('language-evolution-input');
  const loadingElement = document.getElementById('language-evolution-loading');
  const evolveButton = document.getElementById('evolve-language-button');
  
  if (!inputElement || !loadingElement || !evolveButton) {
    console.error('Required elements not found');
    return;
  }
  
  const evolutionDescription = inputElement.value.trim();
  
  if (!evolutionDescription) {
    alert('Please describe how you want your language to evolve.');
    return;
  }
  
  // Show loading, disable button
  loadingElement.classList.remove('hidden');
  evolveButton.disabled = true;
  
  try {
    // Get current language data if it exists
    let currentLanguage = {};
    const storedData = localStorage.getItem('languageDevelopment');
    if (storedData) {
      currentLanguage = JSON.parse(storedData);
    }
    
    // Get the colony name
    const colonyName = localStorage.getItem('colonyName') || 'Your Colony';
    
    // Prepare the message for KinOS
    const messageContent = `
I want to evolve the language of my tribe "${colonyName}".

Current language state:
${currentLanguage.stage ? `Stage: ${currentLanguage.stage}` : 'No formal language yet'}
${currentLanguage.vocabulary ? `Vocabulary: ${currentLanguage.vocabulary}` : ''}
${currentLanguage.features ? `Features: ${currentLanguage.features}` : ''}

My desired evolution: ${evolutionDescription}

Please provide:
1. An updated description of the language stage
2. New vocabulary that has developed
3. New grammatical or structural features
4. A brief narrative about how this language change affects the tribe's culture
`;

    // Make request to KinOS
    const response = await fetch('http://localhost:3000/api/kinos/kins/defaultcolony/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        history_length: 25,
        mode: "language_evolution",
        addSystem: "You are a linguistic anthropologist helping to develop a realistic language evolution for a prehistoric tribe. Provide plausible, historically grounded language developments based on the user's request."
      })
    });
    
    if (!response.ok) {
      throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Parse the response
    const evolutionResults = parseLanguageEvolution(responseData.response);
    
    // Update stored language data
    const updatedLanguage = {
      ...currentLanguage,
      ...evolutionResults,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('languageDevelopment', JSON.stringify(updatedLanguage));
    
    // Display results
    showEvolutionResults(evolutionResults);
    
    // Invalidate the language cache so we'll fetch fresh data next time
    languageCache = null;
    languageCacheTimestamp = 0;
    
  } catch (error) {
    console.error('Error evolving language:', error);
    
    // Show error in the menu
    const menuContent = document.querySelector('.submenu-content');
    if (menuContent) {
      const errorElement = document.createElement('div');
      errorElement.className = 'evolution-error';
      errorElement.textContent = `Error: ${error.message}`;
      menuContent.appendChild(errorElement);
    }
  } finally {
    // Hide loading, enable button
    loadingElement.classList.add('hidden');
    evolveButton.disabled = false;
  }
}

// Show culture development menu
function showCultureMenu() {
  // Remove any existing culture menu
  const existingMenu = document.getElementById('culture-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create culture menu container
  const cultureMenu = document.createElement('div');
  cultureMenu.id = 'culture-menu';
  cultureMenu.className = 'submenu';
  
  // Add header with close button
  const menuHeader = document.createElement('div');
  menuHeader.className = 'submenu-header';
  
  const menuTitle = document.createElement('h3');
  menuTitle.textContent = 'Cultural Development';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'close-submenu';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    cultureMenu.remove();
  });
  
  menuHeader.appendChild(menuTitle);
  menuHeader.appendChild(closeButton);
  cultureMenu.appendChild(menuHeader);
  
  // Add content
  const menuContent = document.createElement('div');
  menuContent.className = 'submenu-content';
  
  // Add loading indicator
  const loadingElement = document.createElement('div');
  loadingElement.className = 'loading-language';
  loadingElement.textContent = 'Retrieving cultural information...';
  menuContent.appendChild(loadingElement);
  
  cultureMenu.appendChild(menuContent);
  
  // Add to document body
  document.body.appendChild(cultureMenu);
  
  // Try to get culture data from localStorage
  const cultureDataJSON = localStorage.getItem('cultureData');
  
  if (cultureDataJSON) {
    try {
      const cultureData = JSON.parse(cultureDataJSON);
      loadingElement.remove();
      displayCultureDetails(menuContent, cultureData);
    } catch (error) {
      console.error('Error parsing cached culture data:', error);
      // Fetch fresh data if parsing fails
      fetchCultureDetails(menuContent, loadingElement);
    }
  } else {
    // No cached data, fetch fresh data
    fetchCultureDetails(menuContent, loadingElement);
  }
}

// Function to fetch culture details
async function fetchCultureDetails(menuContent, loadingElement) {
  try {
    // Fetch and cache the culture data
    const cultureData = await fetchAndCacheCultureData();
    
    // Remove loading indicator
    loadingElement.remove();
    
    // Check if we have culture data before trying to display it
    if (!cultureData) {
      console.error('No culture data received');
      const errorElement = document.createElement('div');
      errorElement.className = 'evolution-error';
      errorElement.textContent = 'Error: No cultural data received from server';
      menuContent.appendChild(errorElement);
    } else {
      // Display the culture details
      displayCultureDetails(menuContent, cultureData);
    }
  } catch (error) {
    console.error('Error fetching culture details:', error);
    
    // Remove loading indicator and show error
    loadingElement.remove();
    
    const errorElement = document.createElement('div');
    errorElement.className = 'evolution-error';
    errorElement.textContent = `Error: ${error.message}`;
    menuContent.appendChild(errorElement);
  }
}

// Function to display culture details
function displayCultureDetails(menuContent, cultureData) {
  // Create culture overview container
  const overviewContainer = document.createElement('div');
  overviewContainer.className = 'culture-overview';
  
  // Add title
  const title = document.createElement('h4');
  title.textContent = 'Cultural Development Overview';
  overviewContainer.appendChild(title);
  
  // Create culture categories grid
  const categoriesGrid = document.createElement('div');
  categoriesGrid.className = 'culture-categories-grid';
  
  // Define the categories and their icons
  const categories = [
    { key: 'language', name: 'Language', icon: '🗣️' },
    { key: 'belief', name: 'Belief Systems', icon: '🌟' },
    { key: 'social', name: 'Social Organization', icon: '👥' },
    { key: 'art', name: 'Artistic Expression', icon: '🎨' },
    { key: 'knowledge', name: 'Knowledge Systems', icon: '📚' },
    { key: 'rituals', name: 'Rituals & Ceremonies', icon: '🔮' },
    { key: 'identity', name: 'Identity & Community', icon: '🏛️' },
    { key: 'laws', name: 'Rules & Customs', icon: '⚖️' },
    { key: 'trade', name: 'Trade & Exchange', icon: '🔄' },
    { key: 'kinship', name: 'Kinship & Relations', icon: '👪' }
  ];
  
  // Add each category to the grid
  categories.forEach(category => {
    const categoryData = cultureData[category.key];
    
    if (!categoryData) {
      console.warn(`No data found for category: ${category.key}`);
      return;
    }
    
    const categoryCard = document.createElement('div');
    categoryCard.className = 'culture-category-card';
    categoryCard.dataset.category = category.key;
    
    // Add header with icon and name
    const cardHeader = document.createElement('div');
    cardHeader.className = 'category-header';
    
    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.textContent = category.icon;
    
    const name = document.createElement('h5');
    name.className = 'category-name';
    name.textContent = category.name;
    
    cardHeader.appendChild(icon);
    cardHeader.appendChild(name);
    categoryCard.appendChild(cardHeader);
    
    // Add stage
    const stage = document.createElement('div');
    stage.className = 'category-stage';
    stage.textContent = categoryData.stage || 'Not developed';
    categoryCard.appendChild(stage);
    
    // Add progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'category-progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'category-progress-bar';
    progressBar.style.width = `${categoryData.progress || 0}%`;
    progressBar.textContent = `${categoryData.progress || 0}%`;
    
    progressContainer.appendChild(progressBar);
    categoryCard.appendChild(progressContainer);
    
    // Add click handler to show details
    categoryCard.addEventListener('click', () => {
      showCultureCategoryDetails(category, categoryData);
    });
    
    // Add to grid
    categoriesGrid.appendChild(categoryCard);
  });
  
  overviewContainer.appendChild(categoriesGrid);
  menuContent.appendChild(overviewContainer);
  
  // Add development options section
  const developmentSection = document.createElement('div');
  developmentSection.className = 'culture-development-section';
  
  const developmentTitle = document.createElement('h4');
  developmentTitle.textContent = 'Develop Your Culture';
  developmentSection.appendChild(developmentTitle);
  
  const developmentText = document.createElement('p');
  developmentText.textContent = 'Select a cultural category above to view details and development options.';
  developmentSection.appendChild(developmentText);
  
  menuContent.appendChild(developmentSection);
}

// Function to show details for a specific culture category
function showCultureCategoryDetails(category, categoryData) {
  // Remove any existing details panel
  const existingPanel = document.getElementById('culture-category-details');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Create details panel
  const detailsPanel = document.createElement('div');
  detailsPanel.id = 'culture-category-details';
  detailsPanel.className = 'culture-category-details';
  
  // Add header
  const header = document.createElement('div');
  header.className = 'details-header';
  
  const title = document.createElement('h4');
  title.innerHTML = `${category.icon} ${category.name}`;
  
  const closeButton = document.createElement('button');
  closeButton.className = 'close-details';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    detailsPanel.remove();
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  detailsPanel.appendChild(header);
  
  // Add current status
  const statusSection = document.createElement('div');
  statusSection.className = 'details-section';
  
  const statusTitle = document.createElement('h5');
  statusTitle.textContent = 'Current Status';
  
  const stageInfo = document.createElement('div');
  stageInfo.className = 'stage-info';
  stageInfo.innerHTML = `<strong>Stage:</strong> ${categoryData.stage || 'Not developed'}`;
  
  const progressInfo = document.createElement('div');
  progressInfo.className = 'progress-info';
  
  const progressContainer = document.createElement('div');
  progressContainer.className = 'category-progress-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'category-progress-bar';
  progressBar.style.width = `${categoryData.progress || 0}%`;
  progressBar.textContent = `${categoryData.progress || 0}%`;
  
  progressContainer.appendChild(progressBar);
  progressInfo.appendChild(progressContainer);
  
  const description = document.createElement('p');
  description.className = 'category-description';
  description.textContent = categoryData.description || 'No description available.';
  
  statusSection.appendChild(statusTitle);
  statusSection.appendChild(stageInfo);
  statusSection.appendChild(progressInfo);
  statusSection.appendChild(description);
  detailsPanel.appendChild(statusSection);
  
  // Add next steps section
  const nextStepsSection = document.createElement('div');
  nextStepsSection.className = 'details-section';
  
  const nextStepsTitle = document.createElement('h5');
  nextStepsTitle.textContent = 'Development Options';
  
  nextStepsSection.appendChild(nextStepsTitle);
  
  if (categoryData.nextSteps && categoryData.nextSteps.length > 0) {
    const stepsList = document.createElement('ul');
    stepsList.className = 'next-steps-list';
    
    categoryData.nextSteps.forEach(step => {
      const stepItem = document.createElement('li');
      
      const stepButton = document.createElement('button');
      stepButton.className = 'development-button';
      stepButton.textContent = step;
      stepButton.addEventListener('click', () => {
        developCultureCategory(category.key, step);
      });
      
      stepItem.appendChild(stepButton);
      stepsList.appendChild(stepItem);
    });
    
    nextStepsSection.appendChild(stepsList);
  } else {
    const noSteps = document.createElement('p');
    noSteps.className = 'no-steps';
    noSteps.textContent = 'No development options available at this time.';
    nextStepsSection.appendChild(noSteps);
  }
  
  detailsPanel.appendChild(nextStepsSection);
  
  // Add to document body
  document.body.appendChild(detailsPanel);
  
  // Position the panel
  const cultureMenu = document.getElementById('culture-menu');
  if (cultureMenu) {
    const menuRect = cultureMenu.getBoundingClientRect();
    detailsPanel.style.top = `${menuRect.top}px`;
    detailsPanel.style.left = `${menuRect.right + 20}px`;
  }
}

// Function to develop a culture category
async function developCultureCategory(categoryKey, developmentOption) {
  try {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Developing culture...';
    document.body.appendChild(loadingIndicator);
    
    // Get the colony name and kin name from localStorage
    const colonyName = localStorage.getItem('colonyName') || 'Your Colony';
    const kinName = localStorage.getItem('kinName') || 'defaultcolony';
    
    // Get current culture data
    const cultureDataJSON = localStorage.getItem('cultureData');
    const cultureData = cultureDataJSON ? JSON.parse(cultureDataJSON) : {};
    
    // Prepare the message for KinOS
    const messageContent = `
I want to develop the ${categoryKey} aspect of my tribe "${colonyName}" by focusing on: "${developmentOption}".

Current cultural state:
${JSON.stringify(cultureData, null, 2)}

Please update the cultural data to reflect this development. Return the complete updated culture data as a JSON object with the same structure, showing how this development affects the ${categoryKey} category and potentially other related categories.

Make sure the progress values increase appropriately and new nextSteps are provided where relevant.
`;

    // Make request to KinOS
    const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: messageContent,
        model: "claude-3-7-sonnet-latest",
        history_length: 25,
        mode: "culture_development",
        addSystem: "You are a cultural anthropologist helping to develop a realistic cultural evolution for a prehistoric tribe. Update the cultural data based on the user's development choice, providing a plausible progression. Return only valid JSON that matches the original structure but with updated values."
      })
    });
    
    if (!response.ok) {
      throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // Try to extract JSON from the response
    let updatedCultureData = null;
    
    // Check for the content in either response or content field
    const responseContent = responseData.response || responseData.content;
    
    // Try to find JSON in the response
    try {
      // Look for JSON object pattern
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        updatedCultureData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (parseError) {
      console.error('Error parsing updated culture data JSON:', parseError);
      throw new Error('Failed to parse culture development response');
    }
    
    // Store updated culture data
    localStorage.setItem('cultureData', JSON.stringify(updatedCultureData));
    
    // Remove loading indicator
    loadingIndicator.remove();
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = `Successfully developed ${categoryKey}: ${developmentOption}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 5000);
    
    // Refresh the culture menu
    const existingMenu = document.getElementById('culture-menu');
    if (existingMenu) {
      const menuContent = existingMenu.querySelector('.submenu-content');
      if (menuContent) {
        menuContent.innerHTML = '';
        displayCultureDetails(menuContent, updatedCultureData);
      }
    }
    
    // Close the details panel
    const detailsPanel = document.getElementById('culture-category-details');
    if (detailsPanel) {
      detailsPanel.remove();
    }
    
    return updatedCultureData;
  } catch (error) {
    console.error('Error developing culture category:', error);
    
    // Remove loading indicator if it exists
    const loadingIndicator = document.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
    
    // Show error notification
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.textContent = `Error developing culture: ${error.message}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 5000);
    
    return null;
  }
}

// Parse language evolution response
function parseLanguageEvolution(responseText) {
  try {
    // Try to find JSON in the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON, parse the text format
    const result = {
      stage: '',
      vocabulary: '',
      features: '',
      narrative: ''
    };
    
    // Extract stage
    const stageMatch = responseText.match(/Stage:([^\n]*)/i);
    if (stageMatch) {
      result.stage = stageMatch[1].trim();
    }
    
    // Extract vocabulary
    const vocabMatch = responseText.match(/Vocabulary:([^\n]*)/i);
    if (vocabMatch) {
      result.vocabulary = vocabMatch[1].trim();
    }
    
    // Extract features
    const featuresMatch = responseText.match(/Features:([^\n]*)/i);
    if (featuresMatch) {
      result.features = featuresMatch[1].trim();
    }
    
    // Extract narrative
    const narrativeMatch = responseText.match(/Narrative:([\s\S]*?)(?=\n\n|$)/i);
    if (narrativeMatch) {
      result.narrative = narrativeMatch[1].trim();
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing language evolution:', error);
    return {
      stage: 'Unknown',
      vocabulary: 'Error parsing response',
      features: 'Error parsing response',
      narrative: 'There was an error processing the language evolution.'
    };
  }
}

// Show evolution results
function showEvolutionResults(results) {
  // Remove any existing results
  const existingResults = document.querySelector('.evolution-results');
  if (existingResults) {
    existingResults.remove();
  }
  
  // Create results container
  const resultsElement = document.createElement('div');
  resultsElement.className = 'evolution-results';
  
  // Add content
  resultsElement.innerHTML = `
    <h4>Language Evolution Results</h4>
    
    <div class="evolution-section">
      <h5>New Language Stage</h5>
      <p>${results.stage || 'Basic communication'}</p>
    </div>
    
    <div class="evolution-section">
      <h5>Vocabulary Development</h5>
      <p>${results.vocabulary || 'No specific vocabulary developed'}</p>
    </div>
    
    <div class="evolution-section">
      <h5>Grammatical Features</h5>
      <p>${results.features || 'Simple language structure'}</p>
    </div>
    
    ${results.narrative ? `
    <div class="evolution-narrative">
      <h5>Cultural Impact</h5>
      <p>${results.narrative}</p>
    </div>
    ` : ''}
    
    <div class="evolution-success">
      Language successfully evolved!
    </div>
  `;
  
  // Add to the menu
  const menuContent = document.querySelector('.submenu-content');
  if (menuContent) {
    menuContent.appendChild(resultsElement);
    
    // Scroll to show results
    resultsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}


// Send a message to KinOS about an action
async function sendKinOSMessage(action, terrainInfo) {
  try {
    console.log(`Sending action "${action.name}" to KinOS with terrain info:`, terrainInfo);
    
    // Prepare the message content with explicit JSON request
    const messageContent = `
I am attempting to perform the action "${action.name}" (${action.code}) on terrain type: ${terrainInfo.terrainCode}.

Terrain Description: ${terrainInfo.description || 'No description available'}

Action Description: ${action.description || 'No description available'}

Please provide guidance on how this action might unfold in this environment, any challenges I might face, and potential outcomes. 

IMPORTANT: Format your response as a JSON object with these sections:
1. "analysis": A brief analysis of the action in this terrain (2-3 sentences)
2. "narration": A vivid, single paragraph description (5-8 sentences) of the settlers performing this action
3. "outcomes": Object containing:
   - "resources": Array of resources that might be gained
   - "knowledge": Array of knowledge or skills acquired
   - "challenges": Array of challenges faced
4. "tips": Array of practical tips for success

Example response format:
{
  "analysis": "This terrain is well-suited for gathering berries due to the abundant bushes and rich soil. The flat terrain makes movement easy, and the nearby water source supports diverse plant life.",
  "narration": "Your settlers spread out among the berry bushes, carefully selecting the ripest fruits while watching for thorns. The morning dew still clings to the leaves, making the berries glisten in the early light. Children join the work, learning which colors indicate the sweetest harvest, while the more experienced gatherers fill their baskets with practiced efficiency.",
  "outcomes": {
    "resources": ["Wild berries (2-3 days worth)", "Berry seeds for planting", "Medicinal leaves from berry bushes"],
    "knowledge": ["Identification of berry varieties", "Seasonal ripening patterns", "Preservation techniques"],
    "challenges": ["Thorny bushes causing minor injuries", "Competition with wildlife", "Need for proper storage"]
  },
  "tips": [
    "Focus on bushes with the most ripe berries rather than checking every plant",
    "Harvest in early morning when berries are firmest",
    "Leave some berries on each bush to ensure future growth",
    "Use leather gloves to protect hands from thorns"
  ]
}

Please provide ONLY the JSON response with no additional text, markdown formatting, or explanation.
`;

    // Prepare the request body with updated blueprint, kin, and mode
    const requestBody = {
      content: messageContent,
      model: "claude-3-7-sonnet-latest",
      history_length: 25,
      mode: "action_resolution", 
      addSystem: "You are a helpful game assistant providing realistic and immersive guidance on actions taken in a settlement-building game. Consider the terrain, available resources, and potential challenges when describing outcomes. Be specific and vivid in your descriptions. Format your response ONLY as a valid JSON object with the exact structure requested by the user. Do not include any text outside the JSON object."
    };
    
    // Make the API request with updated blueprint and kin
    const response = await fetch('http://localhost:3000/api/kinos/kins/defaultcolony/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('KinOS response:', responseData);
    
    // Check if we have a response field (new format) or content field (old format)
    const content = responseData.response || responseData.content;
    
    if (!content) {
      throw new Error('No content in KinOS response');
    }
    
    // Try to parse the JSON from the response
    let parsedResponse;
    try {
      // Look for JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, use the parseActionResponse function as fallback
        parsedResponse = parseActionResponse(content);
      }
      
      // If we have a narration, send it for TTS
      if (parsedResponse.narration) {
        // Generate TTS for the narration
        try {
          const ttsResponse = await fetch(`${config.serverUrl}/api/data/actions/ai/tts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: parsedResponse.narration
            })
          });
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json();
            parsedResponse.audio = ttsData;
          }
        } catch (ttsError) {
          console.error('Error generating TTS for narration:', ttsError);
        }
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Error parsing KinOS response as JSON:', parseError);
      console.log('Raw response:', content);
      
      // Return the raw content as fallback
      return { 
        content: content,
        parseError: parseError.message
      };
    }
  } catch (error) {
    console.error('Error sending message to KinOS:', error);
    return { error: error.message };
  }
}


// Handle performing an action
async function performAction(action) {
    console.log(`Performing action: ${action.name} (${action.code})`);
    
    // Show a loading notification
    const loadingNotification = document.createElement('div');
    loadingNotification.className = 'notification';
    loadingNotification.textContent = `Performing: ${action.name}...`;
    document.body.appendChild(loadingNotification);
    
    // Create a dialog with progress bar
    const progressDialog = document.createElement('div');
    progressDialog.className = 'dialog';
    progressDialog.innerHTML = `
        <div class="dialog-content">
            <h2>${action.name}</h2>
            <p>Performing action, please wait...</p>
            
            <div class="action-progress-text">Time remaining: <span id="progress-time">20</span> seconds</div>
            <div class="action-progress-container">
                <div class="action-progress-bar" id="action-progress-bar">0%</div>
            </div>
            
            <div id="action-result-container" style="display: none;">
                <div class="action-response structured-response" id="action-response">
                    <p>Processing your action...</p>
                </div>
            </div>
            
            <button class="close-button" style="display: none;" id="action-close-button">Close</button>
        </div>
    `;
    document.body.appendChild(progressDialog);
    
    // Set up progress bar animation
    const progressBar = document.getElementById('action-progress-bar');
    const progressTime = document.getElementById('progress-time');
    const resultContainer = document.getElementById('action-result-container');
    const closeButton = document.getElementById('action-close-button');
    const responseContainer = document.getElementById('action-response');
    
    // Initialize progress variables
    let progress = 0;
    let timeRemaining = 20;
    let progressInterval;
    let timeInterval;
    let actionCompleted = false;
    
    // Start progress bar animation
    progressInterval = setInterval(() => {
        progress += 1;
        progressBar.style.width = `${progress * 5}%`;
        progressBar.textContent = `${progress * 5}%`;
        
        if (progress >= 20) {
            clearInterval(progressInterval);
            if (!actionCompleted) {
                // If the action hasn't completed yet, show a timeout message
                responseContainer.innerHTML = `<p>The action is taking longer than expected. Results will appear when ready.</p>`;
                resultContainer.style.display = 'block';
            }
        }
    }, 1000);
    
    // Update time remaining
    timeInterval = setInterval(() => {
        timeRemaining -= 1;
        progressTime.textContent = timeRemaining;
        
        if (timeRemaining <= 0) {
            clearInterval(timeInterval);
        }
    }, 1000);
    
    try {
        // Get the terrain information for the selected tile
        const tileX = parseInt(state.selectedTile.dataset.x);
        const tileY = parseInt(state.selectedTile.dataset.y);
        
        // Fetch terrain info
        const response = await fetch(`${config.serverUrl}/api/tiles/islands/${tileX}/${tileY}/info`);
        const terrainInfo = await response.json();
        
        if (!terrainInfo.exists) {
            throw new Error('Cannot perform action: terrain information not available');
        }
        
        // Send the action to KinOS
        const kinOSResponse = await sendKinOSMessage(action, terrainInfo);
        
        // Action is complete
        actionCompleted = true;
        
        // Remove the loading notification
        loadingNotification.remove();
        
        if (kinOSResponse.error) {
            // Show error in the dialog
            responseContainer.innerHTML = `<p class="error-message">Error: ${kinOSResponse.error}</p>`;
            resultContainer.style.display = 'block';
            closeButton.style.display = 'block';
            return;
        }
        
        // If we have audio, play it
        if (kinOSResponse.audio && kinOSResponse.audio.audio_url) {
            playNarration(kinOSResponse.audio);
        }
        
        // Format the response based on whether it's the new JSON format or the old format
        let formattedResponse;
        
        if (kinOSResponse.narration && kinOSResponse.analysis) {
            // It's the new JSON format
            formattedResponse = formatJSONResponse(kinOSResponse);
        } else if (kinOSResponse.content) {
            // It's the old format with raw content
            const parsedResponse = parseActionResponse(kinOSResponse.content);
            formattedResponse = formatStructuredResponse(parsedResponse);
        } else {
            // Unexpected format, try to handle it gracefully
            formattedResponse = formatStructuredResponse(kinOSResponse);
        }
        
        // Show the formatted response in the dialog
        responseContainer.innerHTML = formattedResponse;
        resultContainer.style.display = 'block';
        closeButton.style.display = 'block';
        
        // Clear the progress intervals if they're still running
        clearInterval(progressInterval);
        clearInterval(timeInterval);
        
        // Update progress bar to 100%
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressTime.textContent = '0';
        
    } catch (error) {
        console.error('Error performing action:', error);
        
        // Remove the loading notification
        loadingNotification.remove();
        
        // Show error in the dialog
        responseContainer.innerHTML = `<p class="error-message">Error performing action: ${error.message}</p>`;
        resultContainer.style.display = 'block';
        closeButton.style.display = 'block';
        
        // Clear the progress intervals if they're still running
        clearInterval(progressInterval);
        clearInterval(timeInterval);
    }
    
    // Add close functionality
    closeButton.addEventListener('click', () => {
        progressDialog.remove();
        
        // Clear any remaining intervals just in case
        clearInterval(progressInterval);
        clearInterval(timeInterval);
    });
}

// Parse the action response from KinOS into a structured format
function parseActionResponse(responseText) {
    try {
        // Check if responseText is undefined or null
        if (!responseText) {
            return { fullText: "No response received from KinOS." };
        }
        
        console.log("Raw response text:", responseText);
        
        // First try to find a JSON object in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Found JSON-like content but couldn't parse it:", e);
                // Continue with other parsing methods
            }
        }
        
        const sections = {};
        
        // Extract the title (if present)
        const titleMatch = responseText.match(/# ([^\n]+)/);
        if (titleMatch) {
            sections.title = titleMatch[1].trim();
        }
        
        // Extract Action Analysis section
        const analysisMatch = responseText.match(/## Action Analysis\s*\n([\s\S]*?)(?=##|$)/i);
        if (analysisMatch) {
            sections.analysis = analysisMatch[1].trim();
        }
        
        // Extract Narration section
        const narrationMatch = responseText.match(/## Narration\s*\n([\s\S]*?)(?=##|$)/i);
        if (narrationMatch) {
            sections.narration = narrationMatch[1].trim();
        }
        
        // Extract Expected Outcomes section
        const outcomesMatch = responseText.match(/## Expected Outcomes\s*\n([\s\S]*?)(?=##|$)/i);
        if (outcomesMatch) {
            sections.outcomes = outcomesMatch[1].trim();
            
            // Try to further parse resources, knowledge, and challenges
            const resourcesMatch = sections.outcomes.match(/\*\*Resources Gained:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
            if (resourcesMatch) {
                sections.resources = resourcesMatch[1].trim();
            }
            
            const knowledgeMatch = sections.outcomes.match(/\*\*Knowledge Opportunities:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
            if (knowledgeMatch) {
                sections.knowledge = knowledgeMatch[1].trim();
            }
            
            const challengesMatch = sections.outcomes.match(/\*\*Challenges:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
            if (challengesMatch) {
                sections.challenges = challengesMatch[1].trim();
            }
        }
        
        // Extract Tips section
        const tipsMatch = responseText.match(/## Tips for Success\s*\n([\s\S]*?)(?=##|$)/i);
        if (tipsMatch) {
            sections.tips = tipsMatch[1].trim();
        }
        
        // If we couldn't parse structured sections, use the full text
        if (Object.keys(sections).length <= 1) {
            // Try to apply some basic formatting to the full text
            const formattedText = responseText
                .replace(/\n\n/g, '<br><br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
                
            sections.fullText = formattedText;
        }
        
        return sections;
    } catch (error) {
        console.error('Error parsing action response:', error);
        return { fullText: responseText || "Error parsing response" };
    }
}

// Format the structured response as HTML
function formatStructuredResponse(parsedResponse) {
    // If we have the full text only, just return it with line breaks
    if (parsedResponse.fullText && Object.keys(parsedResponse).length === 1) {
        return parsedResponse.fullText;
    }
    
    let html = '';
    
    // Add each section with appropriate formatting
    if (parsedResponse.analysis) {
        html += `<div class="response-section">
            <h3>Analysis</h3>
            <div class="section-content">${parsedResponse.analysis.replace(/\n/g, '<br>')}</div>
        </div>`;
    }
    
    if (parsedResponse.narration) {
        html += `<div class="response-section narrative">
            <h3>Narration</h3>
            <div class="section-content">${parsedResponse.narration.replace(/\n/g, '<br>')}</div>
        </div>`;
    }
    
    // Resources section with special formatting
    if (parsedResponse.resources) {
        html += `<div class="response-section resources">
            <h3>Resources Gained</h3>
            <div class="section-content">
                <ul>
                    ${parsedResponse.resources.split('\n').map(item => 
                        `<li>${item.replace(/^- /, '')}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Knowledge section
    if (parsedResponse.knowledge) {
        html += `<div class="response-section knowledge">
            <h3>Knowledge Opportunities</h3>
            <div class="section-content">
                <ul>
                    ${parsedResponse.knowledge.split('\n').map(item => 
                        `<li>${item.replace(/^- /, '')}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Challenges section
    if (parsedResponse.challenges) {
        html += `<div class="response-section challenges">
            <h3>Challenges</h3>
            <div class="section-content">
                <ul>
                    ${parsedResponse.challenges.split('\n').map(item => 
                        `<li>${item.replace(/^- /, '')}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Tips section
    if (parsedResponse.tips) {
        html += `<div class="response-section tips">
            <h3>Tips for Success</h3>
            <div class="section-content">
                <ol>
                    ${parsedResponse.tips.split('\n').map(item => {
                        // Extract the number and text
                        const match = item.match(/(\d+)\.\s+(.*)/);
                        if (match) {
                            return `<li>${match[2]}</li>`;
                        } else {
                            return `<li>${item.replace(/^- /, '')}</li>`;
                        }
                    }).join('')}
                </ol>
            </div>
        </div>`;
    }
    
    // If no structured sections were found, display the full text
    if (html === '') {
        html = `<div class="response-section">
            <div class="section-content">${parsedResponse.fullText || responseText}</div>
        </div>`;
    }
    
    return html;
}

// Add a new function to format the JSON response
function formatJSONResponse(response) {
    let html = '';
    
    // Analysis section
    if (response.analysis) {
        html += `<div class="response-section">
            <h3>Analysis</h3>
            <div class="section-content">${response.analysis.replace(/\n/g, '<br>')}</div>
        </div>`;
    }
    
    // Narration section
    if (response.narration) {
        html += `<div class="response-section narrative">
            <h3>Narration</h3>
            <div class="section-content">${response.narration.replace(/\n/g, '<br>')}</div>
        </div>`;
    }
    
    // Resources section
    if (response.outcomes && response.outcomes.resources && response.outcomes.resources.length > 0) {
        html += `<div class="response-section resources">
            <h3>Resources Gained</h3>
            <div class="section-content">
                <ul>
                    ${response.outcomes.resources.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Knowledge section
    if (response.outcomes && response.outcomes.knowledge && response.outcomes.knowledge.length > 0) {
        html += `<div class="response-section knowledge">
            <h3>Knowledge Opportunities</h3>
            <div class="section-content">
                <ul>
                    ${response.outcomes.knowledge.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Challenges section
    if (response.outcomes && response.outcomes.challenges && response.outcomes.challenges.length > 0) {
        html += `<div class="response-section challenges">
            <h3>Challenges</h3>
            <div class="section-content">
                <ul>
                    ${response.outcomes.challenges.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>`;
    }
    
    // Tips section
    if (response.tips && response.tips.length > 0) {
        html += `<div class="response-section tips">
            <h3>Tips for Success</h3>
            <div class="section-content">
                <ol>
                    ${response.tips.map(item => `<li>${item}</li>`).join('')}
                </ol>
            </div>
        </div>`;
    }
    
    return html;
}

// Set up event listeners
function setupEventListeners() {
    // Mouse drag events - attach to document instead of worldContainer
    document.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile - attach to document instead of worldContainer
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Mouse wheel zoom
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    // Window resize
    window.addEventListener('resize', handleResize);
    
    // Add context menu event listener to the document
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Prevent default browser context menu
        
        // Check if right-click was on a tile
        const tileElement = e.target.closest('.tile');
        if (tileElement) {
            showContextMenu(e.clientX, e.clientY, tileElement);
        } else {
            hideContextMenu();
        }
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        // Don't hide if clicking on the menu itself
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
        
        // Don't hide edge menu since it should always be visible
        // Only hide submenus when clicking outside
        if (!e.target.closest('.submenu') && !e.target.closest('.edge-menu')) {
            const languageMenu = document.getElementById('language-menu');
            if (languageMenu) {
                languageMenu.remove();
            }
        }
    });
    
    // Hide context menu when scrolling
    document.addEventListener('wheel', () => {
        hideContextMenu();
    });
    
    // Hide context menu when window is resized
    window.addEventListener('resize', () => {
        hideContextMenu();
    });
    
    // Burger menu functionality
    const burgerMenuIcon = document.getElementById('burger-menu-icon');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuButton = document.getElementById('close-menu');

    // Open menu when burger icon is clicked
    burgerMenuIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the click from being handled by document click handler
        sideMenu.classList.add('visible');
        console.log('Burger menu clicked, adding visible class');
    });

    // Close menu when close button is clicked
    closeMenuButton.addEventListener('click', () => {
        sideMenu.classList.remove('visible');
        console.log('Close menu clicked, removing visible class');
    });

    // Close menu when clicking outside of it
    document.addEventListener('click', (e) => {
        if (sideMenu.classList.contains('visible') && 
            !sideMenu.contains(e.target) && 
            !burgerMenuIcon.contains(e.target)) {
            sideMenu.classList.remove('visible');
            console.log('Clicked outside menu, removing visible class');
        }
    });

    // Menu button functionality
    document.getElementById('menu-reset-view').addEventListener('click', () => {
        resetView();
        sideMenu.classList.remove('visible');
    });

    document.getElementById('menu-toggle-music').addEventListener('click', () => {
        const isMuted = audioPlayer.toggleMute();
        document.getElementById('menu-toggle-music').textContent = isMuted ? 'Enable Music' : 'Disable Music';
        sideMenu.classList.remove('visible');
    });
    
    // Add restart music button
    const restartMusicButton = document.createElement('button');
    restartMusicButton.id = 'menu-restart-music';
    restartMusicButton.textContent = 'Restart Music';
    restartMusicButton.addEventListener('click', () => {
        audioPlayer.restartMusic();
        sideMenu.classList.remove('visible');
    });
    document.querySelector('#side-menu .menu-content ul').appendChild(document.createElement('li')).appendChild(restartMusicButton);

    document.getElementById('menu-toggle-debug').addEventListener('click', () => {
        toggleDebugMode();
        sideMenu.classList.remove('visible');
    });

    document.getElementById('menu-about').addEventListener('click', () => {
        // Show about dialog
        const aboutDialog = document.createElement('div');
        aboutDialog.className = 'dialog';
        aboutDialog.innerHTML = `
            <div class="dialog-content">
                <h2>About Autonomous Realms</h2>
                <p>An AI-powered isometric world exploration game.</p>
                <p>Version: 0.1.0</p>
                <button class="close-button">Close</button>
            </div>
        `;
        document.body.appendChild(aboutDialog);
        
        // Add close functionality
        aboutDialog.querySelector('.close-button').addEventListener('click', () => {
            aboutDialog.remove();
        });
        
        sideMenu.classList.remove('visible');
    });
}

// Start dragging
function startDrag(e) {
    // Don't start dragging if we clicked on a button or control
    if (e.target.closest('#controls') || e.target.closest('#info-panel') || 
        e.target.closest('.edge-menu') || e.target.closest('.submenu')) {
        return;
    }
    
    // Hide any submenus
    const languageMenu = document.getElementById('language-menu');
    if (languageMenu) {
        languageMenu.remove();
    }
    
    if (e.button !== 0) return; // Only left mouse button
    
    state.isDragging = true;
    state.hasDragged = false; // Reset the drag flag when starting a new drag
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.lastOffsetX = state.offsetX;
    state.lastOffsetY = state.offsetY;
    
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
}

// Handle dragging
function drag(e) {
    if (!state.isDragging) return;
    
    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;
    
    // Set hasDragged to true if there's significant movement
    // This threshold helps distinguish between a click and a drag
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        state.hasDragged = true;
    }
    
    state.offsetX = state.lastOffsetX + dx;
    state.offsetY = state.lastOffsetY + dy;
    
    updateWorldTransform();
    e.preventDefault();
}

// End dragging
function endDrag() {
    if (!state.isDragging) return;
    
    state.isDragging = false;
    document.body.style.cursor = '';
    
    // Load new tiles after dragging stops
    loadVisibleTiles();
}

// Handle touch start
function handleTouchStart(e) {
    // Don't start dragging if we touched a button or control
    if (e.target.closest('#controls') || e.target.closest('#info-panel') || 
        e.target.closest('.edge-menu') || e.target.closest('.submenu')) {
        return;
    }
    
    // Hide any submenus
    const languageMenu = document.getElementById('language-menu');
    if (languageMenu) {
        languageMenu.remove();
    }
    
    if (e.touches.length !== 1) return;
    
    state.isDragging = true;
    state.hasDragged = false; // Reset the drag flag
    state.dragStartX = e.touches[0].clientX;
    state.dragStartY = e.touches[0].clientY;
    state.lastOffsetX = state.offsetX;
    state.lastOffsetY = state.offsetY;
    
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
}

// Handle touch move
function handleTouchMove(e) {
    if (!state.isDragging || e.touches.length !== 1) return;
    
    const dx = e.touches[0].clientX - state.dragStartX;
    const dy = e.touches[0].clientY - state.dragStartY;
    
    // Set hasDragged to true if there's significant movement
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        state.hasDragged = true;
    }
    
    state.offsetX = state.lastOffsetX + dx;
    state.offsetY = state.lastOffsetY + dy;
    
    updateWorldTransform();
    e.preventDefault();
}

// Handle touch end
function handleTouchEnd() {
    if (!state.isDragging) return;
    
    state.isDragging = false;
    document.body.style.cursor = '';
    
    // Load new tiles after touch ends
    loadVisibleTiles();
}

// Zoom in
function zoomIn() {
    // Store the old zoom level
    const oldZoom = state.zoom;
    
    // Calculate the center of the viewport in screen coordinates
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    
    // Calculate the center of the viewport in world coordinates (before zoom)
    const worldCenterX = (viewportCenterX - state.offsetX) / oldZoom;
    const worldCenterY = (viewportCenterY - state.offsetY) / oldZoom;
    
    // Update zoom level
    state.zoom = Math.min(config.maxZoom, state.zoom + config.zoomStep);
    
    // Calculate where the center point would end up after the zoom
    const newScreenX = worldCenterX * state.zoom;
    const newScreenY = worldCenterY * state.zoom;
    
    // Adjust the offset to keep the center point in the same position
    state.offsetX = viewportCenterX - newScreenX;
    state.offsetY = viewportCenterY - newScreenY;
    
    updateWorldTransform();
    loadVisibleTiles();
}

// Zoom out
function zoomOut() {
    // Store the old zoom level
    const oldZoom = state.zoom;
    
    // Calculate the center of the viewport in screen coordinates
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    
    // Calculate the center of the viewport in world coordinates (before zoom)
    const worldCenterX = (viewportCenterX - state.offsetX) / oldZoom;
    const worldCenterY = (viewportCenterY - state.offsetY) / oldZoom;
    
    // Update zoom level
    state.zoom = Math.max(config.minZoom, state.zoom - config.zoomStep);
    
    // Calculate where the center point would end up after the zoom
    const newScreenX = worldCenterX * state.zoom;
    const newScreenY = worldCenterY * state.zoom;
    
    // Adjust the offset to keep the center point in the same position
    state.offsetX = viewportCenterX - newScreenX;
    state.offsetY = viewportCenterY - newScreenY;
    
    updateWorldTransform();
    loadVisibleTiles();
}

// Reset view
function resetView() {
    state.zoom = config.initialZoom;
    state.offsetX = 0;
    state.offsetY = 0;
    updateWorldTransform();
    loadVisibleTiles();
}

// Handle mouse wheel for zooming
function handleWheel(e) {
    e.preventDefault();
    
    // Store the old zoom level
    const oldZoom = state.zoom;
    
    // Calculate the center of the viewport in screen coordinates
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    
    // Calculate the center of the viewport in world coordinates (before zoom)
    const worldCenterX = (viewportCenterX - state.offsetX) / oldZoom;
    const worldCenterY = (viewportCenterY - state.offsetY) / oldZoom;
    
    // Determine zoom direction
    if (e.deltaY < 0) {
        // Zoom in
        state.zoom = Math.min(config.maxZoom, state.zoom + config.zoomStep);
    } else {
        // Zoom out
        state.zoom = Math.max(config.minZoom, state.zoom - config.zoomStep);
    }
    
    // Calculate where the center point would end up after the zoom
    const newScreenX = worldCenterX * state.zoom;
    const newScreenY = worldCenterY * state.zoom;
    
    // Adjust the offset to keep the center point in the same position
    state.offsetX = viewportCenterX - newScreenX;
    state.offsetY = viewportCenterY - newScreenY;
    
    updateWorldTransform();
    
    // Debounce loading tiles during rapid wheel events
    clearTimeout(state.wheelTimeout);
    state.wheelTimeout = setTimeout(() => {
        loadVisibleTiles();
    }, 200);
}

// Handle window resize
function handleResize() {
    loadVisibleTiles();
}

// Update the world container transform
function updateWorldTransform() {
    worldContainer.style.transformOrigin = 'center center';
    worldContainer.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
}

// Convert grid coordinates to isometric screen coordinates
function gridToIso(x, y) {
    // Apply isometric projection
    const isoX = (x - y) * (config.tileWidth / 2);
    
    // Use 50% vertical overlap for better visibility
    const isoY = (x + y) * (config.tileHeight / 2);
    
    return { x: isoX, y: isoY };
}

// Load visible tiles based on current view
function loadVisibleTiles() {
    // Show loading indicator
    showLoading();
    
    // Calculate center tile based on viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Center of the grid
    const centerX = Math.floor(config.gridSize / 2);
    const centerY = Math.floor(config.gridSize / 2);
    
    // Track which tiles should be visible
    const visibleTileKeys = new Set();
    
    // Load tiles in a radius around the center
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            // Calculate distance from center
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            // Skip tiles outside our visible radius
            if (distance > config.visibleRadius * 1.5) continue;
            
            const tileKey = `${x}_${y}`;
            visibleTileKeys.add(tileKey);
            
            // Check if we already loaded this tile
            if (!state.loadedTiles.has(tileKey)) {
                loadTile(0, 0, x, y);
            }
        }
    }
    
    // Remove tiles that are no longer visible
    for (const [key, tileElement] of state.loadedTiles.entries()) {
        if (!visibleTileKeys.has(key)) {
            tileElement.remove();
            state.loadedTiles.delete(key);
        }
    }
    
    // Hide loading indicator
    hideLoading();
}

// Load a single tile
function loadTile(regionX, regionY, x, y) {
    const tileKey = `${x}_${y}`;
    console.log(`Attempting to load tile at ${x},${y}`);
    
    // Create tile element
    const tileElement = document.createElement('div');
    tileElement.className = 'tile';
    tileElement.dataset.regionX = regionX;
    tileElement.dataset.regionY = regionY;
    tileElement.dataset.x = x;
    tileElement.dataset.y = y;
    
    // Position the tile using isometric coordinates
    const position = gridToIso(x, y);
    tileElement.style.left = `${position.x}px`;
    tileElement.style.top = `${position.y}px`;
    console.log(`Created tile element for ${x},${y} at position (${position.x}, ${position.y})`);
    
    // Create image element
    const imgElement = document.createElement('img');
    imgElement.width = config.tileWidth;
    imgElement.height = config.tileHeight;
    imgElement.draggable = false;
    
    // Set a loading placeholder
    imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmaWxsPSIjOTk5OTk5Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
    
    // Load the actual tile image - use the islands endpoint instead of the regular tiles
    const tileUrl = `${config.serverUrl}/api/tiles/islands/${x}/${y}`;
    console.log(`Requesting tile from: ${tileUrl}`);
    
    // Use fetch instead of Image object to properly handle 404 responses
    fetch(tileUrl)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    // If tile doesn't exist, remove the tile element from DOM
                    tileElement.remove();
                    state.loadedTiles.delete(tileKey);
                    console.log(`No tile exists at ${x},${y}, not displaying anything`);
                    throw new Error('Tile not found');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const objectURL = URL.createObjectURL(blob);
            imgElement.src = objectURL;
            console.log(`Successfully loaded tile image for ${x},${y}`);
        })
        .catch(error => {
            if (error.message !== 'Tile not found') {
                console.error(`Failed to load tile image for ${x},${y}:`, error);
            }
        });
    
    // Add click event to show tile info
    tileElement.addEventListener('click', (e) => {
        // If we've been dragging, don't treat this as a click
        if (state.hasDragged) {
            return;
        }
        
        // Get the relative position within the tile
        const rect = tileElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Get the image element
        const imgElement = tileElement.querySelector('img');
        
        // Only check transparency if the image is fully loaded
        if (imgElement.complete && imgElement.naturalWidth > 0) {
            // Debug information
            console.log(`Click at relative position: ${clickX},${clickY} on tile ${x},${y}`);
            console.log(`Image dimensions: ${imgElement.width}x${imgElement.height}`);
            
            // Check if the click is on a transparent pixel
            if (isTransparentPixel(imgElement, clickX, clickY)) {
                console.log(`Click on transparent part of tile ${x},${y}, ignoring`);
                
                // Prevent the current click from being processed further
                e.stopPropagation();
                
                // Get the absolute position of the click in the document
                const clickPointX = e.clientX;
                const clickPointY = e.clientY;
                
                // Find all tiles that contain this point
                const allTiles = Array.from(document.querySelectorAll('.tile'));
                
                // Get tiles that are under this point (using getBoundingClientRect)
                const tilesUnderPoint = allTiles.filter(tile => {
                    const tileRect = tile.getBoundingClientRect();
                    return (
                        clickPointX >= tileRect.left && 
                        clickPointX <= tileRect.right && 
                        clickPointY >= tileRect.top && 
                        clickPointY <= tileRect.bottom
                    );
                });
                
                console.log(`Found ${tilesUnderPoint.length} tiles under the click point`);
                
                // If no tiles found under the point, log an error and return
                if (tilesUnderPoint.length === 0) {
                    console.error('No tiles found under the click point');
                    return;
                }
                
                // Sort tiles by their DOM order (which should reflect their z-index/stacking)
                // This assumes tiles are added to the DOM in the correct stacking order
                // We need to reverse the order to start from the top-most tile
                const sortedTiles = tilesUnderPoint.sort((a, b) => {
                    const aIndex = Array.from(worldContainer.children).indexOf(a);
                    const bIndex = Array.from(worldContainer.children).indexOf(b);
                    return bIndex - aIndex; // Reverse order to start from top
                });
                
                // Remove the current tile from consideration
                const otherTiles = sortedTiles.filter(tile => tile !== tileElement);
                
                console.log(`Checking ${otherTiles.length} other tiles for non-transparent pixels`);
                
                // Find the first non-transparent tile under the click point
                let foundVisibleTile = false;
                
                for (const tile of otherTiles) {
                    // Calculate relative position within this tile
                    const tileRect = tile.getBoundingClientRect();
                    const relX = clickPointX - tileRect.left;
                    const relY = clickPointY - tileRect.top;
                    
                    const tileImg = tile.querySelector('img');
                    
                    // Skip if image isn't loaded yet
                    if (!tileImg || !tileImg.complete || tileImg.naturalWidth === 0) {
                        console.log(`Skipping tile ${tile.dataset.x},${tile.dataset.y} - image not fully loaded`);
                        continue;
                    }
                    
                    console.log(`Checking tile ${tile.dataset.x},${tile.dataset.y} at relative position ${relX},${relY}`);
                    
                    // Check if this pixel is non-transparent
                    if (!isTransparentPixel(tileImg, relX, relY)) {
                        // We found a non-transparent tile under the click point
                        console.log(`Found visible tile underneath: ${tile.dataset.x},${tile.dataset.y}`);
                        
                        // Simulate a click on this tile
                        setTimeout(() => {
                            selectTile(tile);
                        }, 0);
                        
                        foundVisibleTile = true;
                        break;
                    }
                }
                
                if (!foundVisibleTile) {
                    console.log('No visible tile found underneath');
                    
                    // If we couldn't find a non-transparent pixel in any tile,
                    // just select the top-most tile as a fallback
                    if (otherTiles.length > 0) {
                        console.log('Selecting top-most tile as fallback');
                        const topTile = otherTiles[0];
                        
                        // Simulate a click on the top tile
                        setTimeout(() => {
                            selectTile(topTile);
                        }, 0);
                    }
                }
                
                return;
            }
        }
        
        selectTile(tileElement);
    });
    
    // Add the image to the tile
    tileElement.appendChild(imgElement);
    
    // Add the tile to the world container
    worldContainer.appendChild(tileElement);
    console.log(`Added tile ${x},${y} to world container`);
    
    // Store the tile element for later reference
    state.loadedTiles.set(tileKey, tileElement);
}

// Toggle debug mode to visualize the grid and tile positions
function toggleDebugMode() {
    config.debugMode = !config.debugMode;
    
    if (config.debugMode) {
        // Add grid visualization
        for (let y = 0; y < config.gridSize; y++) {
            for (let x = 0; x < config.gridSize; x++) {
                const position = gridToIso(x, y);
                const debugElement = document.createElement('div');
                debugElement.className = 'debug-tile';
                debugElement.style.left = `${position.x}px`;
                debugElement.style.top = `${position.y}px`;
                debugElement.style.width = `${config.tileWidth}px`;
                debugElement.style.height = `${config.tileHeight}px`;
                debugElement.textContent = `${x},${y}`;
                debugElement.dataset.x = x;
                debugElement.dataset.y = y;
                worldContainer.appendChild(debugElement);
            }
        }
    } else {
        // Remove debug visualization
        const debugTiles = document.querySelectorAll('.debug-tile');
        debugTiles.forEach(tile => tile.remove());
    }
}

// Format file size in bytes to human-readable format
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Show context menu
function showContextMenu(x, y, tileElement) {
    // Remove any existing context menu
    hideContextMenu();
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    
    // Add menu items
    const redrawOption = document.createElement('div');
    redrawOption.className = 'context-menu-item';
    redrawOption.textContent = 'Redraw Tile';
    redrawOption.addEventListener('click', () => {
        redrawTile(tileElement);
        hideContextMenu();
    });
    
    contextMenu.appendChild(redrawOption);
    
    // Add to document
    document.body.appendChild(contextMenu);
    
    // Store reference to the menu
    state.contextMenu = contextMenu;
}

// Hide context menu
function hideContextMenu() {
    if (state.contextMenu) {
        state.contextMenu.remove();
        state.contextMenu = null;
    }
}

// Redraw a tile
async function redrawTile(tileElement) {
    if (!tileElement) return;
    
    const x = parseInt(tileElement.dataset.x);
    const y = parseInt(tileElement.dataset.y);
    const regionX = parseInt(tileElement.dataset.regionX);
    const regionY = parseInt(tileElement.dataset.regionY);
    
    // Show loading indicator on the tile
    const imgElement = tileElement.querySelector('img');
    const originalSrc = imgElement.src;
    imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmaWxsPSIjOTk5OTk5Ij5SZWRyYXdpbmcuLi48L3RleHQ+PC9zdmc+';
    
    try {
        // Make API call to redraw the tile
        const response = await fetch(`${config.serverUrl}/api/tiles/islands/${x}/${y}/redraw`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to redraw tile: ${response.status}`);
        }
        
        // Get the new image URL with a cache-busting parameter
        const newImageUrl = `${config.serverUrl}/api/tiles/islands/${x}/${y}?t=${Date.now()}`;
        
        // Create a new image to preload
        const newImage = new Image();
        newImage.onload = () => {
            // Update the tile with the new image
            imgElement.src = newImageUrl;
            
            // Show notification
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = `Tile at (${x}, ${y}) redrawn successfully`;
            document.body.appendChild(notification);
            
            // Remove notification after a delay
            setTimeout(() => {
                notification.remove();
            }, 3000);
        };
        
        newImage.onerror = () => {
            // Revert to original image on error
            imgElement.src = originalSrc;
            
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'notification error-notification';
            notification.textContent = `Failed to load redrawn tile at (${x}, ${y})`;
            document.body.appendChild(notification);
            
            // Remove notification after a delay
            setTimeout(() => {
                notification.remove();
            }, 3000);
        };
        
        // Start loading the new image
        newImage.src = newImageUrl;
        
    } catch (error) {
        console.error('Error redrawing tile:', error);
        
        // Revert to original image
        imgElement.src = originalSrc;
        
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'notification error-notification';
        notification.textContent = `Error redrawing tile: ${error.message}`;
        document.body.appendChild(notification);
        
        // Remove notification after a delay
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Show loading indicator
function showLoading() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-indicator';
    loadingElement.id = 'loading-indicator';
    loadingElement.textContent = 'Loading tiles...';
    document.body.appendChild(loadingElement);
}

// Hide loading indicator
function hideLoading() {
    state.isLoading = false;
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Function to handle tile selection
function selectTile(tile) {
  // Deselect previous tile
  if (state.selectedTile) {
    state.selectedTile.classList.remove('selected');
  }
  
  // Select this tile
  tile.classList.add('selected');
  state.selectedTile = tile;
  
  // Get the tile coordinates
  const tileX = parseInt(tile.dataset.x);
  const tileY = parseInt(tile.dataset.y);
  
  // Show loading in the info panel
  tileInfoElement.innerHTML = 'Loading tile information...';
  
  // Clear any existing action menu
  const existingMenu = document.getElementById('action-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Show a temporary action menu with loading state
  const loadingMenu = document.createElement('div');
  loadingMenu.id = 'action-menu';
  loadingMenu.className = 'action-menu';
  loadingMenu.innerHTML = '<h3>Available Actions</h3><p class="loading-actions">Analyzing terrain for available actions...</p>';
  document.body.appendChild(loadingMenu);
  state.actionMenuVisible = true;
  
  // Fetch tile info
  fetch(`${config.serverUrl}/api/tiles/islands/${tileX}/${tileY}/info`)
    .then(response => response.json())
    .then(data => {
      // Display tile info
      let infoHtml = `
        <p><strong>Position:</strong> (${tileX}, ${tileY})</p>
      `;
      
      if (data.exists) {
        infoHtml += `
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Terrain Code:</strong> ${data.terrainCode}</p>
        `;
        
        // Fetch and display available actions based on terrain code
        fetchAvailableActions(data.terrainCode)
          .then(actions => {
            state.availableActions = actions;
            showActionMenu(actions);
          })
          .catch(error => {
            // Handle error
            console.error('Error fetching actions:', error);
            const errorMenu = document.getElementById('action-menu');
            if (errorMenu) {
              errorMenu.innerHTML = `
                <h3>Available Actions</h3>
                <p class="error-message">Error loading actions: ${error.message}</p>
                <button class="close-button">Close</button>
              `;
              
              const closeButton = errorMenu.querySelector('.close-button');
              if (closeButton) {
                closeButton.addEventListener('click', () => {
                  errorMenu.remove();
                  state.actionMenuVisible = false;
                });
              }
            }
          });
        
        // Fetch and play narration
        fetchTerrainNarration(data.terrainCode)
          .then(narrationData => {
            if (narrationData && narrationData.narration) {
              // Show narration text
              const notification = document.createElement('div');
              notification.className = 'narration-notification';
              notification.textContent = narrationData.narration;
              document.body.appendChild(notification);
              
              // Remove notification after a delay
              setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 1000);
              }, 8000);
              
              // Play audio if available
              if (narrationData.audio && !narrationData.error) {
                playNarration(narrationData.audio);
              }
            }
          })
          .catch(error => {
            console.error('Error handling narration:', error);
          });
      } else {
        infoHtml += `<p><em>Island not yet generated</em></p>`;
        
        // Remove loading menu
        const loadingMenu = document.getElementById('action-menu');
        if (loadingMenu) {
          loadingMenu.remove();
          state.actionMenuVisible = false;
        }
      }
      
      tileInfoElement.innerHTML = infoHtml;
    })
    .catch(error => {
      tileInfoElement.innerHTML = `<p>Error loading tile info: ${error.message}</p>`;
      
      // Remove loading menu
      const loadingMenu = document.getElementById('action-menu');
      if (loadingMenu) {
        loadingMenu.remove();
        state.actionMenuVisible = false;
      }
    });
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

// Function to confirm and delete a colony
function confirmDeleteColony(colonyId, colonyElement) {
  // Create confirmation dialog
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'confirm-delete-dialog';
  
  const confirmMessage = document.createElement('p');
  confirmMessage.textContent = 'Are you sure you want to delete this colony? This action cannot be undone.';
  confirmDialog.appendChild(confirmMessage);
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'confirm-buttons';
  
  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';
  cancelButton.addEventListener('click', () => {
    confirmDialog.remove();
  });
  buttonContainer.appendChild(cancelButton);
  
  // Confirm button
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Delete';
  confirmButton.className = 'confirm-button';
  confirmButton.addEventListener('click', () => {
    deleteColony(colonyId);
    colonyElement.remove();
    confirmDialog.remove();
    
    // Check if there are no more colonies
    const coloniesList = document.querySelector('.colonies-list');
    if (coloniesList && coloniesList.children.length === 0) {
      const coloniesContainer = document.querySelector('.colonies-container');
      const noColoniesMessage = document.createElement('p');
      noColoniesMessage.className = 'no-colonies-message';
      noColoniesMessage.textContent = 'No saved colonies found.';
      coloniesContainer.innerHTML = '';
      coloniesContainer.appendChild(noColoniesMessage);
    }
  });
  buttonContainer.appendChild(confirmButton);
  
  confirmDialog.appendChild(buttonContainer);
  
  // Add to colony element
  colonyElement.appendChild(confirmDialog);
}

// Function to delete a colony
function deleteColony(colonyId) {
  try {
    console.log(`Deleting colony with ID: ${colonyId}`);
    
    // If it's the current colony, clear localStorage
    if (colonyId === 'current') {
      // Save any other colonies first
      const savedColoniesJSON = localStorage.getItem('savedColonies');
      const savedColonies = savedColoniesJSON ? JSON.parse(savedColoniesJSON) : [];
      
      // Clear main colony data
      localStorage.removeItem('colonyName');
      localStorage.removeItem('leaderName');
      localStorage.removeItem('kinId');
      localStorage.removeItem('kinName');
      localStorage.removeItem('tribeDream');
      localStorage.removeItem('tribeAppearance');
      localStorage.removeItem('languageInitialized');
      localStorage.removeItem('languageDescription');
      localStorage.removeItem('tribeIntroText');
      localStorage.removeItem('tribeIntroAudio');
      localStorage.removeItem('tribeImageUrl');
      localStorage.removeItem('tribeImagePath');
      localStorage.removeItem('languageDevelopment');
      localStorage.removeItem('lastPlayed');
      
      // Keep saved colonies
      if (savedColonies.length > 0) {
        localStorage.setItem('savedColonies', JSON.stringify(savedColonies));
      } else {
        localStorage.removeItem('savedColonies');
      }
    } else {
      // Remove from saved colonies
      const savedColoniesJSON = localStorage.getItem('savedColonies');
      if (savedColoniesJSON) {
        const savedColonies = JSON.parse(savedColoniesJSON);
        const updatedColonies = savedColonies.filter(colony => colony.id !== colonyId);
        
        if (updatedColonies.length > 0) {
          localStorage.setItem('savedColonies', JSON.stringify(updatedColonies));
        } else {
          localStorage.removeItem('savedColonies');
        }
      }
    }
    
    console.log(`Colony with ID ${colonyId} deleted successfully`);
  } catch (error) {
    console.error('Error deleting colony:', error);
    alert(`Failed to delete colony: ${error.message}`);
  }
}

// Initialize the world when the page loads
window.addEventListener('load', () => {
  // Always show the welcome screen first
  createWelcomeScreen();
});
