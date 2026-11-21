import { useReducer, useEffect, useRef, useCallback } from 'react';
import {
  AnalyzeResponse,
  GenerateResponse,
  TweakResponse,
  Health,
  FoleyEvent,
  RoomName,
  WallMaterial,
  Collider,
  Surface,
  Distance,
  EventType
} from '../../../types';
import {
  checkHealth,
  analyzeVideo,
  generateAudio,
  tweakPhysics,
  USE_MOCK
} from '../../../client';
import { ROOM_PRESETS } from '../../../lib/rooms';
import { useDebouncedCallback } from './useDebouncedCallback';

export type StudioPhase = 'idle' | 'uploading' | 'analyzed' | 'generating' | 'ready';
export type PlaybackMode = 'silent' | 'naive' | 'synced';

export interface StudioSettings {
  environmentName: RoomName | 'auto';
  L: number;
  wall: WallMaterial;
  intensity: number;
  nudge: number;
}

export interface StudioState {
  phase: StudioPhase;
  file: File | null;
  analysis: AnalyzeResponse | null;
  events: FoleyEvent[];
  settings: StudioSettings;
  generateResult: GenerateResponse | null;
  tweakResult: TweakResponse | null;
  mode: PlaybackMode;
  selectedEventId: string | null;
  error: string | null;
  health: Health | null;
  isMock: boolean;
}

type Action =
  | { type: 'SET_HEALTH'; payload: Health }
  | { type: 'SET_MOCK_MODE'; payload: boolean }
  | { type: 'SET_FILE'; payload: File }
  | { type: 'START_ANALYZE' }
  | { type: 'ANALYZE_SUCCESS'; payload: AnalyzeResponse }
  | { type: 'ANALYZE_ERROR'; payload: string }
  | { type: 'START_GENERATE' }
  | { type: 'GENERATE_SUCCESS'; payload: GenerateResponse }
  | { type: 'GENERATE_ERROR'; payload: string }
  | { type: 'TWEAK_SUCCESS'; payload: TweakResponse }
  | { type: 'TWEAK_ERROR'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Partial<StudioSettings> }
  | { type: 'SET_MODE'; payload: PlaybackMode }
  | { type: 'SELECT_EVENT'; payload: string | null }
  | { type: 'UPDATE_EVENT_FIELD'; payload: { id: string; field: keyof FoleyEvent; value: any } }
  | { type: 'CLEAR_ERROR' };

const initialSettings: StudioSettings = {
  environmentName: 'auto',
  L: 4.0,
  wall: 'wood',
  intensity: 1.0,
  nudge: 0
};

const initialState: StudioState = {
  phase: 'idle',
  file: null,
  analysis: null,
  events: [],
  settings: initialSettings,
  generateResult: null,
  tweakResult: null,
  mode: 'silent',
  selectedEventId: null,
  error: null,
  health: null,
  isMock: USE_MOCK
};

function studioReducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case 'SET_HEALTH':
      return { ...state, health: action.payload };
    case 'SET_MOCK_MODE':
      return { ...state, isMock: action.payload, error: null };
    case 'SET_FILE':
      return { ...state, file: action.payload, error: null };
    case 'START_ANALYZE':
      return { ...state, phase: 'uploading', error: null };
    case 'ANALYZE_SUCCESS': {
      const a = action.payload;
      return {
        ...state,
        phase: 'analyzed',
        analysis: a,
        events: a.events,
        settings: {
          ...state.settings,
          environmentName: 'auto',
          L: a.environment.L,
          wall: a.environment.wall_material,
          nudge: 0,
          intensity: 1.0
        },
        mode: 'silent',
        error: null
      };
    }
    case 'ANALYZE_ERROR':
      return { ...state, phase: 'idle', error: action.payload };
    case 'START_GENERATE':
      return { ...state, phase: 'generating', error: null };
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        phase: 'ready',
        generateResult: action.payload,
        mode: 'synced',
        error: null
      };
    case 'GENERATE_ERROR':
      return { ...state, phase: state.analysis ? 'analyzed' : 'idle', error: action.payload };
    case 'TWEAK_SUCCESS':
      return {
        ...state,
        tweakResult: action.payload,
        error: null
      };
    case 'TWEAK_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SELECT_EVENT':
      return { ...state, selectedEventId: action.payload };
    case 'UPDATE_EVENT_FIELD': {
      const { id, field, value } = action.payload;
      const updated = state.events.map((e) => (e.id === id ? { ...e, [field]: value } : e));
      return { ...state, events: updated };
    }
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    checkHealth(state.isMock)
      .then((h) => dispatch({ type: 'SET_HEALTH', payload: h }))
      .catch((err) => {
        console.warn('Backend offline:', err);
      });
  }, [state.isMock]);

  const setMockMode = useCallback((val: boolean) => {
    dispatch({ type: 'SET_MOCK_MODE', payload: val });
  }, []);

  const selectFile = useCallback((file: File) => {
    dispatch({ type: 'SET_FILE', payload: file });
  }, []);

  const runAnalyze = useCallback(
    async (fileOverride?: File) => {
      const targetFile = fileOverride || state.file;
      if (!targetFile) return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      dispatch({ type: 'START_ANALYZE' });
      try {
        const res = await analyzeVideo(targetFile, state.isMock, abortControllerRef.current.signal);
        dispatch({ type: 'ANALYZE_SUCCESS', payload: res });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          dispatch({ type: 'ANALYZE_ERROR', payload: err.message || 'Video analysis failed' });
        }
      }
    },
    [state.file, state.isMock]
  );

  const runGenerate = useCallback(
    async (forceRegen = false) => {
      if (!state.analysis) return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      dispatch({ type: 'START_GENERATE' });
      try {
        const payloadEvents = state.events.map((e) => ({
          id: e.id,
          collider_material: e.collider_material,
          surface_material: e.surface_material,
          distance: e.distance,
          prompt: e.prompt,
          event_type: e.event_type
        }));

        const res = await generateAudio(
          state.analysis.session_id,
          payloadEvents,
          forceRegen,
          state.isMock,
          abortControllerRef.current.signal
        );
        dispatch({ type: 'GENERATE_SUCCESS', payload: res });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          dispatch({ type: 'GENERATE_ERROR', payload: err.message || 'Audio generation failed' });
        }
      }
    },
    [state.analysis, state.events, state.isMock]
  );

  const runTweak = useCallback(
    async (newSettings: StudioSettings, updatedEvents?: FoleyEvent[]) => {
      if (!state.analysis || state.phase !== 'ready') return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const eventsList = (updatedEvents || state.events).map((e) => ({
          id: e.id,
          collider_material: e.collider_material,
          surface_material: e.surface_material,
          distance: e.distance
        }));

        const envName = newSettings.environmentName === 'auto' ? state.analysis.environment.name : newSettings.environmentName;

        const res = await tweakPhysics(
          {
            session_id: state.analysis.session_id,
            room_length_L: newSettings.L,
            wall_material: newSettings.wall,
            environment_name: envName,
            intensity_multiplier: newSettings.intensity,
            sync_nudge_frames: newSettings.nudge,
            events: eventsList
          },
          state.isMock,
          abortControllerRef.current.signal
        );
        dispatch({ type: 'TWEAK_SUCCESS', payload: res });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          dispatch({ type: 'TWEAK_ERROR', payload: err.message || 'Physics tweak failed' });
        }
      }
    },
    [state.analysis, state.phase, state.events, state.isMock]
  );

  const debouncedRunTweak = useDebouncedCallback(runTweak, 150);

  const changeSettings = useCallback(
    (partial: Partial<StudioSettings>) => {
      const nextSettings = { ...state.settings, ...partial };
      // If environment preset changed:
      if (partial.environmentName && partial.environmentName !== 'auto') {
        const preset = ROOM_PRESETS[partial.environmentName];
        nextSettings.L = preset.L;
        nextSettings.wall = preset.wall;
      } else if (partial.environmentName === 'auto' && state.analysis) {
        nextSettings.L = state.analysis.environment.L;
        nextSettings.wall = state.analysis.environment.wall_material;
      }

      dispatch({ type: 'SET_SETTINGS', payload: nextSettings });
      if (state.phase === 'ready') {
        debouncedRunTweak(nextSettings);
      }
    },
    [state.settings, state.analysis, state.phase, debouncedRunTweak]
  );

  const updateEvent = useCallback(
    (id: string, field: keyof FoleyEvent, value: any) => {
      dispatch({ type: 'UPDATE_EVENT_FIELD', payload: { id, field, value } });
      if (state.phase === 'ready' && (field === 'collider_material' || field === 'surface_material' || field === 'distance')) {
        const nextEvents = state.events.map((e) => (e.id === id ? { ...e, [field]: value } : e));
        debouncedRunTweak(state.settings, nextEvents);
      }
    },
    [state.phase, state.events, state.settings, debouncedRunTweak]
  );

  const regenerateSingleEvent = useCallback(
    async (id: string) => {
      if (!state.analysis) return;
      const target = state.events.find((e) => e.id === id);
      if (!target) return;

      dispatch({ type: 'START_GENERATE' });
      try {
        const res = await generateAudio(
          state.analysis.session_id,
          [
            {
              id: target.id,
              collider_material: target.collider_material,
              surface_material: target.surface_material,
              distance: target.distance,
              prompt: target.prompt,
              event_type: target.event_type
            }
          ],
          false,
          state.isMock
        );
        dispatch({ type: 'GENERATE_SUCCESS', payload: res });
      } catch (err: any) {
        dispatch({ type: 'GENERATE_ERROR', payload: err.message || 'Single event regeneration failed' });
      }
    },
    [state.analysis, state.events, state.isMock]
  );

  return {
    state,
    selectFile,
    runAnalyze,
    runGenerate,
    changeSettings,
    updateEvent,
    regenerateSingleEvent,
    setMode: (m: PlaybackMode) => dispatch({ type: 'SET_MODE', payload: m }),
    selectEventId: (id: string | null) => dispatch({ type: 'SELECT_EVENT', payload: id }),
    setMockMode,
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  };
}