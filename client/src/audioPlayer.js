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
  }

  async fetchMusicList() {
    try {
      console.log('Fetching music list from server...');
      const response = await fetch('http://localhost:3000/api/tiles/audio/music/list');
      if (!response.ok) {
        console.error('Failed to fetch music list:', response.statusText);
        return;
      }
      
      const data = await response.json();
      this.musicList = data.tracks || [];
      
      if (this.musicList.length > 0) {
        console.log(`Loaded ${this.musicList.length} music tracks:`, this.musicList);
        this.playRandomTrack();
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
    const audioUrl = `http://localhost:3000/assets/audio/music/${track}`;
    console.log(`Setting audio source to: ${audioUrl}`);
    this.audioElement.src = audioUrl;
    
    this.audioElement.play().catch(error => {
      console.error('Error playing audio:', error);
    });
    
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
    // Refetch the music list and start playing
    this.fetchMusicList();
  }
}

// Create and export a singleton instance
const audioPlayer = new AudioPlayer();
export default audioPlayer;
