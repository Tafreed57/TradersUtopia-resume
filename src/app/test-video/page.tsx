export default function TestVideoPage() {
  return (
    <div className='min-h-screen bg-black p-8'>
      <h1 className='text-white text-2xl mb-8'>YouTube Embed Test</h1>

      {/* Test 1: Big Buck Bunny - Creative Commons */}
      <div className='mb-8'>
        <h2 className='text-white text-xl mb-4'>
          Test 1: Big Buck Bunny (Creative Commons)
        </h2>
        <div className='aspect-video max-w-2xl'>
          <iframe
            className='w-full h-full'
            src='https://www.youtube.com/embed/YE7VzlLtp-4'
            title='Test Video 1'
            frameBorder='0'
            allowFullScreen
          />
        </div>
      </div>

      {/* Test 2: Sintel - Open Source Movie */}
      <div className='mb-8'>
        <h2 className='text-white text-xl mb-4'>
          Test 2: Sintel Trailer (No Cookies)
        </h2>
        <div className='aspect-video max-w-2xl'>
          <iframe
            className='w-full h-full'
            src='https://www.youtube-nocookie.com/embed/eRsGyueVLvQ'
            title='Test Video 2'
            frameBorder='0'
            allowFullScreen
          />
        </div>
      </div>

      {/* Test 3: Tears of Steel - Blender Foundation */}
      <div className='mb-8'>
        <h2 className='text-white text-xl mb-4'>
          Test 3: Tears of Steel (Full Parameters)
        </h2>
        <div className='aspect-video max-w-2xl'>
          <iframe
            className='w-full h-full'
            src='https://www.youtube-nocookie.com/embed/R6MlUcmOul8?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
            title='Test Video 3'
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            loading='lazy'
            referrerPolicy='strict-origin-when-cross-origin'
          />
        </div>
      </div>

      {/* Test 4: Caminandes - Open Source Animation */}
      <div className='mb-8'>
        <h2 className='text-white text-xl mb-4'>
          Test 4: Caminandes (Open Source)
        </h2>
        <div className='aspect-video max-w-2xl'>
          <iframe
            className='w-full h-full'
            src='https://www.youtube-nocookie.com/embed/SkVqJ1SGeL0?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
            title='Test Video 4'
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            loading='lazy'
            referrerPolicy='strict-origin-when-cross-origin'
          />
        </div>
      </div>

      {/* Test 5: Sample Test Video */}
      <div className='mb-8'>
        <h2 className='text-white text-xl mb-4'>Test 5: Sample for Testing</h2>
        <div className='aspect-video max-w-2xl'>
          <iframe
            className='w-full h-full'
            src='https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent'
            title='Test Video 5'
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            loading='lazy'
            referrerPolicy='strict-origin-when-cross-origin'
          />
        </div>
      </div>
    </div>
  );
}
