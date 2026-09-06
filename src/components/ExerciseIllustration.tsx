import React, { useState, useEffect } from 'react';
import { Dumbbell } from 'lucide-react';
import { FALLBACK_EXERCISES } from '../data/exerciseLibraryData';

const gifCache: Record<string, string> = {};

// Populate initial cache from FALLBACK_EXERCISES
FALLBACK_EXERCISES.forEach((ex) => {
  if (ex.gifUrl && ex.name) {
    gifCache[ex.name.toLowerCase().trim()] = ex.gifUrl;
  }
});

interface ExerciseIllustrationProps {
  name: string;
  gifUrl?: string;
  className?: string;
}

export const ExerciseIllustration: React.FC<ExerciseIllustrationProps> = ({
  name,
  gifUrl,
  className = "w-8 h-8",
}) => {
  const cleanName = (name || '').toLowerCase().trim();
  const initialUrl = gifUrl || gifCache[cleanName] || null;

  const [imgUrl, setImgUrl] = useState<string | null>(initialUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (gifUrl) {
      setImgUrl(gifUrl);
      if (cleanName) gifCache[cleanName] = gifUrl;
      return;
    }

    if (cleanName && gifCache[cleanName]) {
      setImgUrl(gifCache[cleanName]);
      return;
    }
  }, [cleanName, gifUrl]);

  if (imgUrl && !hasError) {
    return (
      <img
        src={imgUrl}
        alt={name}
        className={`${className} object-contain max-w-full max-h-full rounded-md flex-shrink-0 bg-black`}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`${className} flex items-center justify-center bg-slate-800/80 rounded-md flex-shrink-0 border border-slate-700/50`}>
      <Dumbbell className="w-4 h-4 text-slate-400" />
    </div>
  );
};
