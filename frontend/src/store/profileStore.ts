import { create } from 'zustand';
import type { Profile } from '../types';
import { profilesApi } from '../api/profiles';

export interface AvatarPreset {
  id: string;
  name: string;
  bg: string;
  text: string;
  border: string;
  icon: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'netflix-red', name: 'Crimson', bg: 'bg-red-600', text: 'text-white', border: 'border-red-400', icon: '🍿' },
  { id: 'netflix-blue', name: 'Ocean Blue', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-400', icon: '🎬' },
  { id: 'netflix-green', name: 'Emerald', bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-400', icon: '🎮' },
  { id: 'netflix-yellow', name: 'Amber Gold', bg: 'bg-amber-500', text: 'text-black', border: 'border-amber-300', icon: '⭐' },
  { id: 'netflix-purple', name: 'Violet', bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-400', icon: '🎭' },
  { id: 'netflix-cyan', name: 'Cyan', bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-400', icon: '🚀' },
];

export const getAvatarPreset = (avatarId: string): AvatarPreset => {
  return AVATAR_PRESETS.find((p) => p.id === avatarId) || AVATAR_PRESETS[0];
};

interface ProfileStore {
  profiles: Profile[];
  activeProfile: Profile | null;
  isProfileSelectorOpen: boolean;
  isLoading: boolean;
  fetchProfiles: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
  setProfileSelectorOpen: (open: boolean) => void;
  createProfile: (name: string, avatar: string) => Promise<Profile>;
  deleteProfile: (id: number) => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  activeProfile: null,
  isProfileSelectorOpen: false,
  isLoading: true,

  fetchProfiles: async () => {
    try {
      set({ isLoading: true });
      const profiles = await profilesApi.list();
      set({ profiles });

      const savedId = localStorage.getItem('cinetrack_profile_id');
      if (savedId) {
        const found = profiles.find((p) => String(p.id) === savedId);
        if (found) {
          set({ activeProfile: found, isProfileSelectorOpen: false });
          return;
        }
      }

      // If no valid active profile, auto-open "Who's Watching?" selector
      if (profiles.length > 0) {
        set({ isProfileSelectorOpen: true });
      }
    } catch (e) {
      console.error('Failed to fetch profiles:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  selectProfile: (profile: Profile) => {
    localStorage.setItem('cinetrack_profile_id', String(profile.id));
    set({ activeProfile: profile, isProfileSelectorOpen: false });
    // Invalidate react query cache so UI refreshes with new profile data
    window.location.reload();
  },

  setProfileSelectorOpen: (open: boolean) => {
    set({ isProfileSelectorOpen: open });
  },

  createProfile: async (name: string, avatar: string) => {
    const newProfile = await profilesApi.create({ name, avatar });
    const profiles = await profilesApi.list();
    set({ profiles });
    return newProfile;
  },

  deleteProfile: async (id: number) => {
    await profilesApi.delete(id);
    const profiles = await profilesApi.list();
    const current = get().activeProfile;
    set({ profiles });
    if (current && current.id === id) {
      if (profiles.length > 0) {
        get().selectProfile(profiles[0]);
      } else {
        set({ activeProfile: null, isProfileSelectorOpen: true });
      }
    }
  },
}));
