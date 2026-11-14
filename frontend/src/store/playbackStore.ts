import { create } from 'zustand';
import type { PlaybackStatus } from '../types';

interface PlaybackStore {
  status: PlaybackStatus | null;
  isPlayerOpen: boolean;
  setStatus: (status: PlaybackStatus | null) => void;
  setPlayerOpen: (open: boolean) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  status: null,
  isPlayerOpen: false,
  setStatus: (status) => set({ status }),
  setPlayerOpen: (open) => set({ isPlayerOpen: open }),
}));
