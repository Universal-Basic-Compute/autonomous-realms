class AudioPlayer {
  constructor() {
    this.audioElement = null;
    this.currentTrack = null;
    this.musicList = [];
    this.isPlaying = false;
    this.volume = 0.3; // Default volume (30%)
    this.initialize();
  }

  initialize() {
    // Create audio element
    this.audioElement = document.createElement('audio');
    this.audioElement.id = 'background-music';
    this.audioElement.loop = false; // Don't loop individual tracks
    this.audioElement.volume = this.volume;
    document.body.appendChild(this.audioElement);

    // Add event listener for when a track ends
    this.audioElement.addEventListener('ended', () => {
      console.log('Track ended, playing next track');
      this.playRandomTrack();
    });

    // Add error event listener
    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      console.error('Error code:', this.audioElement.error ? this.audioElement.error.code : 'unknown');
      console.error('Current src:', this.audioElement.src);
      
      // Try playing another track after a short delay
      setTimeout(() => {
        console.log('Attempting to play another track after error');
        this.playRandomTrack();
      }, 3000);
    });

    // Add debugging listeners
    this.audioElement.addEventListener('loadstart', () => console.log('Audio loading started'));
    this.audioElement.addEventListener('canplay', () => console.log('Audio can start playing'));
    this.audioElement.addEventListener('canplaythrough', () => console.log('Audio can play through'));
    this.audioElement.addEventListener('play', () => console.log('Audio playback started'));
    this.audioElement.addEventListener('pause', () => console.log('Audio playback paused'));

    // Fetch the list of available music tracks
    this.fetchMusicList();
    
    // Add autoplay attempt when user interacts with the page
    this.setupAutoplay();
  }

  async fetchMusicList() {
    try {
      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching music list from server...');
      const response = await fetch(`${serverUrl}/api/data/music/list`);
      if (!response.ok) {
        console.error('Failed to fetch music list:', response.statusText);
        return;
      }
      
      const data = await response.json();
      this.musicList = data.tracks || [];
      
      if (this.musicList.length > 0) {
        console.log(`Loaded ${this.musicList.length} music tracks:`, this.musicList);
        
        // Start playing immediately or if autoplay was requested during loading
        if (!this.isPlaying || this._autoplayRequested) {
          this.playRandomTrack();
          this._autoplayRequested = false;
        }
      } else {
        console.warn('No music tracks available');
      }
    } catch (error) {
      console.error('Error fetching music list:', error);
    }
  }

  playRandomTrack() {
    if (this.musicList.length === 0) {
      console.warn('No music tracks available to play');
      return;
    }

    // Select a random track, different from the current one if possible
    let randomIndex;
    if (this.musicList.length === 1) {
      randomIndex = 0;
    } else {
      // Avoid playing the same track twice in a row
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * this.musicList.length);
      } while (this.musicList[newIndex] === this.currentTrack && this.musicList.length > 1);
      randomIndex = newIndex;
    }

    const track = this.musicList[randomIndex];
    this.currentTrack = track;
    
    // Set the audio source and play
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const audioUrl = `${serverUrl}/api/data/music/play/${track}`;
    console.log(`Setting audio source to: ${audioUrl}`);
    
    // Reset any previous errors
    this.audioElement.onerror = this.handleAudioError.bind(this);
    
    // Try to load and play the audio
    this.audioElement.src = audioUrl;
    this.tryPlayWithFallbacks();
    
    this.isPlaying = true;
    console.log(`Now playing: ${track}`);
  }

  setVolume(volume) {
    // Ensure volume is between 0 and 1
    this.volume = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = this.volume;
  }

  toggleMute() {
    this.audioElement.muted = !this.audioElement.muted;
    return this.audioElement.muted;
  }

  pause() {
    if (this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
    }
  }

  resume() {
    if (!this.isPlaying && this.currentTrack) {
      this.audioElement.play().catch(error => {
        console.error('Error resuming audio:', error);
      });
      this.isPlaying = true;
    }
  }
  // Method to manually restart music playback
  restartMusic() {
    console.log('Manually restarting music playback');
    // Stop current playback if any
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    // Reset retry counter
    this._retryCount = 0;
    
    // Refetch the music list and start playing
    this.fetchMusicList();
  }
  
  // Handle audio errors with retry logic
  handleAudioError(error) {
    console.error('Audio playback error:', error);
    console.error('Error code:', this.audioElement.error ? this.audioElement.error.code : 'unknown');
    console.error('Current src:', this.audioElement.src);
    
    // Check if we've exceeded max retries
    if (this._retryCount && this._retryCount >= 3) {
      console.log('Maximum retry attempts reached, trying another track');
      this._retryCount = 0;
      
      // Try playing another track after a short delay
      setTimeout(() => {
        this.playRandomTrack();
      }, 3000);
      return;
    }
    
    // Initialize retry count if not set
    if (!this._retryCount) this._retryCount = 0;
    this._retryCount++;
    
    // Calculate backoff delay (1s, 2s, 4s)
    const backoffDelay = Math.pow(2, this._retryCount - 1) * 1000;
    
    console.log(`Retry attempt ${this._retryCount} in ${backoffDelay}ms`);
    
    // Try again with a different approach after backoff delay
    setTimeout(() => {
      this.tryPlayWithFallbacks();
    }, backoffDelay);
  }

  // Try different playback approaches
  tryPlayWithFallbacks() {
    // Get current source
    const currentSrc = this.audioElement.src;
    
    // Try to play
    this.audioElement.load(); // Force reload
    
    this.audioElement.play().catch(error => {
      console.error('Error playing audio:', error);
      
      // If this is a format error, try adding a format parameter
      if (error.name === 'NotSupportedError' && !currentSrc.includes('format=')) {
        console.log('Trying with explicit format parameter');
        
        // Try with explicit MP3 format
        const formatUrl = currentSrc.includes('?') 
          ? `${currentSrc}&format=mp3` 
          : `${currentSrc}?format=mp3`;
        
        this.audioElement.src = formatUrl;
        this.audioElement.load();
        this.audioElement.play().catch(err => {
          console.warn('Still failed with format parameter:', err);
          // Error will be handled by the onerror handler
        });
      }
    });
  }
  
  setupAutoplay() {
    // Most browsers require user interaction before allowing autoplay
    // This function sets up event listeners to start music on first interaction
    
    const startAudioOnInteraction = () => {
      console.log('User interaction detected, attempting to start audio');
      
      // If we already have tracks, play one
      if (this.musicList.length > 0) {
        this.playRandomTrack();
      } else {
        // If tracks haven't loaded yet, set a flag to play as soon as they do
        this._autoplayRequested = true;
      }
      
      // Remove the event listeners once we've captured an interaction
      document.removeEventListener('click', startAudioOnInteraction);
      document.removeEventListener('keydown', startAudioOnInteraction);
      document.removeEventListener('touchstart', startAudioOnInteraction);
    };
    
    // Add event listeners for common user interactions
    document.addEventListener('click', startAudioOnInteraction);
    document.addEventListener('keydown', startAudioOnInteraction);
    document.addEventListener('touchstart', startAudioOnInteraction);
    
    // Also try to autoplay immediately (will work on some browsers/situations)
    setTimeout(() => {
      if (this.musicList.length > 0 && !this.isPlaying) {
        console.log('Attempting immediate autoplay...');
        this.playRandomTrack();
      }
    }, 1000);
  }
  
  async canAutoplay() {
    try {
      // Create a temporary audio element
      const audio = document.createElement('audio');
      audio.volume = 0;
      
      // Try to play it
      await audio.play();
      
      // If we get here, autoplay is allowed
      audio.pause();
      return true;
    } catch (error) {
      // Autoplay not allowed
      return false;
    }
  }
}

// Create and export a singleton instance
const audioPlayer = new AudioPlayer();
export default audioPlayer;
