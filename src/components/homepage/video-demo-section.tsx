'use client';

export function VideoDemoSection() {
  return (
    <div className='bg-gradient-to-br from-gray-800/60 via-slate-800/40 to-gray-900/60 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 mb-16 sm:mb-20 border border-gray-600/30 backdrop-blur-md shadow-2xl mx-4 sm:mx-0'>
      <div className='text-center mb-8 sm:mb-10'>
        <h2 className='text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
          See TradersUtopia in Action
        </h2>
        <p className='text-gray-300 text-lg sm:text-xl'>
          Watch how our members receive and execute profitable trades
        </p>
      </div>
      <div className='relative max-w-5xl mx-auto'>
        <div className='aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl border border-gray-600/50 shadow-2xl relative overflow-hidden group hover:border-yellow-400/50 transition-all duration-500'>
          {/* YouTube Video Embed */}
          <iframe
            className='w-full h-full rounded-xl sm:rounded-2xl'
            src='https://www.youtube-nocookie.com/embed/XMW0WVYBbLY?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
            title='TradersUtopia Demo - See Our Platform in Action'
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            loading='lazy'
            referrerPolicy='strict-origin-when-cross-origin'
          ></iframe>

          {/* Fallback for when video doesn't load */}
          <div
            className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl'
            style={{ zIndex: -1 }}
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
              <h3 className='text-white font-semibold mb-2'>Video Loading</h3>
              <p className='text-gray-400 text-sm'>Click to watch on YouTube</p>
              <a
                href='https://www.youtube.com/watch?v=XMW0WVYBbLY'
                target='_blank'
                rel='noopener noreferrer'
                className='mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-block'
              >
                Watch on YouTube
              </a>
            </div>
          </div>
        </div>
        {/* Video Description */}
        <div className='text-center mt-4'>
          <p className='text-gray-400 text-sm'>
            🎯 See how our platform delivers real-time trading signals and
            market analysis
          </p>
        </div>
      </div>
    </div>
  );
}
