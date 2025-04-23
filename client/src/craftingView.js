import resourceManager from './resourceManager.js';

class CraftingView {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.selectedResources = [];
    this.maxCombinerSlots = 4;
    this.progressInterval = null; // Track progress animation interval
    
    // Initialize the crafting view
    this.initialize();
    
    // Listen for resource updates
    document.addEventListener('resourcesUpdated', this.updateResourceList.bind(this));
  }
  
  // Initialize the crafting view
  initialize() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.id = 'crafting-view';
    this.container.className = 'crafting-view';
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'crafting-header';
    header.innerHTML = `
      <h2>Crafting</h2>
      <button class="close-crafting">×</button>
    `;
    this.container.appendChild(header);
    
    // Add close button functionality
    header.querySelector('.close-crafting').addEventListener('click', () => {
      this.hide();
    });
    
    // Create the main content area
    const content = document.createElement('div');
    content.className = 'crafting-content';
    
    // Create the resource list section
    const resourceListSection = document.createElement('div');
    resourceListSection.className = 'crafting-resources-section';
    resourceListSection.innerHTML = `
      <h3>Available Resources</h3>
      <div class="crafting-resources-list" id="crafting-resources-list"></div>
    `;
    content.appendChild(resourceListSection);
    
    // Create the combiner section
    const combinerSection = document.createElement('div');
    combinerSection.className = 'crafting-combiner-section';
    combinerSection.innerHTML = `
      <h3>Combine Resources</h3>
      <div class="crafting-slots-container">
        <div class="crafting-slots" id="crafting-slots">
          ${Array(this.maxCombinerSlots).fill().map(() => 
            `<div class="crafting-slot" data-empty="true"></div>`
          ).join('')}
        </div>
        <button class="craft-button" id="craft-button">Craft</button>
        <button class="clear-slots-button" id="clear-slots-button">Clear</button>
      </div>
    `;
    content.appendChild(combinerSection);
    
    // Create the result section
    const resultSection = document.createElement('div');
    resultSection.className = 'crafting-result-section';
    resultSection.innerHTML = `
      <h3>Result</h3>
      <div class="crafting-result" id="crafting-result">
        <p class="crafting-instructions">Drag resources to the slots above and click "Craft" to combine them.</p>
      </div>
    `;
    content.appendChild(resultSection);
    
    this.container.appendChild(content);
    
    // Add to the document but hide initially
    document.body.appendChild(this.container);
    this.container.style.display = 'none';
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial resource list population
    this.updateResourceList();
  }
  
  // Set up event listeners for the crafting view
  setupEventListeners() {
    // Craft button
    const craftButton = document.getElementById('craft-button');
    craftButton.addEventListener('click', () => this.craftItems());
    
    // Clear button
    const clearButton = document.getElementById('clear-slots-button');
    clearButton.addEventListener('click', () => this.clearSlots());
    
    // Set up drop zones
    const slots = document.getElementById('crafting-slots');
    slots.addEventListener('dragover', (e) => {
      e.preventDefault();
      const slot = e.target.closest('.crafting-slot');
      if (slot) {
        slot.classList.add('drag-over');
      }
    });
    
    slots.addEventListener('dragleave', (e) => {
      const slot = e.target.closest('.crafting-slot');
      if (slot) {
        slot.classList.remove('drag-over');
      }
    });
    
    slots.addEventListener('drop', (e) => {
      e.preventDefault();
      const slot = e.target.closest('.crafting-slot');
      if (slot) {
        slot.classList.remove('drag-over');
        
        // Get the dragged resource data
        const resourceData = JSON.parse(e.dataTransfer.getData('application/json'));
        
        // Add the resource to the slot
        this.addResourceToSlot(slot, resourceData);
      }
    });
    
    // Allow removing items from slots by clicking
    slots.addEventListener('click', (e) => {
      const slot = e.target.closest('.crafting-slot');
      if (slot && slot.dataset.empty === 'false') {
        this.removeResourceFromSlot(slot);
      }
    });
  }
  
  // Update the resource list
  updateResourceList() {
    const resourceList = document.getElementById('crafting-resources-list');
    if (!resourceList) return;
    
    // Clear existing resources
    resourceList.innerHTML = '';
    
    // Get all resources
    const allResources = resourceManager.getAllResources();
    
    // Create a section for each category
    for (const categoryCode in allResources) {
      const category = allResources[categoryCode];
      const items = category.items;
      
      // Skip empty categories
      if (Object.keys(items).length === 0) continue;
      
      // Create category section
      const categorySection = document.createElement('div');
      categorySection.className = 'crafting-category';
      
      // Add category header
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'crafting-category-header';
      categoryHeader.innerHTML = `
        <span class="category-icon">${category.icon}</span>
        <span class="category-name">${category.name}</span>
      `;
      categorySection.appendChild(categoryHeader);
      
      // Add resources
      const resourceItems = document.createElement('div');
      resourceItems.className = 'crafting-resource-items';
      
      for (const resourceName in items) {
        const resource = items[resourceName];
        
        // Create draggable resource item
        const resourceItem = document.createElement('div');
        resourceItem.className = 'crafting-resource-item';
        resourceItem.draggable = true;
        resourceItem.innerHTML = `
          <span class="resource-icon">${resource.icon}</span>
          <span class="resource-name">${resource.name}</span>
          <span class="resource-quantity">${resource.quantity}</span>
        `;
        
        // Set up drag data
        resourceItem.addEventListener('dragstart', (e) => {
          const resourceData = {
            name: resource.name,
            icon: resource.icon,
            category: categoryCode,
            code: resource.code
          };
          e.dataTransfer.setData('application/json', JSON.stringify(resourceData));
          e.dataTransfer.effectAllowed = 'copy';
        });
        
        resourceItems.appendChild(resourceItem);
      }
      
      categorySection.appendChild(resourceItems);
      resourceList.appendChild(categorySection);
    }
  }
  
  // Add a resource to a slot
  addResourceToSlot(slot, resourceData) {
    // Check if the slot is already filled
    if (slot.dataset.empty === 'false') {
      this.removeResourceFromSlot(slot);
    }
    
    // Get the resource from the resource manager
    const resource = resourceManager.getResource(resourceData.name);
    
    // Make sure we have at least one of this resource
    if (!resource || resource.quantity < 1) {
      this.showNotification('Not enough of this resource available');
      return;
    }
    
    // Add the resource to the slot
    slot.innerHTML = `
      <div class="slot-resource">
        <span class="resource-icon">${resourceData.icon}</span>
        <span class="resource-name">${resourceData.name}</span>
      </div>
    `;
    slot.dataset.empty = 'false';
    slot.dataset.resourceName = resourceData.name;
    slot.dataset.resourceCategory = resourceData.category;
    slot.dataset.resourceCode = resourceData.code || '';
    
    // Add to selected resources
    this.selectedResources.push({
      name: resourceData.name,
      category: resourceData.category,
      code: resourceData.code
    });
    
    // Clear any previous results
    this.clearResult();
  }
  
  // Remove a resource from a slot
  removeResourceFromSlot(slot) {
    const resourceName = slot.dataset.resourceName;
    
    // Remove from selected resources
    this.selectedResources = this.selectedResources.filter(r => r.name !== resourceName);
    
    // Clear the slot
    slot.innerHTML = '';
    slot.dataset.empty = 'true';
    slot.removeAttribute('data-resource-name');
    slot.removeAttribute('data-resource-category');
    slot.removeAttribute('data-resource-code');
    
    // Clear any previous results
    this.clearResult();
  }
  
  // Clear all slots
  clearSlots() {
    const slots = document.querySelectorAll('.crafting-slot');
    slots.forEach(slot => {
      if (slot.dataset.empty === 'false') {
        this.removeResourceFromSlot(slot);
      }
    });
    
    // Clear selected resources
    this.selectedResources = [];
    
    // Clear any previous results
    this.clearResult();
  }
  
  // Clear the result area
  clearResult() {
    const resultArea = document.getElementById('crafting-result');
    resultArea.innerHTML = `
      <p class="crafting-instructions">Drag resources to the slots above and click "Craft" to combine them.</p>
    `;
    
    // Clear any progress interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  
  // Craft items from the selected resources
  async craftItems() {
    // Check if we have any resources selected
    if (this.selectedResources.length === 0) {
      this.showNotification('Add resources to craft something');
      return;
    }
    
    // Show loading state with immersive messages
    const resultArea = document.getElementById('crafting-result');

    const craftingMessages = [
      "Your settlers carefully combine the materials, working with practiced hands...",
      "The skilled crafters of your tribe apply ancient techniques passed down through generations...",
      "With focused determination, your people transform raw materials into something useful...",
      "Careful measurements and precise movements guide the creation process...",
      "The rhythmic sounds of crafting fill the air as your settlers work diligently..."
    ];

    // Get resource-specific messages based on what's being crafted
    const resourceSpecificMessages = this.getCraftingFlavorText(this.selectedResources);

    // Combine general and specific messages
    const allMessages = [...craftingMessages, ...resourceSpecificMessages];

    // Select a random message
    const randomMessage = allMessages[Math.floor(Math.random() * allMessages.length)];

    resultArea.innerHTML = `
      <div class="crafting-loading">
        <p class="crafting-progress-message">${randomMessage}</p>
        <div class="crafting-progress-container">
          <div class="crafting-progress-bar" id="crafting-progress-bar"></div>
        </div>
        <div class="crafting-spinner"></div>
      </div>
    `;

    // Animate the progress bar
    let progress = 0;
    this.progressInterval = setInterval(() => {
      progress += 5;
      const progressBar = document.getElementById('crafting-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
        
        if (progress >= 100) {
          clearInterval(this.progressInterval);
        }
      }
    }, 150);
    
    try {
      // Get the colony name and kin name from localStorage
      const colonyName = localStorage.getItem('colonyName') || 'Your Colony';
      const kinName = localStorage.getItem('kinName') || 'defaultcolony';
      
      // Prepare the resources for the API call
      const resourcesInput = this.selectedResources.map(r => {
        const resource = resourceManager.getResource(r.name);
        return {
          name: r.name,
          code: r.code || '',
          category: r.category,
          quantity: 1, // We're using 1 of each selected resource
          icon: resource ? resource.icon : '📦'
        };
      });
      
      // Prepare the message for KinOS
      const messageContent = `
I want to craft something by combining these resources:
${resourcesInput.map(r => `- ${r.name} (${r.code || 'no code'})`).join('\n')}

Please analyze what could be crafted from these materials based on prehistoric technology.

Return your response as a JSON object with these properties:
- success: boolean indicating if crafting is possible
- result: object describing the crafted item (if success is true)
  - name: name of the crafted item
  - description: brief description of the item
  - code: resource code for the item
  - category: resource category code
  - icon: emoji representing the item
  - quantity: how many were crafted
- consumedResources: array of objects representing consumed resources
  - name: resource name
  - quantity: amount consumed
- remainingResources: array of objects for resources not fully consumed
  - name: resource name
  - quantity: amount remaining
- message: crafting process description
- error: error message (if success is false)

Example response:
{
  "success": true,
  "result": {
    "name": "Stone Axe",
    "description": "A basic tool for chopping wood",
    "code": "R-TOL-003",
    "category": "R-TOL",
    "icon": "🪓",
    "quantity": 1
  },
  "consumedResources": [
    {"name": "Stone", "quantity": 1},
    {"name": "Wood", "quantity": 1}
  ],
  "remainingResources": [],
  "message": "You've successfully crafted a Stone Axe by attaching a sharpened stone to a wooden handle."
}
`;

      // Make request to KinOS
      console.log('Sending crafting request to KinOS');
      const response = await fetch(`http://localhost:3000/api/kinos/kins/${kinName}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: messageContent,
          model: "claude-3-7-sonnet-latest",
          history_length: 25,
          mode: "crafting_resolution",
          addSystem: "You are a crafting system for a prehistoric settlement game. Analyze the provided resources and determine what could realistically be crafted using prehistoric technology. Return only valid JSON that matches the requested format. Be historically accurate about what could be crafted with the given materials."
        })
      });
      
      if (!response.ok) {
        throw new Error(`KinOS API request failed with status ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Crafting response:', responseData);
      
      // Extract the JSON from the response
      const contentText = responseData.response || responseData.content;
      
      // Try to parse the JSON
      let craftingResult;
      try {
        // Find JSON object in the response
        const jsonMatch = contentText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          craftingResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing crafting result:', parseError);
        throw new Error('Failed to parse crafting response');
      }
      
      // Process the crafting result
      if (craftingResult.success) {
        try {
          // Remove consumed resources
          let allResourcesAvailable = true;
          
          // First check if all resources are available
          for (const resource of craftingResult.consumedResources) {
            const existingResource = resourceManager.getResource(resource.name);
            if (!existingResource || existingResource.quantity < resource.quantity) {
              allResourcesAvailable = false;
              console.warn(`Not enough ${resource.name} available for crafting`);
              break;
            }
          }
          
          if (allResourcesAvailable) {
            // Remove the resources
            craftingResult.consumedResources.forEach(resource => {
              resourceManager.removeResource(resource.name, resource.quantity);
            });
            
            // Add the crafted item
            resourceManager.addResource(
              craftingResult.result.name, 
              craftingResult.result.quantity, 
              craftingResult.result.code
            );
            
            // Show the result
            this.showCraftingResult(craftingResult);
            
            // Clear the slots
            this.clearSlots();
          } else {
            // Not enough resources
            this.showCraftingError("Not enough resources available to complete crafting");
          }
        } catch (error) {
          console.error('Error processing crafting result:', error);
          this.showCraftingError(`Error during crafting: ${error.message}`);
        }
      } else {
        // Show the error
        this.showCraftingError(craftingResult.error || 'Crafting failed');
      }
    } catch (error) {
      console.error('Error during crafting:', error);
      this.showCraftingError(error.message);
    }
  }
  
  // Show the crafting result
  showCraftingResult(result) {
    // Clear any progress interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    const resultArea = document.getElementById('crafting-result');
    
    resultArea.innerHTML = `
      <div class="crafting-success">
        <div class="crafted-item">
          <span class="resource-icon">${result.result.icon}</span>
          <div class="crafted-item-details">
            <h4>${result.result.name}</h4>
            <p>${result.result.description}</p>
          </div>
        </div>
        <div class="crafting-message">${result.message}</div>
        <div class="resources-summary">
          <div class="resources-consumed">
            <h5>Resources Used:</h5>
            <ul>
              ${result.consumedResources.map(r => 
                `<li>${r.name} x${r.quantity}</li>`
              ).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
    
    // Show a notification
    this.showNotification(`Crafted: ${result.result.name}`);
  }
  
  // Show a crafting error
  showCraftingError(errorMessage) {
    // Clear any progress interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    const resultArea = document.getElementById('crafting-result');
    
    resultArea.innerHTML = `
      <div class="crafting-error">
        <p>${errorMessage}</p>
        <p class="crafting-try-again">Try a different combination of resources.</p>
      </div>
    `;
  }
  
  // Show a notification
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
  
  // Show the crafting view
  show() {
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    // Update the resource list
    this.updateResourceList();
    
    // Add animation class
    setTimeout(() => {
      this.container.classList.add('visible');
    }, 10);
  }
  
  // Hide the crafting view
  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
    
    // Wait for animation to complete
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 300);
  }
  
  // Toggle the crafting view
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  // Get crafting flavor text based on selected resources
  getCraftingFlavorText(resources) {
    const messages = [];
    
    // Check for specific resource combinations and add appropriate messages
    const resourceNames = resources.map(r => r.name.toLowerCase());
    
    if (resourceNames.some(name => name.includes('wood'))) {
      messages.push("The wood is carefully shaped and smoothed with practiced motions...");
      messages.push("Skilled hands carve and shape the wood with precision...");
    }
    
    if (resourceNames.some(name => name.includes('stone'))) {
      messages.push("The stone is methodically chipped and ground to the desired form...");
      messages.push("Each strike against the stone is deliberate and controlled...");
    }
    
    if (resourceNames.some(name => name.includes('fiber') || name.includes('plant'))) {
      messages.push("The fibers are twisted and woven with nimble fingers...");
      messages.push("Patient hands work the fibers into strong, flexible material...");
    }
    
    if (resourceNames.some(name => name.includes('clay'))) {
      messages.push("The clay is kneaded and shaped with careful attention to detail...");
      messages.push("Wet clay takes form under the skilled touch of your crafters...");
    }
    
    // Add messages for combinations
    if (resourceNames.some(name => name.includes('wood')) && 
        resourceNames.some(name => name.includes('stone'))) {
      messages.push("Wood and stone are joined together with ingenious techniques...");
      messages.push("The complementary properties of wood and stone are expertly balanced...");
    }
    
    // Return at least one message even if no specific resources were matched
    if (messages.length === 0) {
      messages.push("The materials transform under the skilled hands of your crafters...");
      messages.push("Your settlers work methodically, their expertise evident in every movement...");
    }
    
    return messages;
  }
}

// Create and export a singleton instance
const craftingView = new CraftingView();
export default craftingView;
