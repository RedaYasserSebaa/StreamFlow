import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onPlaying?: () => void;
  onWaiting?: () => void;
  onEnded?: () => void;
  seekInterval?: number;
  subtitles?: { src: string; label: string }[];
  subtitleStyle?: {
    fontSize: number;
    fontFamily: string;
    color: string;
    background: boolean;
  };
}

const VideoPlayer = ({ src, poster, onPlaying, onWaiting, onEnded, seekInterval, subtitles, subtitleStyle }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      playerRef.current = new Plyr(videoRef.current, {
        captions: { active: true, update: true, language: 'auto' },
        seekTime: seekInterval || 10,
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 
          'captions', 'settings', 'pip', 'airplay', 'fullscreen'
        ]
      });

      const video = videoRef.current;
      
      // Audio track detection and diagnostics
      const handleLoadedMetadata = () => {
        const audioTracks = (video as any).audioTracks;
        if (audioTracks) {
          console.log(`[StreamFlow] Audio tracks detected: ${audioTracks.length}`);
          for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            console.log(`[StreamFlow] Audio track ${i}: label="${track.label}", language="${track.language}", kind="${track.kind}"`);
            if (i === 0) {
              track.enabled = true;
              console.log(`[StreamFlow] Selected audio track 0 (default)`);
            }
          }
        }
      };

      // Error handler for audio decode failures
      const handleError = () => {
        if (video.error) {
          console.error(`[StreamFlow] Video error - Code: ${video.error.code}, Message: ${video.error.message}`);
          if (video.error.code === 4) {
            console.error('[StreamFlow] Audio codec may be unsupported or audio stream is corrupted');
          }
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      video.addEventListener('playing', () => onPlaying?.());
      video.addEventListener('waiting', () => onWaiting?.());
      video.addEventListener('ended', () => onEnded?.());

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        playerRef.current?.destroy();
      };
    }
  }, []);

  // Handle src changes
  useEffect(() => {
    if (videoRef.current && src) {
      console.log(`[StreamFlow] Loading video source: ${src}`);
      videoRef.current.src = src;
      videoRef.current.play().catch((err) => {
        console.log(`[StreamFlow] Autoplay prevented or failed: ${err.message}`);
      });
    }
  }, [src]);

  return (
    <div 
      className="w-full h-full bg-black relative rounded-xl overflow-hidden group"
      style={{
        // @ts-ignore
        '--sub-size': `${subtitleStyle?.fontSize || 24}px`,
        '--sub-font': subtitleStyle?.fontFamily || 'sans-serif',
        '--sub-color': subtitleStyle?.color || '#ffffff',
        '--sub-bg': subtitleStyle?.background ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
      }}
    >
      <video
        ref={videoRef}
        className="plyr-react plyr"
        poster={poster}
        crossOrigin="anonymous"
      >
        {subtitles?.map((sub, idx) => (
          <track
            key={idx}
            kind="captions"
            label={sub.label}
            srcLang="en"
            src={sub.src}
            default={idx === 0}
          />
        ))}
      </video>
    </div>
  );
};

export default VideoPlayer;
