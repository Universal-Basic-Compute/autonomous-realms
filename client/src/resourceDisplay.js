import resourceManager from './resourceManager.js';

// Resource Display - Shows resources in a categorized menu at the top of the screen
class ResourceDisplay {
  constructor() {
    this.container = null;
    this.isExpanded = false;
    this.activeCategory = null;
    
    // Initialize the display
    this.initialize();
    
    // Listen for resource updates
    document.addEventListener('resourcesUpdated', this.updateDisplay.bind(this));
  }
  
  // Initialize the resource display
  initialize() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.id = 'resource-display';
    this.container.className = 'resource-display';
    
    // Create the category bar
    this.categoryBar = document.createElement('div');
    this.categoryBar.className = 'resource-categories';
    this.container.appendChild(this.categoryBar);
    
    // Create the details panel (initially hidden)
    this.detailsPanel = document.createElement('div');
    this.detailsPanel.className = 'resource-details';
    this.detailsPanel.style.display = 'none';
    this.container.appendChild(this.detailsPanel);
    
    // Add to the document
    document.body.appendChild(this.container);
    
    // Initial render
    this.renderCategories();
  }
  
  // Render the category buttons
  renderCategories() {
    // Clear existing categories
    this.categoryBar.innerHTML = '';
    
    // Get all resources
    const resources = resourceManager.getAllResources();
    
    // Create a button for each category that has items
    for (const categoryCode in resources) {
      const category = resources[categoryCode];
      const itemCount = Object.keys(category.items).length;
      
      // Skip empty categories
      if (itemCount === 0) continue;
      
      // Create category button
      const categoryButton = document.createElement('div');
      categoryButton.className = 'resource-category';
      categoryButton.dataset.category = categoryCode;
      
      if (this.activeCategory === categoryCode) {
        categoryButton.classList.add('active');
      }
      
      // Add icon and count
      categoryButton.innerHTML = `
        <span class="category-icon">${category.icon}</span>
        <span class="category-count">${itemCount}</span>
      `;
      
      // Add tooltip with category name
      categoryButton.title = category.name;
      
      // Add click handler
      categoryButton.addEventListener('click', () => {
        this.toggleCategory(categoryCode);
      });
      
      // Add to category bar
      this.categoryBar.appendChild(categoryButton);
    }
    
    // Add a toggle button for collapsing/expanding
    const toggleButton = document.createElement('div');
    toggleButton.className = 'resource-toggle';
    toggleButton.innerHTML = this.isExpanded ? '▲' : '▼';
    toggleButton.addEventListener('click', () => {
      this.toggleExpanded();
    });
    this.categoryBar.appendChild(toggleButton);
  }
  
  // Render the details for a specific category
  renderCategoryDetails(categoryCode) {
    // Clear existing details
    this.detailsPanel.innerHTML = '';
    
    // Get the category resources
    const category = resourceManager.getCategoryResources(categoryCode);
    
    if (!category) {
      this.detailsPanel.innerHTML = '<p>Category not found</p>';
      return;
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'details-header';
    header.innerHTML = `
      <span class="category-icon">${category.icon}</span>
      <h3>${category.name} Resources</h3>
      <button class="close-details">×</button>
    `;
    
    // Add close button handler
    header.querySelector('.close-details').addEventListener('click', () => {
      this.closeDetails();
    });
    
    this.detailsPanel.appendChild(header);
    
    // Create resource list
    const resourceList = document.createElement('div');
    resourceList.className = 'resource-list';
    
    // Add each resource
    const items = category.items;
    if (Object.keys(items).length === 0) {
      resourceList.innerHTML = '<p class="no-resources">No resources in this category</p>';
    } else {
      for (const resourceName in items) {
        const resource = items[resourceName];
        
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        resourceItem.innerHTML = `
          <span class="resource-icon">${resource.icon}</span>
          <span class="resource-name">${resource.name}</span>
          <span class="resource-quantity">${resource.quantity}</span>
        `;
        
        resourceList.appendChild(resourceItem);
      }
    }
    
    this.detailsPanel.appendChild(resourceList);
  }
  
  // Toggle a category's details
  toggleCategory(categoryCode) {
    if (this.activeCategory === categoryCode) {
      // If clicking the active category, close it
      this.closeDetails();
    } else {
      // Otherwise, show the details for this category
      this.activeCategory = categoryCode;
      this.renderCategoryDetails(categoryCode);
      this.detailsPanel.style.display = 'block';
      
      // Update active state in category buttons
      const categoryButtons = this.categoryBar.querySelectorAll('.resource-category');
      categoryButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.category === categoryCode);
      });
    }
  }
  
  // Close the details panel
  closeDetails() {
    this.activeCategory = null;
    this.detailsPanel.style.display = 'none';
    
    // Remove active state from all category buttons
    const categoryButtons = this.categoryBar.querySelectorAll('.resource-category');
    categoryButtons.forEach(button => {
      button.classList.remove('active');
    });
  }
  
  // Toggle expanded/collapsed state
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    
    if (!this.isExpanded) {
      // When collapsing, also close details
      this.closeDetails();
    }
    
    // Update toggle button
    const toggleButton = this.categoryBar.querySelector('.resource-toggle');
    if (toggleButton) {
      toggleButton.innerHTML = this.isExpanded ? '▲' : '▼';
    }
    
    // Update container class
    this.container.classList.toggle('expanded', this.isExpanded);
  }
  
  // Update the display when resources change
  updateDisplay(event) {
    // Render the categories
    this.renderCategories();
    
    // If a category is active, update its details
    if (this.activeCategory) {
      this.renderCategoryDetails(this.activeCategory);
    }
    
    // Show a notification for new resources
    if (event && event.detail && event.detail.newResource) {
      this.showResourceNotification(event.detail.newResource);
    }
  }
  
  // Show a notification when a new resource is added
  showResourceNotification(resource) {
    const notification = document.createElement('div');
    notification.className = 'resource-notification';
    notification.innerHTML = `
      <span class="resource-icon">${resource.icon}</span>
      <span class="resource-text">Gained ${resource.quantity} ${resource.name}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
}

// Create and export a singleton instance
const resourceDisplay = new ResourceDisplay();
export default resourceDisplay;
