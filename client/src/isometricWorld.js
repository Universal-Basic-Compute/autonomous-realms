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
    isometricAngle: 30 // Degrees for isometric projection
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
    actionMenuVisible: false // Track if action menu is visible
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
}

// Fetch available actions for a terrain type
async function fetchAvailableActions(terrainCode) {
    if (!terrainCode) return [];
    
    try {
        // Extract the base terrain code (before any | character)
        const baseTerrainCode = terrainCode.split('|')[0];
        
        // Fetch actions for this terrain type
        const response = await fetch(`${config.serverUrl}/api/data/actions/${baseTerrainCode}`);
        
        if (!response.ok) {
            console.error(`Failed to fetch actions for terrain ${baseTerrainCode}`);
            return [];
        }
        
        const actions = await response.json();
        return actions;
    } catch (error) {
        console.error('Error fetching available actions:', error);
        return [];
    }
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
    state.zoom = Math.min(config.maxZoom, state.zoom + config.zoomStep);
    updateWorldTransform();
    loadVisibleTiles();
}

// Zoom out
function zoomOut() {
    state.zoom = Math.max(config.minZoom, state.zoom - config.zoomStep);
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
    
    // Determine zoom direction
    if (e.deltaY < 0) {
        // Zoom in
        state.zoom = Math.min(config.maxZoom, state.zoom + config.zoomStep);
    } else {
        // Zoom out
        state.zoom = Math.max(config.minZoom, state.zoom - config.zoomStep);
    }
    
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
    worldContainer.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
}

// Convert grid coordinates to isometric screen coordinates
function gridToIso(x, y) {
    // Apply isometric projection
    const isoX = (x - y) * (config.tileWidth / 2);
    
    // Updated to use 0% vertical overlap (no compression)
    const isoY = (x + y) * (config.tileHeight / 1); // Changed from /3 to /1 for 0% overlap
    
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
    console.log(`Loading tile at ${x},${y}`);
    
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
    tileElement.addEventListener('click', () => {
        // Deselect previous tile
        if (state.selectedTile) {
            state.selectedTile.classList.remove('selected');
        }
        
        // Select this tile
        tileElement.classList.add('selected');
        state.selectedTile = tileElement;
        
        // Show loading in the info panel
        tileInfoElement.innerHTML = 'Loading tile information...';
        
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
                        });
                } else {
                    infoHtml += `<p><em>Island not yet generated</em></p>`;
                }
                
                tileInfoElement.innerHTML = infoHtml;
            })
            .catch(error => {
                tileInfoElement.innerHTML = `<p>Error loading tile info: ${error.message}</p>`;
            });
    });
    
    // Add the image to the tile
    tileElement.appendChild(imgElement);
    
    // Add the tile to the world container
    worldContainer.appendChild(tileElement);
    
    // Store the tile element for later reference
    state.loadedTiles.set(tileKey, tileElement);
}

// Format file size in bytes to human-readable format
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
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
