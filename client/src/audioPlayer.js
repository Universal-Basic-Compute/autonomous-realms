
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
      this.playRandomTrack();
    });

    // Fetch the list of available music tracks
    this.fetchMusicList();
  }

  async fetchMusicList() {
    try {
      const response = await fetch('http://localhost:3000/api/data/audio/music/list');
      if (!response.ok) {
        console.error('Failed to fetch music list:', response.statusText);
        return;
      }
      
      const data = await response.json();
      this.musicList = data.tracks || [];
      
      if (this.musicList.length > 0) {
        console.log(`Loaded ${this.musicList.length} music tracks`);
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
    this.audioElement.src = `http://localhost:3000/assets/audio/music/${track}`;
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
}

// Create a singleton instance
const audioPlayer = new AudioPlayer();
export default audioPlayer;
