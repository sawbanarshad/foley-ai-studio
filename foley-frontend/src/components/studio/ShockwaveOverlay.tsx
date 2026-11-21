import React from 'react';
import { formatFrameTime } from '../../lib/format';

export interface ActiveRing {
    id: string;
    cx: number;
    cy: number;
}

export interface ShockwaveOverlayProps {
    activeRings: ActiveRing[];
    currentTime: number;
    fps: number;
}

export const ShockwaveOverlay: React.FC<ShockwaveOverlayProps> = ({
    activeRings,
    currentTime,
    fps
}) => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10">
            {/* Dynamic Hit Rings */}
            <svg className="w-full h-full">
                {activeRings.map((ring) => (
                    <g key={ring.id} className="motion-reduce:hidden">
                        <circle
                            cx={`${ring.cx * 100}%`}
                            cy={`${ring.cy * 100}%`}
                            r="10"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="3"
                            className="animate-[shockwave1_600ms_cubic-bezier(0,0,0.2,1)_forwards]"
                        />
                        <circle
                            cx={`${ring.cx * 100}%`}
                            cy={`${ring.cy * 100}%`}
                            r="25"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            className="animate-[shockwave2_600ms_cubic-bezier(0,0,0.2,1)_forwards]"
                        />
                    </g>
                ))}
            </svg>

            {/* Frame Readout Chip at Corner */}
            <div className="absolute top-2.5 right-2.5 bg-black/80 border border-white/20 px-2 py-0.5 rounded-[3px] text-[10px] font-action text-white">
                {formatFrameTime(currentTime, fps || 30)}
            </div>

            <style>{`
        @keyframes shockwave1 {
          0% { r: 5px; opacity: 1; }
          100% { r: 55px; opacity: 0; stroke-width: 0.5px; }
        }
        @keyframes shockwave2 {
          0% { r: 12px; opacity: 0.8; }
          100% { r: 90px; opacity: 0; stroke-width: 0.5px; }
        }
      `}</style>
        </div>
    );
};