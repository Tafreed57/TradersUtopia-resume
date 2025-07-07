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
            src='https://www.youtube.com/embed/XMW0WVYBbLY?rel=0&modestbranding=1&showinfo=0'
            title='TradersUtopia Demo - See Our Platform in Action'
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
          ></iframe>
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
