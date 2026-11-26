import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Copy, Check, Tv, Wifi, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { lanApi } from '../../api/lan';

interface LanConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanConnectModal: React.FC<LanConnectModalProps> = ({ isOpen, onClose }) => {
  const [copiedMdns, setCopiedMdns] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const { data: lanInfo, isLoading } = useQuery({
    queryKey: ['lan-info'],
    queryFn: lanApi.getInfo,
    enabled: isOpen,
    staleTime: 1000 * 60 * 10,
  });

  const port = lanInfo?.port || 8088;
  const mdnsUrl = lanInfo?.mdns_url || `http://cinema.local:${port}`;
  const ipUrl = lanInfo?.lan_url || `http://${window.location.hostname}:${port}`;

  useEffect(() => {
    if (isOpen) {
      // Use mDNS or IP url for QR code
      const targetUrl = mdnsUrl || ipUrl;
      QRCode.toDataURL(targetUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [isOpen, mdnsUrl, ipUrl]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, type: 'mdns' | 'ip') => {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (e) {}

    // Fallback for non-HTTPS (LAN HTTP)
    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        success = false;
      }
    }

    if (success) {
      if (type === 'mdns') {
        setCopiedMdns(true);
        setTimeout(() => setCopiedMdns(false), 2500);
      } else {
        setCopiedIp(true);
        setTimeout(() => setCopiedIp(false), 2500);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-[#181818] border border-neutral-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">Stream on Phone & TV</h2>
              <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                Local Network (LAN) Storage & Streaming
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-300 mt-2 mb-6">
            Anyone connected to your home Wi-Fi can stream movies and TV shows directly in their mobile or TV browser with zero lag and instant seeking.
          </p>

          {/* QR Code and URLs */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 mb-6">
            <div className="p-3 bg-white rounded-xl shadow-lg flex-shrink-0">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="CineTrack LAN QR Code" className="w-36 h-36 rounded-md" />
              ) : (
                <div className="w-36 h-36 flex items-center justify-center bg-neutral-100 text-neutral-400 text-xs">
                  {isLoading ? 'Detecting LAN...' : 'Generating QR...'}
                </div>
              )}
            </div>

            <div className="space-y-3 text-left flex-1 min-w-0 w-full">
              {/* Option 1: cinema.local mDNS Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Easy Connect (No IP Needed)
                  </span>
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.2 rounded font-bold">
                    mDNS
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-black/60 border border-emerald-700/50 px-3 py-2 rounded-lg">
                  <span className="font-mono text-xs text-emerald-300 font-bold truncate flex-1">
                    {mdnsUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(mdnsUrl, 'mdns')}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded transition-colors flex-shrink-0 active:scale-95"
                    title="Copy mDNS URL"
                  >
                    {copiedMdns ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 2: Direct IP fallback */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Direct LAN IP Address
                </span>
                <div className="flex items-center gap-2 bg-black/60 border border-neutral-700 px-3 py-2 rounded-lg">
                  <span className="font-mono text-xs text-neutral-300 truncate flex-1">
                    {ipUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(ipUrl, 'ip')}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors flex-shrink-0 active:scale-95"
                    title="Copy IP URL"
                  >
                    {copiedIp ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 space-y-0.5 pt-1">
                <p>• <strong>iPhone / Android</strong>: Open Camera & scan QR code</p>
                <p>• <strong>Smart TV / Laptop</strong>: Type <strong>cinema.local:8088</strong> in browser</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 text-left mb-6">
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
                <Smartphone className="w-4 h-4 text-netflix" />
                Mobile PWA Ready
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Tap "Add to Home Screen" in Safari or Chrome for a full-screen, native app feel.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
                <Tv className="w-4 h-4 text-netflix" />
                Smart TV Friendly
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Works in LG webOS, Samsung Tizen, and FireTV browsers with fullscreen mode.
              </p>
            </div>
          </div>

          {/* Close */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
