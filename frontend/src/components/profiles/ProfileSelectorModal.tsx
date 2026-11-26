import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, X, Lock, Delete } from 'lucide-react';
import { useProfileStore, AVATAR_PRESETS, getAvatarPreset } from '../../store/profileStore';
import { profilesApi } from '../../api/profiles';
import type { Profile } from '../../types';

export const ProfileSelectorModal: React.FC = () => {
  const {
    profiles,
    activeProfile,
    isProfileSelectorOpen,
    selectProfile,
    setProfileSelectorOpen,
    createProfile,
    deleteProfile,
  } = useProfileStore();

  const [isManaging, setIsManaging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('netflix-blue');
  const [errorMsg, setErrorMsg] = useState('');

  // Admin PIN Protection State
  const [pinTargetProfile, setPinTargetProfile] = useState<Profile | null>(null);
  const [isPinForManage, setIsPinForManage] = useState(false);
  const [pinDigits, setPinDigits] = useState<string>('');
  const [pinError, setPinError] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pinTargetProfile || isPinForManage) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [pinTargetProfile, isPinForManage]);

  if (!isProfileSelectorOpen && activeProfile) return null;

  const handleProfileClick = (p: Profile) => {
    if (isManaging) return;

    if (p.is_admin) {
      // Require 4-digit Admin PIN
      setPinTargetProfile(p);
      setPinDigits('');
      setPinError('');
      setIsPinForManage(false);
      return;
    }

    // Regular viewer profile: select instantly without PIN
    selectProfile(p);
  };

  const handleManageClick = () => {
    if (isManaging) {
      setIsManaging(false);
      return;
    }

    // If currently active profile is already admin, enter manage mode immediately
    if (activeProfile?.is_admin) {
      setIsManaging(true);
      return;
    }

    // Otherwise prompt for Admin PIN before allowing profile management
    setIsPinForManage(true);
    setPinDigits('');
    setPinError('');
    setPinTargetProfile(null);
  };

  const handlePinSubmit = async (pinToVerify: string) => {
    if (pinToVerify.length !== 4) return;
    setPinError('');

    // Verify against hardcoded PIN 2104 and backend
    const isValid = pinToVerify === '2104' || (await profilesApi.verifyAdminPin(pinToVerify));

    if (isValid) {
      if (isPinForManage) {
        setIsPinForManage(false);
        setIsManaging(true);
      } else if (pinTargetProfile) {
        const target = pinTargetProfile;
        setPinTargetProfile(null);
        selectProfile(target);
      }
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinDigits('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 200);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (pinDigits.length >= 4) return;
    const next = pinDigits + val;
    setPinDigits(next);
    if (next.length === 4) {
      handlePinSubmit(next);
    }
  };

  const handleKeypadBackspace = () => {
    setPinDigits((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('Please enter a profile name');
      return;
    }
    setErrorMsg('');
    try {
      const created = await createProfile(newName.trim(), selectedAvatar);
      setIsAdding(false);
      setNewName('');
      selectProfile(created);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create profile');
    }
  };

  const handleDelete = async (e: React.MouseEvent, p: Profile) => {
    e.stopPropagation();
    if (p.is_admin) return;
    if (confirm(`Are you sure you want to delete profile "${p.name}"?`)) {
      try {
        await deleteProfile(p.id);
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to delete profile');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141414]/95 backdrop-blur-xl px-4 py-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="max-w-4xl w-full text-center my-auto"
        >
          {/* Header */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
            {isManaging ? 'Manage Profiles' : "Who's Watching?"}
          </h1>
          <p className="text-neutral-400 text-sm md:text-base mb-10">
            {isManaging
              ? 'Click to delete viewer profiles (Admin privileges required)'
              : 'Choose your profile to enjoy personalized continue watching & watchlists'}
          </p>

          {/* Profiles Row */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-10 mb-12">
            {profiles.map((p) => {
              const preset = getAvatarPreset(p.avatar);
              const isActive = activeProfile?.id === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => handleProfileClick(p)}
                  className={`group relative flex flex-col items-center cursor-pointer transition-transform ${
                    isManaging ? 'hover:scale-100' : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  {/* Avatar Icon Card */}
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-xl flex items-center justify-center text-4xl sm:text-5xl shadow-2xl transition-all duration-200 border-2 ${
                      preset.bg
                    } ${
                      isActive && !isManaging
                        ? 'border-white ring-4 ring-white/30'
                        : 'border-transparent group-hover:border-white'
                    }`}
                  >
                    <span>{preset.icon}</span>

                    {/* Role badge */}
                    {p.is_admin ? (
                      <span
                        title="Administrator (PIN Protected)"
                        className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 flex items-center gap-1 border border-amber-500/40 shadow-sm"
                      >
                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                        Admin
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-neutral-300 border border-neutral-600">
                        Viewer
                      </span>
                    )}

                    {/* Delete button when managing */}
                    {isManaging && !p.is_admin && (
                      <button
                        onClick={(e) => handleDelete(e, p)}
                        className="absolute inset-0 bg-black/75 rounded-xl flex flex-col items-center justify-center text-red-500 hover:text-red-400 transition-colors p-2"
                        title={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-8 h-8 mb-1" />
                        <span className="text-xs font-bold text-white">Delete</span>
                      </button>
                    )}
                  </div>

                  {/* Profile Name & Lock indicator */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="text-neutral-300 group-hover:text-white font-medium text-sm sm:text-base md:text-lg transition-colors">
                      {p.name}
                    </span>
                    {p.is_admin && (
                      <span title="PIN Protected">
                        <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Profile Card */}
            {profiles.length < 5 && (
              <div
                onClick={() => setIsAdding(true)}
                className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-xl flex items-center justify-center bg-neutral-800/80 hover:bg-neutral-800 border-2 border-dashed border-neutral-600 group-hover:border-white text-neutral-400 group-hover:text-white transition-all shadow-xl">
                  <Plus className="w-10 h-10" />
                </div>
                <span className="mt-3 text-neutral-400 group-hover:text-white font-medium text-sm sm:text-base md:text-lg transition-colors">
                  Add Profile
                </span>
              </div>
            )}
          </div>

          {/* Action buttons at bottom */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleManageClick}
              className={`px-6 py-2.5 rounded font-bold text-sm tracking-wide transition-all border ${
                isManaging
                  ? 'bg-white text-black border-white hover:bg-neutral-200'
                  : 'bg-transparent text-neutral-400 border-neutral-600 hover:text-white hover:border-white'
              }`}
            >
              {isManaging ? 'Done' : 'Manage Profiles'}
            </button>

            {activeProfile && (
              <button
                onClick={() => setProfileSelectorOpen(false)}
                className="px-6 py-2.5 rounded font-bold text-sm tracking-wide bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>

        {/* Modal: Admin 4-Digit PIN Dialog */}
        <AnimatePresence>
          {(pinTargetProfile || isPinForManage) && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="bg-[#181818] border border-neutral-700 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative"
              >
                <button
                  onClick={() => {
                    setPinTargetProfile(null);
                    setIsPinForManage(false);
                    setPinDigits('');
                  }}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7" />
                </div>

                <h3 className="text-xl font-black text-white mb-1">
                  {isPinForManage ? 'Administrator Access' : 'Admin Profile Locked'}
                </h3>
                <p className="text-xs text-neutral-400 mb-6">
                  {isPinForManage
                    ? 'Enter the 4-digit admin PIN to configure profiles'
                    : 'Enter the 4-digit PIN to access Admin privileges and library management'}
                </p>

                {/* Hidden input to capture physical keyboard input */}
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinDigits}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinDigits(clean);
                    setPinError('');
                    if (clean.length === 4) {
                      handlePinSubmit(clean);
                    }
                  }}
                  className="opacity-0 absolute inset-0 pointer-events-none"
                  autoFocus
                />

                {/* 4 Digit Boxes */}
                <div
                  className="flex items-center justify-center gap-3 mb-6 cursor-pointer"
                  onClick={() => pinInputRef.current?.focus()}
                >
                  {[0, 1, 2, 3].map((idx) => {
                    const char = pinDigits[idx];
                    const isFilled = char !== undefined;
                    const isCurrent = pinDigits.length === idx;
                    return (
                      <div
                        key={idx}
                        className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                          pinError
                            ? 'border-red-500 bg-red-950/20 text-red-400'
                            : isFilled
                            ? 'border-white bg-[#252525] text-white ring-2 ring-white/20'
                            : isCurrent
                            ? 'border-amber-400 bg-[#222] ring-2 ring-amber-400/30'
                            : 'border-neutral-700 bg-[#222] text-neutral-500'
                        }`}
                      >
                        {isFilled ? '•' : ''}
                      </div>
                    );
                  })}
                </div>

                {pinError && (
                  <p className="text-xs font-semibold text-red-400 mb-4 animate-shake">
                    {pinError}
                  </p>
                )}

                {/* Touch Keypad (0-9, backspace) for Mobile & TV */}
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto mb-5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-11 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-bold text-base transition-colors shadow-sm"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPinDigits('');
                      setPinError('');
                    }}
                    className="h-11 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-400 text-xs font-bold transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-11 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-bold text-base transition-colors shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-11 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 flex items-center justify-center transition-colors"
                    title="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPinTargetProfile(null);
                      setIsPinForManage(false);
                      setPinDigits('');
                    }}
                    className="text-xs font-bold text-neutral-400 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal to Add New Profile */}
        <AnimatePresence>
          {isAdding && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#181818] border border-neutral-700 rounded-2xl max-w-md w-full p-6 text-left shadow-2xl relative"
              >
                <button
                  onClick={() => setIsAdding(false)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-1">Add Profile</h2>
                <p className="text-xs text-neutral-400 mb-6">
                  Add a viewer profile for anyone in your house on the local network.
                </p>

                {errorMsg && (
                  <div className="mb-4 p-2.5 rounded bg-red-950/60 border border-red-500/50 text-red-300 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Profile Name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Sister, Mom, Guest"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-[#242424] text-white border border-neutral-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Choose Avatar Color
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATAR_PRESETS.map((preset) => {
                        const isChosen = selectedAvatar === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedAvatar(preset.id)}
                            className={`w-12 h-12 rounded-lg ${preset.bg} flex items-center justify-center text-xl transition-all relative ${
                              isChosen ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                            }`}
                          >
                            <span>{preset.icon}</span>
                            {isChosen && (
                              <div className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-lg transition-all"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
