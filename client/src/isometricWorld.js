import audioPlayer from './audioPlayer.js';

// Function to check if a pixel is transparent
function isTransparentPixel(img, x, y) {
  // Create a temporary canvas to analyze the image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  
  // Draw the image on the canvas
  ctx.drawImage(img, 0, 0);
  
  // Get the pixel data
  try {
    // Make sure x and y are within bounds
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
      return true; // Consider out-of-bounds as transparent
    }
    
    // Get the pixel data
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    
    // Check if the alpha channel (4th value) is 0 (fully transparent)
    return pixelData[3] === 0;
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
    contextMenu: null // Track the current context menu
};

// DOM Elements
const worldContainer = document.getElementById('isometric-world');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const resetViewButton = document.getElementById('reset-view');
const tileInfoElement = document.getElementById('tile-info');

// Initialize the world
function initWorld() {
    // Set initial transform
    updateWorldTransform();
    
    // Add event listeners
    setupEventListeners();
    
    // Load initial tiles
    loadVisibleTiles();
    
    // Add music controls
    addMusicControls();
}

// Add music controls
function addMusicControls() {
  const controlsContainer = document.getElementById('controls');
  
  // Create music control container
  const musicControls = document.createElement('div');
  musicControls.className = 'music-controls';
  
  // Create music toggle button
  const musicToggleBtn = document.createElement('button');
  musicToggleBtn.innerHTML = '🔊';
  musicToggleBtn.title = 'Toggle Music';
  musicToggleBtn.addEventListener('click', () => {
    const isMuted = audioPlayer.toggleMute();
    musicToggleBtn.innerHTML = isMuted ? '🔇' : '🔊';
  });
  
  // Create volume slider
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.value = '30'; // Default to 30%
  volumeSlider.className = 'volume-slider';
  volumeSlider.title = 'Music Volume';
  volumeSlider.addEventListener('input', (e) => {
    audioPlayer.setVolume(e.target.value / 100);
  });
  
  // Add controls to container
  musicControls.appendChild(musicToggleBtn);
  musicControls.appendChild(volumeSlider);
  
  // Add to main controls
  controlsContainer.appendChild(musicControls);
}

// Fetch available actions for a terrain type
async function fetchAvailableActions(terrainCode) {
    if (!terrainCode) return [];
    
    try {
        // Extract the base terrain code (before any | character)
        const baseTerrainCode = terrainCode.split('|')[0];
        
        // Use the AI-powered endpoint to get actions
        const response = await fetch(`${config.serverUrl}/api/data/actions/ai/${terrainCode}`);
        
        if (!response.ok) {
            console.error(`Failed to fetch actions for terrain ${terrainCode}`);
            return [];
        }
        
        const actions = await response.json();
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
            actionButton.textContent = action.name;
            
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
}

// Handle performing an action
function performAction(action) {
    console.log(`Performing action: ${action.name} (${action.code})`);
    // In a full implementation, this would communicate with the server
    // to actually perform the action and update the game state
    
    // For now, just show a notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = `Performed: ${action.name}`;
    document.body.appendChild(notification);
    
    // Remove notification after a delay
    setTimeout(() => {
        notification.remove();
    }, 3000);
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
    
    // Zoom controls
    zoomInButton.addEventListener('click', zoomIn);
    zoomOutButton.addEventListener('click', zoomOut);
    resetViewButton.addEventListener('click', resetView);
    
    // Mouse wheel zoom
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    // Window resize
    window.addEventListener('resize', handleResize);
    
    // Add debug button
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug';
    debugButton.addEventListener('click', toggleDebugMode);
    document.getElementById('controls').appendChild(debugButton);
    
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
    });
    
    // Hide context menu when scrolling
    document.addEventListener('wheel', () => {
        hideContextMenu();
    });
    
    // Hide context menu when window is resized
    window.addEventListener('resize', () => {
        hideContextMenu();
    });
}

// Start dragging
function startDrag(e) {
    // Don't start dragging if we clicked on a button or control
    if (e.target.closest('#controls') || e.target.closest('#info-panel')) {
        return;
    }
    
    if (e.button !== 0) return; // Only left mouse button
    
    state.isDragging = true;
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
    if (e.target.closest('#controls') || e.target.closest('#info-panel')) {
        return;
    }
    
    if (e.touches.length !== 1) return;
    
    state.isDragging = true;
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
            
            // Add floating animation - use a deterministic but seemingly random pattern
            // based on the coordinates to ensure the same island always has the same animation
            const animationSeed = (x * 7 + y * 13) % 3 + 1;
            tileElement.classList.add(`float-animation-${animationSeed}`);
            
            // Create a more randomized delay based on coordinates
            // This ensures the same island always gets the same delay, but with more variation
            // Use a decimal between 0 and 1 based on a hash of the coordinates
            const hashValue = Math.abs((x * 31) ^ (y * 17)) % 100;
            const delayFactor = hashValue / 100; // Convert to a value between 0 and 1
            
            // Apply a delay between 0 and 3 seconds
            const delay = delayFactor * 3;
            tileElement.style.animationDelay = `${delay}s`;
        })
        .catch(error => {
            if (error.message !== 'Tile not found') {
                console.error(`Failed to load tile image for ${x},${y}:`, error);
            }
        });
    
    // Add click event to show tile info
    tileElement.addEventListener('click', (e) => {
        // Get the relative position within the tile
        const rect = tileElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Get the image element
        const imgElement = tileElement.querySelector('img');
        
        // Check if the image is loaded and the click is on a transparent pixel
        if (imgElement.complete && isTransparentPixel(imgElement, clickX, clickY)) {
            // Click is on a transparent part, ignore this tile and find tile underneath
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
                const rect = tile.getBoundingClientRect();
                return (
                    clickPointX >= rect.left && 
                    clickPointX <= rect.right && 
                    clickPointY >= rect.top && 
                    clickPointY <= rect.bottom
                );
            });
            
            // Sort tiles by their DOM order (which should reflect their z-index/stacking)
            // This assumes tiles are added to the DOM in the correct stacking order
            const sortedTiles = tilesUnderPoint.sort((a, b) => {
                const aIndex = Array.from(worldContainer.children).indexOf(a);
                const bIndex = Array.from(worldContainer.children).indexOf(b);
                return aIndex - bIndex;
            });
            
            // Remove the current tile from consideration
            const otherTiles = sortedTiles.filter(tile => tile !== tileElement);
            
            // Find the first non-transparent tile under the click point
            let foundVisibleTile = false;
            
            for (const tile of otherTiles) {
                // Calculate relative position within this tile
                const tileRect = tile.getBoundingClientRect();
                const relX = clickPointX - tileRect.left;
                const relY = clickPointY - tileRect.top;
                
                const tileImg = tile.querySelector('img');
                
                // Skip if image isn't loaded yet
                if (!tileImg || !tileImg.complete) continue;
                
                // Check if this pixel is non-transparent
                if (!isTransparentPixel(tileImg, relX, relY)) {
                    // We found a non-transparent tile under the click point
                    console.log(`Found visible tile underneath: ${tile.dataset.x},${tile.dataset.y}`);
                    
                    // Simulate a click on this tile
                    setTimeout(() => {
                        // Create and dispatch a new click event
                        const newClickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: clickPointX,
                            clientY: clickPointY
                        });
                        
                        tile.dispatchEvent(newClickEvent);
                    }, 0);
                    
                    foundVisibleTile = true;
                    break;
                }
            }
            
            if (!foundVisibleTile) {
                console.log('No visible tile found underneath');
            }
            
            return;
        }
        
        // Deselect previous tile
        if (state.selectedTile) {
            state.selectedTile.classList.remove('selected');
        }
        
        // Select this tile
        tileElement.classList.add('selected');
        state.selectedTile = tileElement;
        
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
        
        // Fetch tile info - use the islands info endpoint
        fetch(`${config.serverUrl}/api/tiles/islands/${x}/${y}/info`)
            .then(response => response.json())
            .then(data => {
                // Display tile info
                let infoHtml = `
                    <p><strong>Position:</strong> (${x}, ${y})</p>
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
                            // If there's an error, show an error message in the action menu
                            const errorMenu = document.createElement('div');
                            errorMenu.id = 'action-menu';
                            errorMenu.className = 'action-menu';
                            errorMenu.innerHTML = `
                                <h3>Available Actions</h3>
                                <p class="error-message">Error loading actions: ${error.message}</p>
                                <button class="close-button">Close</button>
                            `;
                            
                            // Add close button functionality
                            const closeButton = errorMenu.querySelector('.close-button');
                            closeButton.addEventListener('click', () => {
                                errorMenu.remove();
                                state.actionMenuVisible = false;
                            });
                            
                            // Replace the loading menu with the error menu
                            const loadingMenu = document.getElementById('action-menu');
                            if (loadingMenu) {
                                loadingMenu.remove();
                            }
                            document.body.appendChild(errorMenu);
                        });
                    
                    // Fetch and play narration for this terrain
                    fetchTerrainNarration(data.terrainCode)
                        .then(narrationData => {
                            if (narrationData && narrationData.narration) {
                                // Show narration text in a notification
                                const notification = document.createElement('div');
                                notification.className = 'narration-notification';
                                notification.textContent = narrationData.narration;
                                document.body.appendChild(notification);
                                
                                // Remove notification after a delay
                                setTimeout(() => {
                                    notification.classList.add('fade-out');
                                    setTimeout(() => notification.remove(), 1000);
                                }, 8000);
                                
                                // Play the audio narration if available
                                if (narrationData.audio && !narrationData.error) {
                                    console.log('Playing narration audio:', narrationData.audio);
                                    playNarration(narrationData.audio);
                                } else if (narrationData.error) {
                                    console.error('Narration contains error:', narrationData.error);
                                    // Error notification is already shown in fetchTerrainNarration
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Error handling narration:', error);
                            showErrorNotification(`Error handling narration: ${error.message}`);
                        });
                } else {
                    infoHtml += `<p><em>Island not yet generated</em></p>`;
                    
                    // Remove the loading action menu since there's no terrain
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
                
                // Remove the loading action menu on error
                const loadingMenu = document.getElementById('action-menu');
                if (loadingMenu) {
                    loadingMenu.remove();
                    state.actionMenuVisible = false;
                }
            });
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

// Initialize the world when the page loads
window.addEventListener('load', initWorld);
