import { createWelcomeScreen } from './welcomeScreen.js';

// Create the authentication screen
function createAuthScreen() {
  // Create container
  const authContainer = document.createElement('div');
  authContainer.id = 'auth-screen';
  authContainer.className = 'fullscreen-overlay';
  
  // Create centered content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'centered-content';
  authContainer.appendChild(contentWrapper);
  
  // Add title
  const title = document.createElement('h1');
  title.textContent = 'Autonomous Realms';
  title.className = 'welcome-title';
  contentWrapper.appendChild(title);
  
  // Add subtitle
  const subtitle = document.createElement('h2');
  subtitle.textContent = 'An AI-powered settlement simulation';
  subtitle.className = 'welcome-subtitle';
  contentWrapper.appendChild(subtitle);
  
  // Create auth form container
  const authForm = document.createElement('div');
  authForm.className = 'auth-form';
  
  // Create tabs for login/register
  const tabContainer = document.createElement('div');
  tabContainer.className = 'auth-tabs';
  
  const loginTab = document.createElement('div');
  loginTab.className = 'auth-tab active';
  loginTab.textContent = 'Login';
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  });
  
  const registerTab = document.createElement('div');
  registerTab.className = 'auth-tab';
  registerTab.textContent = 'Register';
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
  });
  
  tabContainer.appendChild(loginTab);
  tabContainer.appendChild(registerTab);
  authForm.appendChild(tabContainer);
  
  // Create login form
  const loginForm = document.createElement('form');
  loginForm.className = 'login-form';
  loginForm.innerHTML = `
    <div class="form-group">
      <label for="login-username">Username</label>
      <input type="text" id="login-username" required>
    </div>
    <div class="form-group">
      <label for="login-password">Password</label>
      <input type="password" id="login-password" required>
    </div>
    <div class="form-error" id="login-error"></div>
    <button type="submit" class="auth-button">Login</button>
  `;
  
  // Create register form
  const registerForm = document.createElement('form');
  registerForm.className = 'register-form';
  registerForm.style.display = 'none';
  registerForm.innerHTML = `
    <div class="form-group">
      <label for="register-username">Username</label>
      <input type="text" id="register-username" required>
    </div>
    <div class="form-group">
      <label for="register-email">Email</label>
      <input type="email" id="register-email" required>
    </div>
    <div class="form-group">
      <label for="register-password">Password</label>
      <input type="password" id="register-password" required>
    </div>
    <div class="form-group">
      <label for="register-confirm-password">Confirm Password</label>
      <input type="password" id="register-confirm-password" required>
    </div>
    <div class="form-error" id="register-error"></div>
    <button type="submit" class="auth-button">Register</button>
  `;
  
  // Guest login option removed
  
  // Add forms to auth form container
  authForm.appendChild(loginForm);
  authForm.appendChild(registerForm);
  
  // Add auth form to content wrapper
  contentWrapper.appendChild(authForm);
  
  // Add version info
  const versionInfo = document.createElement('div');
  versionInfo.className = 'version-info';
  versionInfo.textContent = 'Version 0.1.0';
  authContainer.appendChild(versionInfo);
  
  // Add to document body
  document.body.appendChild(authContainer);
  
  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    // Clear previous errors
    errorElement.textContent = '';
    
    // Show loading state
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Store user info in localStorage
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);
      localStorage.setItem('isGuest', 'false');
      
      // Remove auth screen and show welcome screen
      authContainer.remove();
      createWelcomeScreen();
      
    } catch (error) {
      // Check if it's a connection error
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorElement.textContent = 'Cannot connect to server. Please check your connection and try again.';
      } else {
        errorElement.textContent = error.message;
      }
      
      // Reset button
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
  
  // Handle register form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorElement = document.getElementById('register-error');
    
    // Clear previous errors
    errorElement.textContent = '';
    
    // Validate passwords match
    if (password !== confirmPassword) {
      errorElement.textContent = 'Passwords do not match';
      return;
    }
    
    // Show loading state
    const submitButton = registerForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Registering...';
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Show success message and switch to login tab
      errorElement.textContent = 'Registration successful! Please log in.';
      errorElement.style.color = '#4CAF50';
      
      // Reset form
      registerForm.reset();
      
      // Switch to login tab after a short delay
      setTimeout(() => {
        loginTab.click();
      }, 1500);
      
    } catch (error) {
      // Check if it's a connection error
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorElement.textContent = 'Cannot connect to server. Please check your connection and try again.';
      } else {
        errorElement.textContent = error.message;
      }
    } finally {
      // Reset button
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}

export { createAuthScreen };
