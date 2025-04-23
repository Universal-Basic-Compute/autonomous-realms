// Resource Manager - Tracks and categorizes all resources
class ResourceManager {
  constructor() {
    this.resources = {
      // Natural Resources
      'R-NAT': {
        name: 'Natural',
        icon: '🌿',
        items: {}
      },
      // Food Resources
      'R-FOD': {
        name: 'Food',
        icon: '🍎',
        items: {}
      },
      // Processed Materials
      'R-MAT': {
        name: 'Materials',
        icon: '🧶',
        items: {}
      },
      // Tools
      'R-TOL': {
        name: 'Tools',
        icon: '🔨',
        items: {}
      },
      // Weapons
      'R-WPN': {
        name: 'Weapons',
        icon: '🏹',
        items: {}
      },
      // Structures
      'R-STR': {
        name: 'Structures',
        icon: '🏠',
        items: {}
      },
      // Clothing/Textiles
      'R-CLT': {
        name: 'Clothing',
        icon: '👕',
        items: {}
      },
      // Medicinal Resources
      'R-MED': {
        name: 'Medicine',
        icon: '💊',
        items: {}
      },
      // Ceremonial/Cultural Items
      'R-CER': {
        name: 'Cultural',
        icon: '🏺',
        items: {}
      },
      // Water-Related Resources
      'R-WAT': {
        name: 'Water',
        icon: '💧',
        items: {}
      },
      // Uncategorized (fallback)
      'MISC': {
        name: 'Misc',
        icon: '📦',
        items: {}
      }
    };
    
    // Load saved resources from localStorage
    this.loadResources();
  }
  
  // Add a resource to the inventory
  addResource(resourceName, quantity = 1, resourceCode = null) {
    // Determine the category based on the resource code or name
    const category = this.determineCategory(resourceName, resourceCode);
    
    // Check if the resource already exists in the category
    if (this.resources[category].items[resourceName]) {
      // Update the quantity
      this.resources[category].items[resourceName].quantity += quantity;
    } else {
      // Add a new resource
      this.resources[category].items[resourceName] = {
        name: resourceName,
        quantity: quantity,
        code: resourceCode,
        icon: this.determineIcon(resourceName, category)
      };
    }
    
    // Save the updated resources
    this.saveResources();
    
    // Trigger an update event
    this.triggerUpdate();
    
    return {
      category,
      resource: this.resources[category].items[resourceName]
    };
  }
  
  // Remove a resource from the inventory
  removeResource(resourceName, quantity = 1) {
    // Find the category containing this resource
    const category = this.findResourceCategory(resourceName);
    
    if (!category) {
      console.warn(`Resource "${resourceName}" not found in inventory`);
      return false;
    }
    
    // Update the quantity
    this.resources[category].items[resourceName].quantity -= quantity;
    
    // Remove the resource if quantity is zero or less
    if (this.resources[category].items[resourceName].quantity <= 0) {
      delete this.resources[category].items[resourceName];
    }
    
    // Save the updated resources
    this.saveResources();
    
    // Trigger an update event
    this.triggerUpdate();
    
    return true;
  }
  
  // Get all resources
  getAllResources() {
    return this.resources;
  }
  
  // Get resources in a specific category
  getCategoryResources(category) {
    return this.resources[category] || null;
  }
  
  // Get a specific resource
  getResource(resourceName) {
    const category = this.findResourceCategory(resourceName);
    if (!category) return null;
    
    return this.resources[category].items[resourceName];
  }
  
  // Find which category contains a resource
  findResourceCategory(resourceName) {
    for (const category in this.resources) {
      if (this.resources[category].items[resourceName]) {
        return category;
      }
    }
    return null;
  }
  
  // Determine the category based on resource code or name
  determineCategory(resourceName, resourceCode) {
    if (resourceCode) {
      // Extract category from resource code (e.g., "R-NAT-001" -> "R-NAT")
      const match = resourceCode.match(/^(R-[A-Z]{3})/);
      if (match && this.resources[match[1]]) {
        return match[1];
      }
    }
    
    // Try to determine category from name using keywords
    const nameToCategory = {
      'wood': 'R-NAT',
      'stone': 'R-NAT',
      'herb': 'R-NAT',
      'plant': 'R-NAT',
      'fiber': 'R-NAT',
      'clay': 'R-NAT',
      'meat': 'R-FOD',
      'fish': 'R-FOD',
      'fruit': 'R-FOD',
      'berry': 'R-FOD',
      'food': 'R-FOD',
      'water': 'R-FOD',
      'rope': 'R-MAT',
      'cloth': 'R-MAT',
      'leather': 'R-MAT',
      'tool': 'R-TOL',
      'knife': 'R-TOL',
      'axe': 'R-TOL',
      'hammer': 'R-TOL',
      'spear': 'R-WPN',
      'bow': 'R-WPN',
      'arrow': 'R-WPN',
      'shelter': 'R-STR',
      'hut': 'R-STR',
      'clothing': 'R-CLT',
      'garment': 'R-CLT',
      'medicine': 'R-MED',
      'remedy': 'R-MED',
      'ceremonial': 'R-CER',
      'ritual': 'R-CER'
    };
    
    const lowerName = resourceName.toLowerCase();
    for (const keyword in nameToCategory) {
      if (lowerName.includes(keyword)) {
        return nameToCategory[keyword];
      }
    }
    
    // Default to miscellaneous if no category is determined
    return 'MISC';
  }
  
  // Determine an appropriate icon for a resource
  determineIcon(resourceName, category) {
    // Default icons based on category
    const categoryIcons = {
      'R-NAT': '🌿',
      'R-FOD': '🍎',
      'R-MAT': '🧶',
      'R-TOL': '🔨',
      'R-WPN': '🏹',
      'R-STR': '🏠',
      'R-CLT': '👕',
      'R-MED': '💊',
      'R-CER': '🏺',
      'R-WAT': '💧',
      'MISC': '📦'
    };
    
    // Specific resource name to icon mapping
    const nameToIcon = {
      'wood': '🪵',
      'stone': '🪨',
      'clay': '🧱',
      'meat': '🥩',
      'fish': '🐟',
      'fruit': '🍇',
      'berries': '🫐',
      'water': '💧',
      'rope': '🧵',
      'cloth': '🧶',
      'leather': '🥬',
      'knife': '🔪',
      'axe': '🪓',
      'hammer': '🔨',
      'spear': '🔱',
      'bow': '🏹',
      'arrow': '➡️',
      'shelter': '⛺',
      'hut': '🏠',
      'clothing': '👕',
      'medicine': '💊',
      'herbs': '🌿'
    };
    
    const lowerName = resourceName.toLowerCase();
    
    // Check for specific resource name match
    for (const name in nameToIcon) {
      if (lowerName.includes(name)) {
        return nameToIcon[name];
      }
    }
    
    // Return the default category icon
    return categoryIcons[category];
  }
  
  // Save resources to localStorage
  saveResources() {
    try {
      localStorage.setItem('resources', JSON.stringify(this.resources));
    } catch (error) {
      console.error('Error saving resources to localStorage:', error);
    }
  }
  
  // Load resources from localStorage
  loadResources() {
    try {
      const savedResources = localStorage.getItem('resources');
      if (savedResources) {
        this.resources = JSON.parse(savedResources);
      }
    } catch (error) {
      console.error('Error loading resources from localStorage:', error);
    }
  }
  
  // Clear all resources
  clearResources() {
    // Reset each category's items to empty
    for (const category in this.resources) {
      this.resources[category].items = {};
    }
    
    // Save the cleared resources
    this.saveResources();
    
    // Trigger an update event
    this.triggerUpdate();
  }
  
  // Trigger an update event for UI components to listen to
  triggerUpdate() {
    const event = new CustomEvent('resourcesUpdated', { 
      detail: { resources: this.resources } 
    });
    document.dispatchEvent(event);
  }
}

// Create and export a singleton instance
const resourceManager = new ResourceManager();
export default resourceManager;
