// closeMapView.js - Handles the close-up map view when settling on a tile
import { getServerUrl } from './utils/serverUrl.js';

class CloseMapView {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.currentTile = null;
    this.gridContainer = null;
    this.infoPanel = null;
    this.tileSize = 64; // Size of each close map tile in pixels
    this.mapSize = 16;  // 16x16 grid
    this.tiles = [];    // Array to store tile elements
    
    // Initialize the view
    this.initialize();
    
    // Listen for escape key to exit close map view
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }
  
  initialize() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.id = 'close-map-container';
    this.container.className = 'close-map-container';
    
    // Add header with title and back button
    const header = document.createElement('div');
    header.className = 'close-map-header';
    header.innerHTML = `
      <h2>Settlement View</h2>
      <button id="close-map-back-button">Back to World</button>
    `;
    this.container.appendChild(header);
    
    // Add event listener to the back button
    header.querySelector('#close-map-back-button').addEventListener('click', () => {
      this.hide();
    });
    
    // Create the grid container
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'close-map-grid';
    this.container.appendChild(this.gridContainer);
    
    // Create the info panel
    this.infoPanel = document.createElement('div');
    this.infoPanel.className = 'close-map-info-panel';
    this.infoPanel.innerHTML = '<h3>Tile Information</h3><p>Click on a tile to see details</p>';
    this.container.appendChild(this.infoPanel);
    
    // Add the container to the document body but keep it hidden
    document.body.appendChild(this.container);
    this.container.style.display = 'none';
    
    // Add CSS for the close map view
    this.addStyles();
  }
  
  addStyles() {
    // Check if styles already exist
    if (document.getElementById('close-map-styles')) return;
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'close-map-styles';
    
    // Add CSS rules
    style.textContent = `
      .close-map-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        color: white;
        font-family: 'Montserrat', sans-serif;
      }
      
      .close-map-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background-color: #333;
        border-bottom: 1px solid #555;
      }
      
      .close-map-header h2 {
        margin: 0;
        font-size: 1.5rem;
      }
      
      #close-map-back-button {
        background-color: #555;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      #close-map-back-button:hover {
        background-color: #777;
      }
      
      .close-map-grid {
        display: grid;
        grid-template-columns: repeat(16, ${this.tileSize}px);
        grid-template-rows: repeat(16, ${this.tileSize}px);
        gap: 1px;
        padding: 20px;
        overflow: auto;
        flex-grow: 1;
        justify-content: center;
      }
      
      .close-map-tile {
        width: ${this.tileSize}px;
        height: ${this.tileSize}px;
        background-size: cover;
        background-position: center;
        border: 1px solid #444;
        cursor: pointer;
        transition: transform 0.2s, border-color 0.2s;
      }
      
      .close-map-tile:hover {
        transform: scale(1.05);
        border-color: #aaa;
        z-index: 1;
      }
      
      .close-map-tile.selected {
        border: 2px solid #ffcc00;
      }
      
      .close-map-info-panel {
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background-color: rgba(0, 0, 0, 0.8);
        border: 1px solid #555;
        border-radius: 8px;
        padding: 15px;
      }
      
      .close-map-info-panel h3 {
        margin-top: 0;
        border-bottom: 1px solid #555;
        padding-bottom: 8px;
      }
      
      .close-map-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      
      .close-map-actions button {
        flex: 1;
        background-color: #2c3e50;
        color: white;
        border: none;
        padding: 8px 0;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .close-map-actions button:hover {
        background-color: #34495e;
      }
      
      .close-map-actions button:disabled {
        background-color: #95a5a6;
        cursor: not-allowed;
      }
      
      .close-map-actions button[data-action="settle"] {
        background-color: #27ae60;
        font-weight: bold;
      }
      
      .close-map-actions button[data-action="settle"]:hover {
        background-color: #2ecc71;
      }
      
      .building-overlay, .settlement-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        z-index: 10;
        text-shadow: 0 0 3px #000;
      }
      
      .settlement-overlay {
        font-size: 32px;
      }
      
      .progress-bar {
        height: 20px;
        background-color: #3498db;
        width: 0%;
        border-radius: 4px;
        transition: width 0.2s;
      }
      
      .construction-progress, .gathering-progress, .exploration-progress, .settlement-progress {
        width: 100%;
        background-color: #ecf0f1;
        border-radius: 4px;
        margin: 10px 0;
      }
      
      .settlement-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      
      .primary-button {
        background-color: #27ae60;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      
      .primary-button:hover {
        background-color: #2ecc71;
      }
      
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1001;
      }
      
      .loading-spinner {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 2s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(style);
  }
  
  show(tile) {
    // Store the current tile
    this.currentTile = tile;
    
    // Show loading overlay
    this.showLoading();
    
    // Update the header title
    const header = this.container.querySelector('.close-map-header h2');
    header.textContent = `Settlement at ${tile.terrainDescription || 'Unknown Terrain'}`;
    
    // Clear existing tiles
    this.gridContainer.innerHTML = '';
    this.tiles = [];
    
    // Make the container visible
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    // Generate the close map
    this.generateCloseMap(tile);
  }
  
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
    this.currentTile = null;
  }
  
  showLoading() {
    // Create loading overlay if it doesn't exist
    let loadingOverlay = this.container.querySelector('.loading-overlay');
    
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Generating settlement map...</p>
      `;
      this.container.appendChild(loadingOverlay);
    } else {
      loadingOverlay.style.display = 'flex';
    }
  }
  
  hideLoading() {
    const loadingOverlay = this.container.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }
  
  async generateCloseMap(tile) {
    try {
      // Extract tile information
      const { regionX, regionY, x: tileX, y: tileY } = tile.position;
      const terrainCode = tile.terrainCode;
      const terrainDescription = tile.terrainDescription || 'Unknown Terrain';
      
      console.log(`Generating close map for tile at (${regionX},${regionY},${tileX},${tileY}) with terrain ${terrainCode}`);
      
      // Get the current user ID
      const userId = localStorage.getItem('userId');
      
      // Request close map generation from the server
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/tiles/close-map/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-ID': userId || '' // Add user ID if available
        },
        body: JSON.stringify({
          regionX,
          regionY,
          tileX,
          tileY,
          terrainCode,
          terrainDescription,
          userId // Also include in body
        })
      });
      
      if (!response.ok) {
        // Check if this is a 402 Payment Required error (insufficient COMPUTE)
        if (response.status === 402) {
          // Show a friendly notification about insufficient COMPUTE
          this.showInsufficientComputeNotification();
          this.hideLoading();
          return;
        }
        
        // Check if the response is HTML (which would indicate a server error page)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Server returned an HTML error page. The endpoint may not exist or be properly configured.');
        }
        
        const error = await response.json();
        throw new Error(error.message || `Failed to generate close map: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Close map generation result:', result);
      
      // Load the close map metadata
      await this.loadCloseMapMetadata(regionX, regionY, tileX, tileY);
      
      // Hide loading overlay
      this.hideLoading();
      
    } catch (error) {
      console.error('Error generating close map:', error);
      
      // Show error in the info panel
      this.infoPanel.innerHTML = `
        <h3>Error</h3>
        <p>Failed to generate settlement map: ${error.message}</p>
        <button id="close-map-retry-button">Retry</button>
      `;
      
      // Add event listener to retry button
      const retryButton = this.infoPanel.querySelector('#close-map-retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          if (this.currentTile) {
            this.show(this.currentTile);
          }
        });
      }
      
      // Hide loading overlay
      this.hideLoading();
    }
  }
  
  showInsufficientComputeNotification() {
    // Show error in the info panel
    this.infoPanel.innerHTML = `
      <h3>Insufficient COMPUTE</h3>
      <p>You need more COMPUTE tokens to generate a settlement map.</p>
      <button id="connect-wallet-button" class="primary-button">Connect Wallet</button>
    `;
    
    // Add event listener to the connect wallet button
    const connectButton = this.infoPanel.querySelector('#connect-wallet-button');
    if (connectButton) {
      connectButton.addEventListener('click', () => {
        // Import and use the showComputeTransferDialog function
        import('./welcomeScreen.js').then(module => {
          const walletAddress = localStorage.getItem('walletAddress');
          if (walletAddress) {
            module.showComputeTransferDialog(walletAddress);
          } else {
            // If no wallet is connected, this will handle the connection first
            const connectWalletHandler = () => {
              module.connectWallet().then(address => {
                if (address) {
                  module.showComputeTransferDialog(address);
                }
              });
            };
            connectWalletHandler();
          }
        });
      });
    }
  }
  
  async loadCloseMapMetadata(regionX, regionY, tileX, tileY) {
    try {
      const serverUrl = getServerUrl();
      // Fetch the metadata for this close map
      const response = await fetch(`${serverUrl}/api/tiles/close-map/${regionX}/${regionY}/${tileX}/${tileY}/metadata`);
      
      if (!response.ok) {
        throw new Error('Failed to load close map metadata');
      }
      
      const metadata = await response.json();
      console.log('Close map metadata:', metadata);
      
      // Store the metadata
      this.metadata = metadata;
      
      // Create the grid of tiles
      this.createTileGrid(regionX, regionY, tileX, tileY, metadata.tileDescriptions);
      
    } catch (error) {
      console.error('Error loading close map metadata:', error);
      throw error;
    }
  }
  
  createTileGrid(regionX, regionY, tileX, tileY, tileDescriptions) {
    // Clear existing tiles
    this.gridContainer.innerHTML = '';
    this.tiles = [];
    
    // Create the grid of tiles
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const index = y * this.mapSize + x;
        const description = tileDescriptions[index];
        
        // Create tile element
        const tileElement = document.createElement('div');
        tileElement.className = 'close-map-tile';
        tileElement.dataset.x = x;
        tileElement.dataset.y = y;
        tileElement.dataset.description = description;
        
        const serverUrl = getServerUrl();
        // Set the background image
        tileElement.style.backgroundImage = `url(${serverUrl}/api/tiles/close-map/${regionX}/${regionY}/${tileX}/${tileY}/${x}/${y})`;
        
        // Add a tooltip with the description
        tileElement.title = description;
        
        // Add event listener for click
        tileElement.addEventListener('click', () => this.handleTileClick(tileElement, regionX, regionY, tileX, tileY, x, y, description));
        
        // Add to the grid
        this.gridContainer.appendChild(tileElement);
        this.tiles.push(tileElement);
      }
    }
  }
  
  handleTileClick(tileElement, regionX, regionY, tileX, tileY, x, y, description) {
    // Remove selected class from all tiles
    this.tiles.forEach(tile => tile.classList.remove('selected'));
    
    // Add selected class to clicked tile
    tileElement.classList.add('selected');
    
    // Check if this tile already has a building or settlement
    const hasBuilding = tileElement.dataset.building;
    const hasSettlement = tileElement.dataset.settlement === 'true';
    
    // Update info panel
    this.infoPanel.innerHTML = `
      <h3>Tile Information</h3>
      <p><strong>Position:</strong> (${x}, ${y})</p>
      <p><strong>Type:</strong> ${description}</p>
      ${hasBuilding ? `<p><strong>Building:</strong> ${hasBuilding}</p>` : ''}
      ${hasSettlement ? `<p><strong>Status:</strong> Settlement Established</p>` : ''}
      <div class="close-map-actions">
        <button data-action="build" ${hasSettlement ? 'disabled' : ''}>Build</button>
        <button data-action="gather">Gather</button>
        <button data-action="explore">Explore</button>
        ${!hasSettlement ? '<button data-action="settle">Establish Settlement</button>' : ''}
      </div>
    `;
    
    // Add event listeners to action buttons
    this.infoPanel.querySelectorAll('button[data-action]:not([disabled])').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        this.handleAction(action, regionX, regionY, tileX, tileY, x, y, description);
      });
    });
  }
  
  handleAction(action, regionX, regionY, tileX, tileY, x, y, description) {
    console.log(`Performing ${action} on ${description} at (${x}, ${y})`);
    
    // Handle different actions
    switch(action) {
      case 'build':
        this.handleBuildAction(regionX, regionY, tileX, tileY, x, y, description);
        break;
      case 'gather':
        this.handleGatherAction(regionX, regionY, tileX, tileY, x, y, description);
        break;
      case 'explore':
        this.handleExploreAction(regionX, regionY, tileX, tileY, x, y, description);
        break;
      case 'settle':
        this.handleSettleAction(regionX, regionY, tileX, tileY, x, y, description);
        break;
      default:
        // For unimplemented actions, show a message
        this.infoPanel.innerHTML = `
          <h3>Action: ${action}</h3>
          <p>Performing ${action} on ${description} at (${x}, ${y})</p>
          <p>This feature is not yet implemented.</p>
          <button id="close-map-back-to-info">Back</button>
        `;
        
        // Add event listener to back button
        const backButton = this.infoPanel.querySelector('#close-map-back-to-info');
        if (backButton) {
          backButton.addEventListener('click', () => {
            // Find the selected tile and trigger a click on it to restore the info panel
            const selectedTile = this.tiles.find(tile => tile.classList.contains('selected'));
            if (selectedTile) {
              this.handleTileClick(
                selectedTile,
                regionX,
                regionY,
                tileX,
                tileY,
                parseInt(selectedTile.dataset.x),
                parseInt(selectedTile.dataset.y),
                selectedTile.dataset.description
              );
            }
          });
        }
    }
  }
  handleSettleAction(regionX, regionY, tileX, tileY, x, y, description) {
    // Show settlement confirmation dialog
    this.infoPanel.innerHTML = `
      <h3>Establish Settlement</h3>
      <p>Are you sure you want to establish a settlement on this ${description} at (${x}, ${y})?</p>
      <p>This will become your tribe's permanent home base.</p>
      <div class="settlement-actions">
        <button id="confirm-settlement" class="primary-button">Confirm Settlement</button>
        <button id="cancel-settlement">Cancel</button>
      </div>
    `;
    
    // Add event listeners to buttons
    const confirmButton = this.infoPanel.querySelector('#confirm-settlement');
    const cancelButton = this.infoPanel.querySelector('#cancel-settlement');
    
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        this.establishSettlement(regionX, regionY, tileX, tileY, x, y, description);
      });
    }
    
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        // Find the selected tile and trigger a click on it to restore the info panel
        const selectedTile = this.tiles.find(tile => tile.classList.contains('selected'));
        if (selectedTile) {
          this.handleTileClick(
            selectedTile,
            regionX,
            regionY,
            tileX,
            tileY,
            parseInt(selectedTile.dataset.x),
            parseInt(selectedTile.dataset.y),
            selectedTile.dataset.description
          );
        }
      });
    }
  }
  
  establishSettlement(regionX, regionY, tileX, tileY, x, y, description) {
    // Show settlement in progress
    this.infoPanel.innerHTML = `
      <h3>Establishing Settlement</h3>
      <p>Your tribe is setting up their new home...</p>
      <div class="settlement-progress">
        <div class="progress-bar" id="settlement-progress-bar"></div>
      </div>
    `;
    
    // Animate progress bar
    const progressBar = document.getElementById('settlement-progress-bar');
    let progress = 0;
    
    const progressInterval = setInterval(() => {
      progress += 2;
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        this.finishSettlement(regionX, regionY, tileX, tileY, x, y, description);
      }
    }, 50);
  }
  
  finishSettlement(regionX, regionY, tileX, tileY, x, y, description) {
    // Update the tile to show the settlement
    const selectedTile = this.tiles.find(tile => 
      parseInt(tile.dataset.x) === x && parseInt(tile.dataset.y) === y
    );
    
    if (selectedTile) {
      // Add a settlement overlay to the tile
      const settlementOverlay = document.createElement('div');
      settlementOverlay.className = 'settlement-overlay';
      settlementOverlay.innerHTML = '🏕️';
      
      // Remove any existing overlays
      const existingOverlays = selectedTile.querySelectorAll('.building-overlay, .settlement-overlay');
      existingOverlays.forEach(overlay => overlay.remove());
      
      selectedTile.appendChild(settlementOverlay);
      
      // Store the settlement information in the tile's dataset
      selectedTile.dataset.settlement = 'true';
      
      // Save the settlement location in localStorage
      localStorage.setItem('settlementLocation', JSON.stringify({
        regionX, regionY, tileX, tileY, x, y, description
      }));
      
      // Update the info panel
      this.infoPanel.innerHTML = `
        <h3>Settlement Established!</h3>
        <p>Your tribe has successfully established their new home on this ${description}.</p>
        <p>This will serve as your base of operations for future explorations and development.</p>
        <button id="close-map-back-to-info">Continue</button>
      `;
      
      // Add event listener to back button
      const backButton = this.infoPanel.querySelector('#close-map-back-to-info');
      if (backButton) {
        backButton.addEventListener('click', () => {
          this.handleTileClick(
            selectedTile,
            regionX,
            regionY,
            tileX,
            tileY,
            x,
            y,
            description
          );
        });
      }
      
      // Trigger an event to notify the game that a settlement has been established
      document.dispatchEvent(new CustomEvent('settlementEstablished', {
        detail: {
          regionX, regionY, tileX, tileY, x, y, description
        }
      }));
    }
  }
}

// Export the class
export default CloseMapView;
