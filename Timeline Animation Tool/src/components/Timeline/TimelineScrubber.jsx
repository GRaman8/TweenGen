import React from 'react';
import { useCurrentTime, useDuration, useIsPlaying } from '../../store/hooks';

const TimelineScrubber = () => {
  const [currentTime, setCurrentTime] = useCurrentTime();
  const [duration] = useDuration();
  const [isPlaying] = useIsPlaying();

  return (
    <div className="mb-3 px-1" role="group" aria-label="Timeline scrubber">
      <input
        type="range"
        value={currentTime}
        min={0}
        max={duration}
        step={0.01}
        onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        disabled={isPlaying}
        className="w-full"
        aria-label={`Timeline position: ${currentTime.toFixed(2)} seconds`}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${currentTime.toFixed(2)} seconds`}
      />
    </div>
  );
};

export default TimelineScrubber;