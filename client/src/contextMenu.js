// contextMenu.js - Handles the context menu for right-clicking on tiles

import CloseMapView from './closeMapView.js';

class ContextMenu {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.position = { x: 0, y: 0 };
    this.targetTile = null;
    this.closeMapView = new CloseMapView();
    
    // Initialize the context menu
    this.initialize();
    
    // Listen for clicks outside the menu to close it
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.container.contains(e.target)) {
        this.hide();
      }
    });
    
    // Listen for scroll events to hide the menu
    document.addEventListener('wheel', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
    
    // Listen for window resize to hide the menu
    window.addEventListener('resize', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
  }
  
  initialize() {
    // Create the context menu container
    this.container = document.createElement('div');
    this.container.className = 'context-menu';
    document.body.appendChild(this.container);
    
    // Add CSS for the context menu
    this.addStyles();
  }
  
  addStyles() {
    // Check if styles already exist
    if (document.getElementById('context-menu-styles')) return;
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'context-menu-styles';
    
    // Add CSS rules
    style.textContent = `
      .context-menu {
        position: absolute;
        background-color: #2c3e50;
        border: 1px solid #34495e;
        border-radius: 4px;
        padding: 5px 0;
        min-width: 150px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: none;
        font-family: 'Montserrat', sans-serif;
      }
      
      .context-menu-item {
        padding: 8px 15px;
        cursor: pointer;
        color: white;
        transition: background-color 0.2s;
      }
      
      .context-menu-item:hover {
        background-color: #34495e;
      }
      
      .context-menu-separator {
        height: 1px;
        background-color: #34495e;
        margin: 5px 0;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(style);
  }
  
  show(x, y, tile) {
    // Store the target tile
    this.targetTile = tile;
    
    // Position the menu
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    
    // Clear existing menu items
    this.container.innerHTML = '';
    
    // Add menu items based on the tile
    this.addMenuItems(tile);
    
    // Show the menu
    this.container.style.display = 'block';
    this.isVisible = true;
  }
  
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
    this.targetTile = null;
  }
  
  addMenuItems(tile) {
    // Add tile info item
    this.addMenuItem(`Tile: ${tile.dataset.x}, ${tile.dataset.y}`, () => {
      console.log('Tile info clicked', tile);
      // Select the tile to show info
      selectTile(tile);
    });
    
    // Add separator
    this.addSeparator();
    
    // Add "Settle" option
    this.addMenuItem('Settle', () => {
      console.log('Settle clicked', tile);
      
      // Get tile information needed for close map
      const tileX = parseInt(tile.dataset.x);
      const tileY = parseInt(tile.dataset.y);
      const regionX = parseInt(tile.dataset.regionX || 0);
      const regionY = parseInt(tile.dataset.regionY || 0);
      
      // Fetch tile info to get terrain code and description
      fetch(`http://localhost:3000/api/tiles/islands/${tileX}/${tileY}/info`)
        .then(response => response.json())
        .then(data => {
          if (data.exists) {
            // Create tile data object
            const tileData = {
              position: { regionX, regionY, x: tileX, y: tileY },
              terrainCode: data.terrainCode,
              terrainDescription: data.description
            };
            
            // Show the close map view
            this.closeMapView.show(tileData);
          } else {
            console.error('Cannot settle: Tile information not available');
            
            // Show notification
            const notification = document.createElement('div');
            notification.className = 'notification error-notification';
            notification.textContent = 'Cannot settle: Tile information not available';
            document.body.appendChild(notification);
            
            // Remove notification after a delay
            setTimeout(() => {
              notification.classList.add('fade-out');
              setTimeout(() => notification.remove(), 1000);
            }, 3000);
          }
        })
        .catch(error => {
          console.error('Error fetching tile info:', error);
          
          // Show notification
          const notification = document.createElement('div');
          notification.className = 'notification error-notification';
          notification.textContent = `Error: ${error.message}`;
          document.body.appendChild(notification);
          
          // Remove notification after a delay
          setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 1000);
          }, 3000);
        });
    });
    
    // Add "Explore" option
    this.addMenuItem('Explore', () => {
      console.log('Explore clicked', tile);
      // Implement explore functionality
      
      // Show notification
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = 'Explore functionality coming soon';
      document.body.appendChild(notification);
      
      // Remove notification after a delay
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 1000);
      }, 3000);
    });
    
    // Add "Gather Resources" option
    this.addMenuItem('Gather Resources', () => {
      console.log('Gather Resources clicked', tile);
      // Implement gather resources functionality
      
      // Show notification
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = 'Gather Resources functionality coming soon';
      document.body.appendChild(notification);
      
      // Remove notification after a delay
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 1000);
      }, 3000);
    });
  }
  
  addMenuItem(text, onClick) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = text;
    item.addEventListener('click', () => {
      onClick();
      this.hide();
    });
    this.container.appendChild(item);
  }
  
  addSeparator() {
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    this.container.appendChild(separator);
  }
}

// Export the class
export default ContextMenu;
