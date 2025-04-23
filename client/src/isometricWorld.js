import audioPlayer from './audioPlayer.js';
import { createWelcomeScreen } from './welcomeScreen.js';

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
    
    // Create circular menu container
    const circularMenu = document.createElement('div');
    circularMenu.id = 'circular-menu';
    circularMenu.className = 'circular-menu';
    
    // Add menu items
    const menuItems = [
        { icon: '🗣️', label: 'Language', action: showLanguageMenu },
        { icon: '🏛️', label: 'Culture', action: () => console.log('Culture clicked') },
        { icon: '🛠️', label: 'Crafting', action: () => console.log('Crafting clicked') },
        { icon: '🏠', label: 'Building', action: () => console.log('Building clicked') },
        { icon: '🔍', label: 'Explore', action: () => console.log('Explore clicked') }
    ];
    
    // Calculate positions in a circle
    const totalItems = menuItems.length;
    const radius = 80; // Distance from center
    
    menuItems.forEach((item, index) => {
        // Calculate position in the circle
        const angle = (index / totalItems) * 2 * Math.PI; // Angle in radians
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        
        // Create menu item
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuItem.style.transform = `translate(${x}px, ${y}px)`;
        
        // Create button with icon and label
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.innerHTML = `<span class="menu-icon">${item.icon}</span><span class="menu-label">${item.label}</span>`;
        button.addEventListener('click', item.action);
        
        menuItem.appendChild(button);
        circularMenu.appendChild(menuItem);
    });
    
    // Add to document body
    document.body.appendChild(circularMenu);
    
    // Position the menu near the selected tile
    if (state.selectedTile) {
        const tileRect = state.selectedTile.getBoundingClientRect();
        circularMenu.style.left = `${tileRect.left + tileRect.width / 2}px`;
        circularMenu.style.top = `${tileRect.top + tileRect.height / 2}px`;
    } else {
        // Default to center of screen if no tile is selected
        circularMenu.style.left = '50%';
        circularMenu.style.top = '50%';
        circularMenu.style.transform = 'translate(-50%, -50%)';
    }
}


// Send a message to KinOS about an action
async function sendKinOSMessage(action, terrainInfo) {
  try {
    console.log(`Sending action "${action.name}" to KinOS with terrain info:`, terrainInfo);
    
    // Prepare the message content
    const messageContent = `
I am attempting to perform the action "${action.name}" (${action.code}) on terrain type: ${terrainInfo.terrainCode}.

Terrain Description: ${terrainInfo.description || 'No description available'}

Action Description: ${action.description || 'No description available'}

Please provide guidance on how this action might unfold in this environment, any challenges I might face, and potential outcomes.
`;

    // Prepare the request body with updated blueprint, kin, and mode
    const requestBody = {
      content: messageContent,
      model: "claude-3-7-sonnet-latest",
      history_length: 25,
      mode: "action_resolution", // Updated mode
      addSystem: "You are a helpful game assistant providing realistic and immersive guidance on actions taken in a settlement-building game. Consider the terrain, available resources, and potential challenges when describing outcomes. Be specific and vivid in your descriptions."
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
    
    return responseData;
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
        
        // Remove the loading notification
        loadingNotification.remove();
        
        if (kinOSResponse.error) {
            // Show error notification
            const errorNotification = document.createElement('div');
            errorNotification.className = 'notification error-notification';
            errorNotification.textContent = `Error: ${kinOSResponse.error}`;
            document.body.appendChild(errorNotification);
            
            // Remove notification after a delay
            setTimeout(() => {
                errorNotification.remove();
            }, 5000);
            return;
        }
        
        // Parse the response content to extract structured data
        const parsedResponse = parseActionResponse(kinOSResponse.content);
        
        // Show the KinOS response in a dialog with structured format
        const responseDialog = document.createElement('div');
        responseDialog.className = 'dialog';
        responseDialog.innerHTML = `
            <div class="dialog-content">
                <h2>${action.name}</h2>
                <div class="action-response structured-response">
                    ${formatStructuredResponse(parsedResponse)}
                </div>
                <button class="close-button">Close</button>
            </div>
        `;
        document.body.appendChild(responseDialog);
        
        // Add close functionality
        responseDialog.querySelector('.close-button').addEventListener('click', () => {
            responseDialog.remove();
        });
        
    } catch (error) {
        console.error('Error performing action:', error);
        
        // Remove the loading notification
        loadingNotification.remove();
        
        // Show error notification
        const errorNotification = document.createElement('div');
        errorNotification.className = 'notification error-notification';
        errorNotification.textContent = `Error performing action: ${error.message}`;
        document.body.appendChild(errorNotification);
        
        // Remove notification after a delay
        setTimeout(() => {
            errorNotification.remove();
        }, 5000);
    }
}

// Parse the action response from KinOS into a structured format
function parseActionResponse(responseText) {
    try {
        // First try to find a JSON object in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        // If no JSON found, parse the markdown structure
        const sections = {};
        
        // Extract the title (if present)
        const titleMatch = responseText.match(/# ([^\n]+)/);
        if (titleMatch) {
            sections.title = titleMatch[1].trim();
        }
        
        // Extract Action Analysis section
        const analysisMatch = responseText.match(/## Action Analysis\n([\s\S]*?)(?=##|$)/);
        if (analysisMatch) {
            sections.analysis = analysisMatch[1].trim();
        }
        
        // Extract Narration section
        const narrationMatch = responseText.match(/## Narration\n([\s\S]*?)(?=##|$)/);
        if (narrationMatch) {
            sections.narration = narrationMatch[1].trim();
        }
        
        // Extract Expected Outcomes section
        const outcomesMatch = responseText.match(/## Expected Outcomes\n([\s\S]*?)(?=##|$)/);
        if (outcomesMatch) {
            sections.outcomes = outcomesMatch[1].trim();
            
            // Try to further parse resources, knowledge, and challenges
            const resourcesMatch = sections.outcomes.match(/\*\*Resources Gained:\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
            if (resourcesMatch) {
                sections.resources = resourcesMatch[1].trim();
            }
            
            const knowledgeMatch = sections.outcomes.match(/\*\*Knowledge Opportunities:\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
            if (knowledgeMatch) {
                sections.knowledge = knowledgeMatch[1].trim();
            }
            
            const challengesMatch = sections.outcomes.match(/\*\*Challenges:\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
            if (challengesMatch) {
                sections.challenges = challengesMatch[1].trim();
            }
        }
        
        // Extract Tips section
        const tipsMatch = responseText.match(/## Tips for Success\n([\s\S]*?)(?=##|$)/);
        if (tipsMatch) {
            sections.tips = tipsMatch[1].trim();
        }
        
        // If we couldn't parse structured sections, use the full text
        if (Object.keys(sections).length <= 1) {
            sections.fullText = responseText;
        }
        
        return sections;
    } catch (error) {
        console.error('Error parsing action response:', error);
        return { fullText: responseText };
    }
}

// Format the structured response as HTML
function formatStructuredResponse(parsedResponse) {
    // If we have the full text only, just return it with line breaks
    if (parsedResponse.fullText && Object.keys(parsedResponse).length === 1) {
        return parsedResponse.fullText.replace(/\n/g, '<br>');
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
        
        // Don't hide circular menu if clicking on the menu itself or a tile
        if (!e.target.closest('.circular-menu') && !e.target.closest('.tile') && !e.target.closest('.submenu')) {
            const circularMenu = document.getElementById('circular-menu');
            if (circularMenu) {
                circularMenu.remove();
            }
            
            // Also hide any submenus
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
        e.target.closest('.circular-menu') || e.target.closest('.submenu')) {
        return;
    }
    
    // Hide circular menu when dragging starts
    const circularMenu = document.getElementById('circular-menu');
    if (circularMenu) {
        circularMenu.remove();
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
        e.target.closest('.circular-menu') || e.target.closest('.submenu')) {
        return;
    }
    
    // Hide circular menu when dragging starts
    const circularMenu = document.getElementById('circular-menu');
    if (circularMenu) {
        circularMenu.remove();
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
  
  // Show circular menu for the selected tile
  showCircularMenu();
  
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

// Initialize the world when the page loads
window.addEventListener('load', () => {
  // Always show the welcome screen first
  createWelcomeScreen();
});
