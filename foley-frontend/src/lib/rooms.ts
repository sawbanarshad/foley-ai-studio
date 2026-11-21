import { RoomName, WallMaterial } from '../types';

export interface RoomPreset {
  name: RoomName;
  label: string;
  L: number;
  wall: WallMaterial;
  theme: string;
}

export const ROOM_PRESETS: Record<RoomName, RoomPreset> = {
  small_room: {
    name: 'small_room',
    label: 'Small Room',
    L: 4.0,
    wall: 'wood',
    theme: 'small_room'
  },
  large_hall: {
    name: 'large_hall',
    label: 'Large Hall',
    L: 15.0,
    wall: 'concrete',
    theme: 'large_hall'
  },
  cave: {
    name: 'cave',
    label: 'Subterranean Cave',
    L: 25.0,
    wall: 'stone',
    theme: 'cave'
  },
  open_field: {
    name: 'open_field',
    label: 'Open Field (Anechoic)',
    L: 25.0,
    wall: 'outdoor',
    theme: 'open_field'
  }
};

export const ABSORPTION_ALPHA: Record<WallMaterial, number> = {
  concrete: 0.03,
  stone: 0.02,
  wood: 0.10,
  curtains: 0.30,
  outdoor: 0.95
};

export function computeLocalRT60(L: number, wall: WallMaterial, isField: boolean = false): number {
  if (isField || wall === 'outdoor') return 0.05;
  const alpha = ABSORPTION_ALPHA[wall] || 0.10;
  const rt60 = (0.161 * L) / (6.0 * alpha);
  return Math.min(4.0, Math.max(0.05, Math.round(rt60 * 100) / 100));
}