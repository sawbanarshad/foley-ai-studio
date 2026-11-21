import React from 'react';
import { FoleyEvent, AnalyzeResponse, TweakResponse } from '../../api/types';
import { EventRow } from './EventRow';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StudioPhase } from '../../hooks/useStudio';

export interface EventsCardProps {
    events: FoleyEvent[];
    analysis: AnalyzeResponse | null;
    phase: StudioPhase;
    selectedEventId: string | null;
    onSelectEvent: (id: string | null) => void;
    onUpdateEvent: (id: string, field: keyof FoleyEvent, value: any) => void;
    onRegenerateSingle: (id: string) => void;
    onGenerateFoley: (forceRegen?: boolean) => void;
    tweakResult: TweakResponse | null;
}

export const EventsCard: React.FC<EventsCardProps> = ({
    events,
    analysis,
    phase,
    selectedEventId,
    onSelectEvent,
    onUpdateEvent,
    onRegenerateSingle,
    onGenerateFoley,
    tweakResult
}) => {
    const isGenerating = phase === 'generating';
    const hasGenerated = phase === 'ready';

    return (
        <div className="glass-panel rounded-card p-5 flex flex-col justify-between space-y-4 text-white min-h-[500px] hover:border-purple-500/30 transition-all duration-300">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-rechabite-border pb-3">
                <div>
                    <h3 className="font-display text-xl uppercase tracking-wider">
                        03 // DETECTED EVENTS
                    </h3>
                    <span className="text-[10px] font-action text-white/50 uppercase">
                        COLLIDER &bull; SURFACE &bull; SPATIAL PAN
                    </span>
                </div>
                {analysis && (
                    <Badge variant="outline">
                        SRC: {analysis.analysis_source.toUpperCase()}
                    </Badge>
                )}
            </div>

            {/* Events Stream / Empty State */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px]">
                {events.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
                        <span className="font-display text-3xl uppercase tracking-wide text-white/30">
                            NO EVENTS YET
                        </span>
                        <p className="text-sm font-body text-white/50 max-w-xs">
                            Analyze a silent video clip above to see what the AI vision tracker detects.
                        </p>
                    </div>
                ) : (
                    events.map((ev) => (
                        <EventRow
                            key={ev.id}
                            event={ev}
                            isSelected={selectedEventId === ev.id}
                            onSelect={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                            onUpdateField={(field, val) => onUpdateEvent(ev.id, field, val)}
                            onRegenerateSingle={() => onRegenerateSingle(ev.id)}
                            needsRegen={tweakResult?.needs_regeneration?.includes(ev.id)}
                        />
                    ))
                )}
            </div>

            {/* Footer Generation CTA */}
            <div className="pt-2 border-t border-rechabite-border">
                {hasGenerated ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isGenerating}
                        onClick={() => onGenerateFoley(true)}
                        className="w-full"
                    >
                        {isGenerating ? 'REGENERATING SOUNDS…' : 'REGENERATE ALL TRACKS'}
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        size="md"
                        disabled={events.length === 0 || isGenerating}
                        onClick={() => onGenerateFoley(false)}
                        className="w-full"
                    >
                        {isGenerating ? 'GENERATING FOLEY AUDIO…' : 'GENERATE FOLEY AUDIO'}
                    </Button>
                )}
            </div>

        </div>
    );
};