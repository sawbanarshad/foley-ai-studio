import React, { useState } from 'react';
import { FoleyEvent, Collider, Surface, Distance } from '../../api/types';
import { Select } from '../ui/Select';
import { Segmented } from '../ui/Segmented';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface EventRowProps {
    event: FoleyEvent;
    isSelected: boolean;
    onSelect: () => void;
    onUpdateField: (field: keyof FoleyEvent, value: any) => void;
    onRegenerateSingle: () => void;
    needsRegen?: boolean;
}

export const EventRow: React.FC<EventRowProps> = ({
    event,
    isSelected,
    onSelect,
    onUpdateField,
    onRegenerateSingle,
    needsRegen = false
}) => {
    const [isPromptEdited, setIsPromptEdited] = useState(false);

    const colliders: Collider[] = ['metal', 'wood', 'glass', 'fabric', 'leather', 'stone'];
    const surfaces: Surface[] = ['concrete', 'gravel', 'wood', 'metal', 'glass', 'fabric'];
    const distances: Distance[] = ['near', 'mid', 'far'];

    return (
        <div
            onClick={onSelect}
            className={`border rounded-card p-3 space-y-3 cursor-pointer transition-colors ${isSelected
                ? 'border-white bg-[#0F0F0F] ring-1 ring-white'
                : 'border-rechabite-border bg-[#0F0F0F] hover:border-white/50'
                }`}
        >
            {/* Top Header: ID + Event Type + Time Range */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                    <Badge variant="accent">{event.id.toUpperCase()}</Badge>
                    <Badge variant="outline">{event.event_type.toUpperCase()}</Badge>
                    {event.event_type === 'impact' && (
                        <span className="text-[10px] font-action text-white/50">
                            {event.hits.length} {event.hits.length === 1 ? 'hit' : 'hits'}
                        </span>
                    )}
                </div>
                <span className="font-mono text-[11px] text-white/70">
                    {event.start_time.toFixed(2)}s - {event.end_time.toFixed(2)}s
                </span>
            </div>

            {/* Editable Prompt Textarea */}
            <div className="space-y-1">
                <label className="text-[10px] font-action uppercase tracking-wider text-white/50 block">
                    Acoustic Foley Prompt
                </label>
                <textarea
                    rows={2}
                    value={event.prompt}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        setIsPromptEdited(true);
                        onUpdateField('prompt', e.target.value);
                    }}
                    className="w-full bg-[#0F0F0F] text-white border border-rechabite-border rounded-[4px] p-2 text-xs font-body focus:outline-none focus:border-[var(--room-accent,#9947B7)] resize-none"
                />
            </div>

            {/* Material Selectors */}
            <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                <Select
                    label="Collider"
                    options={colliders.map((c) => ({ value: c, label: c.toUpperCase() }))}
                    value={event.collider_material}
                    onChange={(e) => onUpdateField('collider_material', e.target.value as Collider)}
                />
                <Select
                    label="Surface"
                    options={surfaces.map((s) => ({ value: s, label: s.toUpperCase() }))}
                    value={event.surface_material}
                    onChange={(e) => onUpdateField('surface_material', e.target.value as Surface)}
                />
            </div>

            {/* Distance Segmented Control */}
            <div onClick={(e) => e.stopPropagation()}>
                <Segmented
                    label="Acoustic Distance"
                    options={distances.map((d) => ({ value: d, label: d.toUpperCase() }))}
                    value={event.distance}
                    onChange={(val) => onUpdateField('distance', val as Distance)}
                />
            </div>

            {/* Strength Bar */}
            <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-action text-white/40 uppercase">
                    <span>Impact Motion Energy</span>
                    <span className="font-mono">{Math.round(event.impact_strength * 100)}%</span>
                </div>
                <div className="w-full h-1 bg-[#1F2430] rounded-none overflow-hidden">
                    <div
                        style={{ width: `${event.impact_strength * 100}%` }}
                        className="h-full bg-[var(--room-accent,#9947B7)]"
                    />
                </div>
            </div>

            {/* Prompt edited or Needs Regen actions */}
            {(isPromptEdited || needsRegen) && (
                <div className="pt-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-action text-yellow-400 uppercase">
                        Prompt edited (Needs audio re-run)
                    </span>
                    <Button variant="secondary" size="sm" onClick={onRegenerateSingle}>
                        REGENERATE SOUND
                    </Button>
                </div>
            )}
        </div>
    );
};