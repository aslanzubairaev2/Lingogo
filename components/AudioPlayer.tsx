import React, { useState, useEffect } from 'react';
import SoundIcon from './icons/SoundIcon';
import { useLanguage } from '../src/contexts/languageContext';
import { getSpeechLocale } from '../src/i18n/languageMeta';

interface AudioPlayerProps {
  textToSpeak: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ textToSpeak }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { profile } = useLanguage();

  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const isDisabled = !textToSpeak || textToSpeak.trim().length === 0;

  useEffect(() => {
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    // Use learning language from profile
    utterance.lang = getSpeechLocale(profile.learning);
    utterance.rate = 0.9;

    const handleEnd = () => setIsPlaying(false);
    utterance.addEventListener('end', handleEnd);
    utterance.addEventListener('error', handleEnd);

    utteranceRef.current = utterance;

    return () => {
      // Cleanup: remove listeners when component unmounts or text changes
      utterance.removeEventListener('end', handleEnd);
      utterance.removeEventListener('error', handleEnd);
      window.speechSynthesis.cancel();
    };
  }, [textToSpeak, profile.learning]);

  const handlePlay = () => {
    if (!utteranceRef.current || isDisabled) return;

    // Stop any other speech before starting a new one
    window.speechSynthesis.cancel();

    setIsPlaying(true);
    window.speechSynthesis.speak(utteranceRef.current);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  };

  return (
    <button
      onClick={togglePlay}
      disabled={isDisabled}
      className="p-2 mt-0.5 rounded-full bg-slate-600/50 hover:bg-slate-600 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
      aria-label={isPlaying ? "Stop audio" : "Play audio"}
    >
      {isPlaying ? (
        <StopIcon className="w-5 h-5 text-white" />
      ) : (
        <SoundIcon className="w-5 h-5 text-white" />
      )}
    </button>
  );
};


// A new icon component for the stop button
const StopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);


export default AudioPlayer;