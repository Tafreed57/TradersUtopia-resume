'use client';

import { useState } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
  showFallback?: boolean;
}

export function YouTubeEmbed({
  videoId,
  title,
  className = '',
  aspectRatio = 'video',
  showFallback = true,
}: YouTubeEmbedProps) {
  const [hasError, setHasError] = useState(false);

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const aspectClass =
    aspectRatio === 'video' ? 'aspect-video' : 'aspect-square';

  return (
    <div
      className={`relative ${aspectClass} bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden ${className}`}
    >
      {!hasError ? (
        <iframe
          src={embedUrl}
          title={title}
          className='w-full h-full rounded-xl'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
          loading='lazy'
          referrerPolicy='strict-origin-when-cross-origin'
          frameBorder='0'
          onError={() => setHasError(true)}
        />
      ) : null}

      {/* Fallback UI */}
      {(hasError || showFallback) && (
        <div
          className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl'
          style={{ zIndex: hasError ? 10 : -1 }}
        >
          <div className='text-center'>
            <div className='w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-red-400'
                fill='currentColor'
                viewBox='0 0 24 24'
              >
                <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
              </svg>
            </div>
            <h3 className='text-white font-semibold mb-2'>
              {hasError ? 'Video Unavailable' : 'Video Loading'}
            </h3>
            <p className='text-gray-400 text-sm mb-4'>
              {hasError ? 'Unable to load video' : 'Click to watch on YouTube'}
            </p>
            <a
              href={watchUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium inline-block'
            >
              Watch on YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
