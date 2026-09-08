import React, { useState } from 'react';
import { Share2, Copy, Check, X, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { musicService } from '@/services/music-service';

interface ShareModalProps {
  songId: string;
  songTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  songId,
  songTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const result = await musicService.generateShareLink(songId);
      setShareUrl(result.shareUrl);
      setQrCodeUrl(result.qrCode || '');
    } catch (error) {
      console.error('[ShareModal] Failed to generate share link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onSuccess?.();
    } catch (error) {
      console.error('[ShareModal] Failed to copy link:', error);
    }
  };

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `${songTitle || 'song'}_qr.png`;
      link.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-[#0A0A0B]/90 border border-white/10 rounded-[3rem] p-10 w-full max-w-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden group/modal">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Share2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Broadcast Session</h2>
              <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest mt-1 truncate max-w-[300px]">{songTitle || 'Studio Master'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all duration-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!shareUrl ? (
          <button
            onClick={handleGenerateLink}
            disabled={isLoading}
            className="w-full py-8 rounded-[2rem] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg tracking-widest shadow-[0_20px_50px_-10px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.5)] transition-all duration-700 disabled:opacity-50 active:scale-[0.98] group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.25)_50%,transparent_60%)] -translate-x-full group-hover:animate-[shimmer_2s_infinite_linear]" />
            <span className="relative z-10">{isLoading ? 'PREPARING STREAM...' : 'GENERATE MASTER LINK'}</span>
          </button>
        ) : (
          <div className="space-y-10 relative z-10">
            {/* Share URL */}
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-white/20 uppercase tracking-[0.3em] px-2">Access Endpoint</label>
              <div className="flex gap-4 p-2 bg-white/[0.02] border border-white/5 rounded-[2rem] group/url">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-6 py-4 bg-transparent text-emerald-400 font-mono text-sm font-bold outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    'px-10 rounded-2xl transition-all duration-700 font-black text-xs tracking-widest active:scale-95',
                    copied
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5'
                  )}
                >
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            {/* QR Code */}
            {qrCodeUrl && (
              <div className="space-y-4">
                <label className="block text-[11px] font-black text-white/20 uppercase tracking-[0.3em] px-2">Visual Cipher</label>
                <div className="flex flex-col items-center gap-6 p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-xl">
                  <div className="p-4 bg-white rounded-3xl shadow-2xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                  </div>
                  <button
                    onClick={handleDownloadQR}
                    className="flex items-center gap-3 px-8 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl font-black text-xs hover:bg-emerald-500 hover:text-white transition-all duration-500 shadow-xl"
                  >
                    <QrCode className="w-4 h-4" />
                    DOWNLOAD CIPHER
                  </button>
                </div>
              </div>
            )}

            {/* Share Platforms */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 px-2">
                <label className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em]">Network Propagation</label>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: '💬', label: 'WECHAT', color: 'emerald' },
                  { icon: '📱', label: 'WEIBO', color: 'red' },
                  { icon: '🐦', label: 'X / TWIT', color: 'sky' },
                  { icon: '💼', label: 'LINKED', color: 'gray' },
                ].map((plat) => (
                  <button key={plat.label} className="group/plat p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] flex flex-col items-center gap-3 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 active:scale-95">
                    <div className="text-3xl filter grayscale group-hover/plat:grayscale-0 transition-all duration-500">{plat.icon}</div>
                    <div className="text-[9px] font-black text-white/10 group-hover/plat:text-white/40 tracking-widest uppercase">{plat.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
