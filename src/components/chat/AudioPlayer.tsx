'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  isOwn: boolean;
}

export default function AudioPlayer({ src, isOwn }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
    };

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlayThrough = () => {
      setIsLoaded(true);
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleError = () => {
      setError(true);
      setIsLoaded(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);

    // Forcer le chargement
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time) || time === 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
        <span>❌ Audio non disponible</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 min-w-[180px] max-w-[250px] ${isOwn ? 'text-white' : 'text-gray-700'}`}>
      <audio ref={audioRef} src={src} preload="auto" />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={!isLoaded}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition ${
          isOwn 
            ? 'bg-white/20 hover:bg-white/30' 
            : 'bg-orange-100 hover:bg-orange-200'
        } ${!isLoaded ? 'opacity-50' : ''}`}
      >
        {!isLoaded ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress and Time */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform-like progress bar */}
        <div className="relative h-6 flex items-center">
          <div className={`absolute inset-0 flex items-center gap-[2px] ${isOwn ? 'opacity-40' : 'opacity-30'}`}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full ${isOwn ? 'bg-white' : 'bg-orange-500'}`}
                style={{
                  height: `${Math.sin(i * 0.5) * 50 + 50}%`,
                  minHeight: '4px'
                }}
              />
            ))}
          </div>
          <div 
            className="absolute inset-0 flex items-center gap-[2px] overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full flex-shrink-0 ${isOwn ? 'bg-white' : 'bg-orange-500'}`}
                style={{
                  height: `${Math.sin(i * 0.5) * 50 + 50}%`,
                  minHeight: '4px'
                }}
              />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        
        {/* Time */}
        <div className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
        </div>
      </div>
    </div>
  );
}
