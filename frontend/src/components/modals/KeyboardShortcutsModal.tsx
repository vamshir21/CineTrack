import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Toggle Play / Pause during active playback' },
    { key: 'F', desc: 'Toggle Fullscreen desktop window' },
    { key: 'M', desc: 'Mute / Unmute active audio' },
    { key: '/ or Ctrl+K', desc: 'Focus Quick Search' },
    { key: 'S', desc: 'Surprise Me (Play Something)' },
    { key: 'Esc', desc: 'Close any active modal or detail view' },
    { key: '?', desc: 'Open this Keyboard Shortcuts cheat sheet' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#1a1a1a] border border-neutral-700/80 rounded-2xl p-6 shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-netflix/20 border border-netflix/40 flex items-center justify-center text-netflix">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Keyboard Shortcuts</h2>
                <p className="text-xs text-neutral-400">Desktop hotkeys for CineTrack</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="divide-y divide-neutral-800/80">
            {shortcuts.map((s) => (
              <div key={s.key} className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium">{s.desc}</span>
                <kbd className="bg-[#242424] text-neutral-200 border border-neutral-700 font-mono px-2.5 py-1 rounded text-xs font-semibold shadow-sm">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-neutral-800 flex justify-end">
            <button
              onClick={onClose}
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
