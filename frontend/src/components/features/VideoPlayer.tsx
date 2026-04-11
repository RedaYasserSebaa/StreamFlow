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
      video.addEventListener('playing', () => onPlaying?.());
      video.addEventListener('waiting', () => onWaiting?.());
      video.addEventListener('ended', () => onEnded?.());

      return () => {
        playerRef.current?.destroy();
      };
    }
  }, []);

  // Handle src changes
  useEffect(() => {
    if (videoRef.current && src) {
      videoRef.current.src = src;
      videoRef.current.play().catch(() => console.log('Autoplay prevented'));
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
