import React from 'react';

export const Marquee: React.FC = () => {
    const text = 'METAL • WOOD • GLASS • FABRIC • GRAVEL • STONE • LEATHER • ';

    return (
        <div className="w-full bg-gradient-to-r from-[#FF5598] via-[#9947B7] via-[#007AD8] to-[#FF5598] text-white py-3.5 overflow-hidden select-none border-y border-white/20 shadow-lg shadow-purple-950/40">
            <div className="flex w-max motion-safe:animate-[marquee_25s_linear_infinite] motion-reduce:justify-center motion-reduce:w-full motion-reduce:text-center">
                <span className="font-display text-2xl sm:text-3xl tracking-wider uppercase whitespace-nowrap px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {text.repeat(6)}
                </span>
            </div>
            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
        </div>
    );
};