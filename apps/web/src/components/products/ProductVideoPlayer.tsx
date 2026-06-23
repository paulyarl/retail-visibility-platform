'use client';

import { useState, useCallback } from 'react';
import { Play, ExternalLink, AlertCircle } from 'lucide-react';

export interface ProductVideoPlayerProps {
  videoUrl: string;
  title?: string;
  compact?: boolean;
}

interface VideoInfo {
  embedUrl: string;
  thumbnailUrl: string | null;
  provider: 'youtube' | 'vimeo';
  videoId: string;
  isPlaylist?: boolean;
}

function parseVideoUrl(url: string): VideoInfo | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId: string | undefined;
      const playlistId = urlObj.searchParams.get('list') || undefined;

      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.pathname.startsWith('/embed/')) {
        videoId = urlObj.pathname.split('/')[2];
      } else if (urlObj.pathname.startsWith('/playlist')) {
        // Pure playlist URL: youtube.com/playlist?list=PLxxxxx
        videoId = undefined;
      } else {
        videoId = urlObj.searchParams.get('v') || undefined;
      }

      // Also check for /shorts/ format
      if (!videoId && urlObj.pathname.includes('/shorts/')) {
        const parts = urlObj.pathname.split('/');
        videoId = parts[parts.indexOf('shorts') + 1];
      }

      // Playlist with a specific video — embed that video within the playlist
      if (videoId && videoId.length >= 11 && playlistId) {
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&list=${playlistId}`,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          provider: 'youtube',
          videoId,
          isPlaylist: true,
        };
      }

      // Pure playlist URL (no specific video) — embed the playlist player
      if (!videoId && playlistId) {
        return {
          embedUrl: `https://www.youtube.com/embed/videoseries?autoplay=1&rel=0&list=${playlistId}`,
          thumbnailUrl: null,
          provider: 'youtube',
          videoId: playlistId,
          isPlaylist: true,
        };
      }

      // Single video (no playlist)
      if (videoId && videoId.length >= 11) {
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          provider: 'youtube',
          videoId,
        };
      }
    }

    if (urlObj.hostname.includes('vimeo.com')) {
      const vimeoId = urlObj.pathname.split('/').pop();
      if (vimeoId && /^\d+$/.test(vimeoId)) {
        return {
          embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
          thumbnailUrl: null,
          provider: 'vimeo',
          videoId: vimeoId,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function ProductVideoPlayer({ videoUrl, title = 'Product Video', compact = false }: ProductVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const videoInfo = parseVideoUrl(videoUrl);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  if (!videoInfo) {
    return (
      <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center ${compact ? 'aspect-video' : 'aspect-video'}`}>
        <div className="text-center px-4">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Video unavailable</p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Open link
          </a>
        </div>
      </div>
    );
  }

  if (isPlaying) {
    if (iframeError) {
      return (
        <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center ${compact ? 'aspect-video' : 'aspect-video'}`}>
          <div className="text-center px-4">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Failed to load video</p>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Watch on {videoInfo.provider === 'youtube' ? 'YouTube' : 'Vimeo'}
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-lg overflow-hidden bg-black ${compact ? 'aspect-video' : 'aspect-video'}`}>
        <iframe
          src={videoInfo.embedUrl}
          title={title}
          className="w-full h-full"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          onError={() => setIframeError(true)}
        />
      </div>
    );
  }

  const showThumbnail = videoInfo.thumbnailUrl && !thumbnailError;

  return (
    <button
      onClick={handlePlay}
      className={`relative rounded-lg overflow-hidden bg-neutral-900 group w-full ${compact ? 'aspect-video' : 'aspect-video'}`}
      aria-label={`Play ${title}`}
    >
      {showThumbnail ? (
        <img
          src={videoInfo.thumbnailUrl!}
          alt={title}
          className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
          onError={() => setThumbnailError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors">
              <Play className="h-7 w-7 text-white ml-1" fill="white" />
            </div>
          </div>
        </div>
      )}

      {showThumbnail && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 group-hover:scale-110 transition-all shadow-lg">
            <Play className="h-7 w-7 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 text-xs text-white/80 bg-black/40 px-2 py-0.5 rounded">
        {videoInfo.provider === 'youtube' ? (videoInfo.isPlaylist ? 'YouTube Playlist' : 'YouTube') : 'Vimeo'}
      </div>
    </button>
  );
}

export default ProductVideoPlayer;
