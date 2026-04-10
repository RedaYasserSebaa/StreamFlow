import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onPlaying?: () => void;
  onWaiting?: () => void;
  subtitles?: { src: string; label: string }[];
}

const VideoPlayer = ({ src, poster, onPlaying, onWaiting, subtitles }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      playerRef.current = new Plyr(videoRef.current, {
        captions: { active: true, update: true, language: 'auto' },
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 
          'captions', 'settings', 'pip', 'airplay', 'fullscreen'
        ]
      });

      const video = videoRef.current;
      video.addEventListener('playing', () => onPlaying?.());
      video.addEventListener('waiting', () => onWaiting?.());

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
    <div className="w-full h-full bg-black relative rounded-xl overflow-hidden group">
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
