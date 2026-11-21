import React from 'react';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  ariaValueText?: string;
  onChange: (val: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  displayValue,
  ariaValueText,
  onChange,
  className = ''
}) => {
  const formattedVal = displayValue || `${value}${unit}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between items-baseline">
        <label className="text-[12px] font-action font-semibold uppercase tracking-wider text-white/80">
          {label}
        </label>
        <span className="font-display text-[1.2rem] text-white tracking-wide">
          {formattedVal}
        </span>
      </div>
      <div className="relative flex items-center h-8">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuetext={ariaValueText || formattedVal}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-[#0F0F0F] border border-rechabite-border rounded-none cursor-pointer appearance-none focus:outline-none focus:border-[var(--room-accent,#9947B7)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:rounded-[4px] [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-black [&::-moz-range-thumb]:rounded-[4px]"
        />
      </div>
    </div>
  );
};