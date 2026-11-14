import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, X, HardDrive, CheckSquare, Square } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFile: boolean) => Promise<void> | void;
  title: string;
  mediaType: 'movie' | 'series' | 'episode';
  filePath?: string;
  fileSize?: number;
  seasonNumber?: number;
  episodeNumber?: number;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  mediaType,
  filePath,
  fileSize,
  seasonNumber,
  episodeNumber,
}) => {
  const [deletePermanently, setDeletePermanently] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${bytes} B`;
  };

  const getMediaLabel = () => {
    if (mediaType === 'movie') return 'Movie';
    if (mediaType === 'series') return 'TV Series';
    if (mediaType === 'episode') {
      const epCode = seasonNumber && episodeNumber ? `S${seasonNumber}E${episodeNumber} · ` : '';
      return `${epCode}Episode`;
    }
    return 'Item';
  };

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(deletePermanently);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete {getMediaLabel()}</h3>
                <p className="text-xs text-zinc-400">Remove from CineTrack library</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
              <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                {getMediaLabel()}
              </span>
              <p className="text-base font-bold text-white mt-0.5 truncate">{title}</p>
              {filePath && (
                <div className="mt-2 flex items-center space-x-2 text-xs text-zinc-400">
                  <HardDrive className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
                  <span className="truncate text-zinc-300 font-mono text-[11px]" title={filePath}>
                    {filePath}
                  </span>
                  {fileSize && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-200 text-[10px] font-semibold">
                      {formatBytes(fileSize)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Permanent deletion checkbox / tick */}
            <div
              onClick={() => !isDeleting && setDeletePermanently(!deletePermanently)}
              className={`flex items-start space-x-3 p-3.5 rounded-lg border cursor-pointer transition select-none ${
                deletePermanently
                  ? 'bg-red-950/30 border-red-500/50 text-red-200'
                  : 'bg-zinc-800/40 border-zinc-700 hover:border-zinc-600 text-zinc-300'
              }`}
            >
              <button
                type="button"
                className="mt-0.5 flex-shrink-0 focus:outline-none"
                aria-checked={deletePermanently}
                role="checkbox"
              >
                {deletePermanently ? (
                  <CheckSquare className="w-5 h-5 text-red-500" />
                ) : (
                  <Square className="w-5 h-5 text-zinc-500" />
                )}
              </button>
              <div className="text-xs">
                <span className="font-semibold block text-sm">
                  Permanently delete video file from system memory (disk storage)
                </span>
                <span className="text-zinc-400 block mt-0.5">
                  {deletePermanently
                    ? 'The actual video file will be deleted from your hard drive storage immediately. This cannot be undone.'
                    : 'Unchecked: Only removes metadata from CineTrack library. The video file stays on your disk.'}
                </span>
              </div>
            </div>

            {/* Danger alert when checked */}
            {deletePermanently && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center space-x-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 p-3 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>
                  Permanent disk deletion: The file on your system will be erased completely.
                </span>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 p-4 px-6 bg-zinc-950/70 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-lg shadow-red-950/50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {isDeleting
                  ? 'Deleting...'
                  : deletePermanently
                  ? 'Permanently Delete'
                  : 'Remove from Library'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
