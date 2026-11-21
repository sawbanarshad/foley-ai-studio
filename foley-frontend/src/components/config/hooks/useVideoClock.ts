import { useEffect, useRef, useState } from 'react';

export interface UseVideoClockProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onTimeUpdate?: (time: number) => void;
  onHitTrigger?: (hitTime: number, cx: number, cy: number, eventId: string) => void;
  hits?: Array<{ t_impact: number; cx: number; cy: number; event_id: string }>;
}

export function useVideoClock({ videoRef, onTimeUpdate, onHitTrigger, hits = [] }: UseVideoClockProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const prevTimeRef = useRef(0);
  const rAFRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let active = true;

    const tick = () => {
      if (!active) return;
      const cur = video.currentTime;

      if (cur !== prevTimeRef.current) {
        setCurrentTime(cur);
        onTimeUpdate?.(cur);

        // Check if playback crossed any hit timestamps
        const prev = prevTimeRef.current;
        if (cur > prev && cur - prev < 0.5) {
          hits.forEach((h) => {
            if (prev < h.t_impact && h.t_impact <= cur) {
              onHitTrigger?.(h.t_impact, h.cx, h.cy, h.event_id);
            }
          });
        }
        prevTimeRef.current = cur;
      }

      if ('requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(tick);
      } else {
        rAFRef.current = requestAnimationFrame(tick);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      (video as any).requestVideoFrameCallback(tick);
    } else {
      rAFRef.current = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    };
  }, [videoRef, hits, onTimeUpdate, onHitTrigger]);

  return { currentTime };
}