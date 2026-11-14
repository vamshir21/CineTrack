import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';
import { scannerApi } from '../api/scanner';
import { tmdbApi } from '../api/tmdb';
import {
  Folder,
  Plus,
  Trash2,
  RefreshCw,
  Key,
  Volume2,
  Film,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Wifi,
  Save,
  RotateCcw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Settings query
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  // Playback & Episode Automation local state
  const [autoNextEpisode, setAutoNextEpisode] = useState('true');
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState('15');
  const [completionThresholdMinutes, setCompletionThresholdMinutes] = useState('5');
  const [resumePlayback, setResumePlayback] = useState('true');
  const [defaultVolume, setDefaultVolume] = useState('100');
  const [progressSaveInterval, setProgressSaveInterval] = useState('5');
  const [playbackSaved, setPlaybackSaved] = useState(false);
  const [isSavingPlayback, setIsSavingPlayback] = useState(false);

  // Appearance local state
  const [hoverPreviewEnabled, setHoverPreviewEnabled] = useState('true');
  const [hoverDelayMs, setHoverDelayMs] = useState('500');
  const [cardSize, setCardSize] = useState('medium');
  const [appearanceSaved, setAppearanceSaved] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  // Sync state with fetched settings
  useEffect(() => {
    if (settings) {
      if (settings.auto_next_episode !== undefined) setAutoNextEpisode(settings.auto_next_episode);
      if (settings.next_episode_countdown !== undefined) setNextEpisodeCountdown(settings.next_episode_countdown);
      if (settings.completion_threshold_minutes !== undefined) setCompletionThresholdMinutes(settings.completion_threshold_minutes);
      if (settings.resume_playback !== undefined) setResumePlayback(settings.resume_playback);
      if (settings.default_volume !== undefined) setDefaultVolume(settings.default_volume);
      if (settings.progress_save_interval !== undefined) setProgressSaveInterval(settings.progress_save_interval);

      if (settings.hover_preview_enabled !== undefined) setHoverPreviewEnabled(settings.hover_preview_enabled);
      if (settings.hover_delay_ms !== undefined) setHoverDelayMs(settings.hover_delay_ms);
      if (settings.card_size !== undefined) setCardSize(settings.card_size);

      if (settings.tmdb_api_key !== undefined) setApiKeyInput(settings.tmdb_api_key);
    }
  }, [settings]);

  // Check dirty state
  const hasPlaybackChanges =
    settings &&
    (autoNextEpisode !== (settings.auto_next_episode ?? 'true') ||
      nextEpisodeCountdown !== (settings.next_episode_countdown ?? '15') ||
      completionThresholdMinutes !== (settings.completion_threshold_minutes ?? '5') ||
      resumePlayback !== (settings.resume_playback ?? 'true') ||
      defaultVolume !== (settings.default_volume ?? '100') ||
      progressSaveInterval !== (settings.progress_save_interval ?? '5'));

  const hasAppearanceChanges =
    settings &&
    (hoverPreviewEnabled !== (settings.hover_preview_enabled ?? 'true') ||
      hoverDelayMs !== (settings.hover_delay_ms ?? '500') ||
      cardSize !== (settings.card_size ?? 'medium'));

  // Test TMDB connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = apiKeyInput.trim()
        ? await tmdbApi.testKey(apiKeyInput.trim())
        : await tmdbApi.testConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.response?.data?.message || err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Folders
  const { data: folders, isLoading: isFoldersLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: scannerApi.getFolders,
  });

  // Scan Status
  const { data: scanStatus, refetch: refetchScanStatus } = useQuery({
    queryKey: ['scanStatus'],
    queryFn: scannerApi.getScanStatus,
    refetchInterval: (query) => (query.state.data?.running ? 1000 : false),
  });

  // Add folder mutation
  const addFolderMutation = useMutation({
    mutationFn: () =>
      scannerApi.addFolder(
        newFolderPath.trim(),
        newFolderName.trim() || newFolderPath.trim().split('/').pop() || 'Media'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setNewFolderPath('');
      setNewFolderName('');
      setFolderError('');
    },
    onError: (err: any) => {
      setFolderError(err.response?.data?.detail || 'Failed to add folder. Ensure directory exists.');
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => scannerApi.deleteFolder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  });

  // Start scan mutation
  const startScanMutation = useMutation({
    mutationFn: () => scannerApi.startScan(),
    onSuccess: () => {
      refetchScanStatus();
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
    },
  });

  // Cancel scan
  const cancelScanMutation = useMutation({
    mutationFn: () => scannerApi.cancelScan(),
    onSuccess: () => refetchScanStatus(),
  });

  // Save TMDB API Key
  const handleSaveApiKey = async () => {
    try {
      await settingsApi.updateSetting('tmdb_api_key', apiKeyInput.trim());
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch {}
  };

  // Save Playback & Automation Settings
  const handleSavePlaybackSettings = async () => {
    setIsSavingPlayback(true);
    try {
      await settingsApi.updateSettingsBatch({
        auto_next_episode: autoNextEpisode,
        next_episode_countdown: nextEpisodeCountdown,
        completion_threshold_minutes: completionThresholdMinutes,
        resume_playback: resumePlayback,
        default_volume: defaultVolume,
        progress_save_interval: progressSaveInterval,
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setPlaybackSaved(true);
      setTimeout(() => setPlaybackSaved(false), 4000);
    } catch (e) {
      console.error('Failed to save playback settings:', e);
    } finally {
      setIsSavingPlayback(false);
    }
  };

  const handleResetPlaybackSettings = () => {
    if (settings) {
      setAutoNextEpisode(settings.auto_next_episode ?? 'true');
      setNextEpisodeCountdown(settings.next_episode_countdown ?? '15');
      setCompletionThresholdMinutes(settings.completion_threshold_minutes ?? '5');
      setResumePlayback(settings.resume_playback ?? 'true');
      setDefaultVolume(settings.default_volume ?? '100');
      setProgressSaveInterval(settings.progress_save_interval ?? '5');
    }
  };

  // Save Appearance Settings
  const handleSaveAppearanceSettings = async () => {
    setIsSavingAppearance(true);
    try {
      await settingsApi.updateSettingsBatch({
        hover_preview_enabled: hoverPreviewEnabled,
        hover_delay_ms: hoverDelayMs,
        card_size: cardSize,
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setAppearanceSaved(true);
      setTimeout(() => setAppearanceSaved(false), 4000);
    } catch (e) {
      console.error('Failed to save appearance settings:', e);
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const handleResetAppearanceSettings = () => {
    if (settings) {
      setHoverPreviewEnabled(settings.hover_preview_enabled ?? 'true');
      setHoverDelayMs(settings.hover_delay_ms ?? '500');
      setCardSize(settings.card_size ?? 'medium');
    }
  };

  // Save all settings at once
  const handleSaveAll = async () => {
    await Promise.all([
      handleSavePlaybackSettings(),
      handleSaveAppearanceSettings(),
    ]);
  };

  return (
    <div className="min-h-screen bg-[#141414] pt-24 px-6 md:px-16 pb-32 text-white">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-wide">Settings</h1>
            <p className="text-xs text-neutral-400 mt-1">Configure your local CineTrack streaming experience</p>
          </div>

          {(hasPlaybackChanges || hasAppearanceChanges) && (
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-netflix/30 self-start sm:self-auto animate-pulse"
            >
              <Save className="w-4 h-4" />
              <span>Save All Changes</span>
            </button>
          )}
        </div>

        {/* 1. Media Library Folders & Scanning */}
        <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-netflix" />
              <h2 className="text-lg font-bold">Media Folders</h2>
            </div>
            {/* Scan button */}
            <div className="flex items-center gap-3">
              {scanStatus?.running ? (
                <button
                  onClick={() => cancelScanMutation.mutate()}
                  className="flex items-center gap-2 bg-red-800/80 hover:bg-red-700 px-4 py-2 rounded text-xs font-bold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cancel Scan</span>
                </button>
              ) : (
                <button
                  onClick={() => startScanMutation.mutate()}
                  disabled={!folders || folders.length === 0}
                  className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover disabled:bg-neutral-800 disabled:text-neutral-500 px-4 py-2 rounded text-xs font-bold transition-colors shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Media Library</span>
                </button>
              )}
            </div>
          </div>

          {/* Scan Status banner */}
          {scanStatus?.running && (
            <div className="bg-neutral-800/70 border border-neutral-700 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-netflix">Scanning files...</span>
                <span className="text-neutral-400">
                  {scanStatus.progress} / {scanStatus.total || '?'}
                </span>
              </div>
              <p className="text-xs text-neutral-300 font-mono truncate">{scanStatus.current_file}</p>
            </div>
          )}

          {/* Add Folder Form */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-400 font-semibold">Register New Folder Path</label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                placeholder="/home/user/Videos/Movies or TV"
                className="flex-1 w-full bg-[#242424] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix"
              />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Label (e.g. Movies)"
                className="w-full sm:w-48 bg-[#242424] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix"
              />
              <button
                onClick={() => addFolderMutation.mutate()}
                disabled={!newFolderPath.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500 px-4 py-2 rounded text-xs font-bold transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Folder</span>
              </button>
            </div>
            {folderError && <p className="text-xs text-red-400">{folderError}</p>}
          </div>

          {/* Folder List */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-400 font-semibold">Registered Folders</label>
            {isFoldersLoading ? (
              <p className="text-xs text-neutral-500">Loading folders...</p>
            ) : folders && folders.length > 0 ? (
              <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
                {folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-[#222]">
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-bold text-white">{f.name}</p>
                      <p className="text-xs font-mono text-neutral-400 truncate">{f.path}</p>
                    </div>
                    <button
                      onClick={() => deleteFolderMutation.mutate(f.id)}
                      className="text-neutral-500 hover:text-red-400 p-1.5 transition-colors"
                      title="Remove folder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 bg-[#222] p-4 rounded-lg">
                No folders registered yet. Add a local folder path above to scan movies and TV shows.
              </p>
            )}
          </div>
        </div>

        {/* 2. TMDB API Configuration */}
        <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-netflix" />
            <div>
              <h2 className="text-lg font-bold">The Movie Database (TMDB) Integration</h2>
              <p className="text-xs text-neutral-400">Used for metadata matching, posters, backdrops, and episode stills</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-neutral-400 font-semibold">TMDB API Key (v3 auth or v4 token)</label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter your 32-character TMDB API key"
                className="flex-1 w-full bg-[#242424] border border-neutral-700 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-netflix"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveApiKey}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-netflix hover:bg-netflix-hover px-4 py-2 rounded text-xs font-bold transition-colors shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Key</span>
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-4 py-2 rounded text-xs font-bold transition-colors shrink-0"
                >
                  <Wifi className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-yellow-400' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                  testResult.status === 'ok'
                    ? 'bg-green-950/60 border border-green-700/60 text-green-300'
                    : 'bg-red-950/60 border border-red-700/60 text-red-300'
                }`}
              >
                {testResult.status === 'ok' ? (
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {apiKeySaved && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> TMDB API Key saved successfully!
              </p>
            )}
            <p className="text-[11px] text-neutral-500">
              Get a free API key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-neutral-400 underline">themoviedb.org</a>. Connected via high-reliability endpoint.
            </p>
          </div>
        </div>

        {/* 3. Playback Preferences & Episode Automation */}
        <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-netflix" />
              <div>
                <h2 className="text-lg font-bold">Playback & Episode Automation</h2>
                <p className="text-xs text-neutral-400">Configure auto-play, countdown timer, buffers, and volume</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasPlaybackChanges && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </span>
              )}

              <button
                onClick={handleSavePlaybackSettings}
                disabled={isSavingPlayback}
                className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow shadow-netflix/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPlayback ? 'Saving...' : 'Save Playback Settings'}</span>
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {playbackSaved && (
            <div className="p-3 bg-green-950/60 border border-green-700/60 text-green-300 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>Playback & Episode Automation settings saved successfully!</span>
              </div>
              <span className="text-[11px] text-green-400/80 font-mono">Changes active immediately</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Auto Next Episode */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-white">Auto-Play Next Episode</label>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${autoNextEpisode === 'true' ? 'bg-green-900/50 text-green-300 border border-green-700/50' : 'bg-neutral-800 text-neutral-400'}`}>
                  {autoNextEpisode === 'true' ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Shows Netflix countdown near end-credits and auto-starts next episode</p>
              <select
                value={autoNextEpisode}
                onChange={(e) => setAutoNextEpisode(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="true">Enabled (Prompt countdown & play next episode)</option>
                <option value="false">Disabled (Stop after current episode)</option>
              </select>
            </div>

            {/* Next Episode Countdown */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">Countdown Duration</label>
              <p className="text-[11px] text-neutral-400">Time allowed to click "Watch Credits" before next episode begins</p>
              <select
                value={nextEpisodeCountdown}
                onChange={(e) => setNextEpisodeCountdown(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="5">5 seconds (Quick)</option>
                <option value="10">10 seconds</option>
                <option value="15">15 seconds (Standard)</option>
                <option value="30">30 seconds (Relaxed)</option>
                <option value="60">60 seconds (Full minute)</option>
              </select>
            </div>

            {/* End credit completion threshold */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">End-Credit Buffer & Completion Threshold</label>
              <p className="text-[11px] text-neutral-400">When remaining video length triggers end-credits overlay and completion</p>
              <select
                value={completionThresholdMinutes}
                onChange={(e) => setCompletionThresholdMinutes(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="1">1 minute before file end</option>
                <option value="2">2 minutes before file end (Recommended)</option>
                <option value="3">3 minutes before file end</option>
                <option value="5">5 minutes before file end</option>
                <option value="10">10 minutes before file end</option>
              </select>
            </div>

            {/* Resume Playback */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-white">Resume Playback Position</label>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${resumePlayback === 'true' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'bg-neutral-800 text-neutral-400'}`}>
                  {resumePlayback === 'true' ? 'RESUME' : 'START OVER'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Remember where you left off across movies and episodes</p>
              <select
                value={resumePlayback}
                onChange={(e) => setResumePlayback(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="true">Resume from last watched position</option>
                <option value="false">Always start from beginning (0:00)</option>
              </select>
            </div>

            {/* Default Volume */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">Default Volume</label>
              <p className="text-[11px] text-neutral-400">Initial audio level sent to native VLC player upon launch</p>
              <select
                value={defaultVolume}
                onChange={(e) => setDefaultVolume(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="50">50%</option>
                <option value="80">80%</option>
                <option value="100">100% (Standard)</option>
                <option value="120">120% (Boosted)</option>
                <option value="150">150% (Maximum)</option>
              </select>
            </div>

            {/* Progress Save Interval */}
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">Progress Sync Frequency</label>
              <p className="text-[11px] text-neutral-400">How frequently VLC watch position syncs into SQLite</p>
              <select
                value={progressSaveInterval}
                onChange={(e) => setProgressSaveInterval(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="3">Every 3 seconds (High precision)</option>
                <option value="5">Every 5 seconds (Recommended)</option>
                <option value="10">Every 10 seconds</option>
                <option value="30">Every 30 seconds</option>
              </select>
            </div>
          </div>

          {/* Bottom Card Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            {hasPlaybackChanges ? (
              <button
                onClick={handleResetPlaybackSettings}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to saved</span>
              </button>
            ) : (
              <span className="text-xs text-neutral-500">All playback settings up to date</span>
            )}

            <button
              onClick={handleSavePlaybackSettings}
              disabled={isSavingPlayback}
              className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover disabled:opacity-50 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-netflix/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingPlayback ? 'Saving...' : 'Save Playback Settings'}</span>
            </button>
          </div>
        </div>

        {/* 4. Appearance & Hover Preview */}
        <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-3">
              <Film className="w-5 h-5 text-netflix" />
              <div>
                <h2 className="text-lg font-bold">Netflix Hover Card & UI Behavior</h2>
                <p className="text-xs text-neutral-400">Configure thumbnail preview expansion and card sizing</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasAppearanceChanges && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </span>
              )}

              <button
                onClick={handleSaveAppearanceSettings}
                disabled={isSavingAppearance}
                className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow shadow-netflix/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingAppearance ? 'Saving...' : 'Save Appearance Settings'}</span>
              </button>
            </div>
          </div>

          {appearanceSaved && (
            <div className="p-3 bg-green-950/60 border border-green-700/60 text-green-300 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>Appearance settings saved successfully!</span>
              </div>
              <span className="text-[11px] text-green-400/80 font-mono">Changes active immediately</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">Hover Expanded Preview</label>
              <p className="text-[11px] text-neutral-400">Expand cards to show backdrop, summary, and quick action buttons on mouse hover</p>
              <select
                value={hoverPreviewEnabled}
                onChange={(e) => setHoverPreviewEnabled(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="true">Enabled (Netflix standard behavior)</option>
                <option value="false">Disabled (Static cards without expansion)</option>
              </select>
            </div>

            <div className="space-y-1.5 bg-[#222] p-3.5 rounded-lg border border-neutral-800">
              <label className="text-xs font-bold text-white">Hover Activation Delay</label>
              <p className="text-[11px] text-neutral-400">Duration cursor must hover before card expands</p>
              <select
                value={hoverDelayMs}
                onChange={(e) => setHoverDelayMs(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-netflix mt-1"
              >
                <option value="300">300 ms (Fast responsive)</option>
                <option value="500">500 ms (Netflix Standard)</option>
                <option value="800">800 ms (Deliberate)</option>
                <option value="1200">1200 ms (Slow)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            {hasAppearanceChanges ? (
              <button
                onClick={handleResetAppearanceSettings}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to saved</span>
              </button>
            ) : (
              <span className="text-xs text-neutral-500">All appearance settings up to date</span>
            )}

            <button
              onClick={handleSaveAppearanceSettings}
              disabled={isSavingAppearance}
              className="flex items-center gap-2 bg-netflix hover:bg-netflix-hover disabled:opacity-50 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-netflix/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingAppearance ? 'Saving...' : 'Save Appearance Settings'}</span>
            </button>
          </div>
        </div>

        {/* 5. System & Storage */}
        <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-bold">Data & Storage</h2>
          </div>
          <p className="text-xs text-neutral-400">
            Database: <span className="font-mono text-neutral-200">~/.cinetrack/cinetrack.db</span>
          </p>
          <p className="text-xs text-neutral-400">
            Artwork Cache: <span className="font-mono text-neutral-200">~/.cinetrack/artwork/</span>
          </p>
          <p className="text-xs text-neutral-400">
            Application Logs: <span className="font-mono text-neutral-200">~/.cinetrack/cinetrack.log</span>
          </p>
        </div>
      </div>
    </div>
  );
};
