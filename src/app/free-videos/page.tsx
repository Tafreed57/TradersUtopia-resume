'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import NextImage from 'next/image';
import { SharedNavbar } from '@/components/shared-navbar';
import { HeroBanner } from '@/components/hero-banner';
import {
  Play,
  Clock,
  Users,
  Star,
  BookOpen,
  Award,
  ArrowRight,
} from 'lucide-react';

// Complete Trading Course - 31 Professional Lessons
const videoSections = [
  {
    title: 'Trading Fundamentals',
    description: 'Master the basics of trading',
    videos: [
      {
        id: 1,
        title: 'Trading Fundamentals - Lesson 1',
        duration: '12:45',
        embedUrl: 'https://www.youtube.com/embed/TdPQNrQrpXw',
        youtubeId: 'TdPQNrQrpXw',
        description: 'Learn essential trading concepts and strategies.',
      },
      {
        id: 2,
        title: 'Trading Fundamentals - Lesson 2',
        duration: '15:20',
        embedUrl: 'https://www.youtube.com/embed/HQ1rT821rdc',
        youtubeId: 'HQ1rT821rdc',
        description: 'Foundation principles for successful trading.',
      },
      {
        id: 3,
        title: 'Trading Fundamentals - Lesson 3',
        duration: '14:30',
        embedUrl: 'https://www.youtube.com/embed/RqhcD5ZFQgw',
        youtubeId: 'RqhcD5ZFQgw',
        description: 'Understanding market structure and dynamics.',
      },
      {
        id: 4,
        title: 'Trading Fundamentals - Lesson 4',
        duration: '16:45',
        embedUrl: 'https://www.youtube.com/embed/Gj5QTdIqvNo',
        youtubeId: 'Gj5QTdIqvNo',
        description: 'Market analysis and entry strategies.',
      },
      {
        id: 5,
        title: 'Trading Fundamentals - Lesson 5',
        duration: '13:15',
        embedUrl: 'https://www.youtube.com/embed/aBIOiTgHy4A',
        youtubeId: 'aBIOiTgHy4A',
        description: 'Building your trading foundation.',
      },
      {
        id: 6,
        title: 'Trading Fundamentals - Lesson 6',
        duration: '18:30',
        embedUrl: 'https://www.youtube.com/embed/NNA03EMgE5g',
        youtubeId: 'NNA03EMgE5g',
        description: 'Advanced fundamental analysis techniques.',
      },
      {
        id: 7,
        title: 'Trading Fundamentals - Lesson 7',
        duration: '12:00',
        embedUrl: 'https://www.youtube.com/embed/oq4unSe29Eo',
        youtubeId: 'oq4unSe29Eo',
        description: 'Psychology and mindset for trading success.',
      },
      {
        id: 8,
        title: 'Trading Fundamentals - Lesson 8',
        duration: '17:15',
        embedUrl: 'https://www.youtube.com/embed/JVgt_NP2br8',
        youtubeId: 'JVgt_NP2br8',
        description: 'Putting fundamentals into practice.',
      },
    ],
  },
  {
    title: 'Technical Analysis',
    description: 'Chart patterns and indicators',
    videos: [
      {
        id: 9,
        title: 'Technical Analysis - Lesson 1',
        duration: '15:30',
        embedUrl: 'https://www.youtube.com/embed/HNA42gN9FcM',
        youtubeId: 'HNA42gN9FcM',
        description: 'Introduction to technical analysis principles.',
      },
      {
        id: 10,
        title: 'Technical Analysis - Lesson 2',
        duration: '16:45',
        embedUrl: 'https://www.youtube.com/embed/XhZjSqOYp60',
        youtubeId: 'XhZjSqOYp60',
        description: 'Chart patterns and trend identification.',
      },
      {
        id: 11,
        title: 'Technical Analysis - Lesson 3',
        duration: '14:20',
        embedUrl: 'https://www.youtube.com/embed/43IlkE3C0_Q',
        youtubeId: '43IlkE3C0_Q',
        description: 'Support and resistance levels.',
      },
      {
        id: 12,
        title: 'Technical Analysis - Lesson 4',
        duration: '18:15',
        embedUrl: 'https://www.youtube.com/embed/mtX4Ri72Z1w',
        youtubeId: 'mtX4Ri72Z1w',
        description: 'Moving averages and trend indicators.',
      },
      {
        id: 13,
        title: 'Technical Analysis - Lesson 5',
        duration: '13:45',
        embedUrl: 'https://www.youtube.com/embed/D-cgUnyLl8E',
        youtubeId: 'D-cgUnyLl8E',
        description: 'Momentum indicators and oscillators.',
      },
      {
        id: 14,
        title: 'Technical Analysis - Lesson 6',
        duration: '19:30',
        embedUrl: 'https://www.youtube.com/embed/Hj0daP5OQ44',
        youtubeId: 'Hj0daP5OQ44',
        description: 'Volume analysis and market depth.',
      },
      {
        id: 15,
        title: 'Technical Analysis - Lesson 7',
        duration: '15:00',
        embedUrl: 'https://www.youtube.com/embed/eow2C1CsJhA',
        youtubeId: 'eow2C1CsJhA',
        description: 'Candlestick patterns and formations.',
      },
      {
        id: 16,
        title: 'Technical Analysis - Lesson 8',
        duration: '17:45',
        embedUrl: 'https://www.youtube.com/embed/-s0TBZMrzT8',
        youtubeId: '-s0TBZMrzT8',
        description: 'Advanced chart pattern recognition.',
      },
      {
        id: 17,
        title: 'Technical Analysis - Lesson 9',
        duration: '14:30',
        embedUrl: 'https://www.youtube.com/embed/3tZylYKlPVg',
        youtubeId: '3tZylYKlPVg',
        description: 'Fibonacci retracements and extensions.',
      },
      {
        id: 18,
        title: 'Technical Analysis - Lesson 10',
        duration: '16:20',
        embedUrl: 'https://www.youtube.com/embed/Uy6nK-7Xzvc',
        youtubeId: 'Uy6nK-7Xzvc',
        description: 'Elliott Wave theory and applications.',
      },
      {
        id: 19,
        title: 'Technical Analysis - Lesson 11',
        duration: '18:15',
        embedUrl: 'https://www.youtube.com/embed/Nzv5xCABzZE',
        youtubeId: 'Nzv5xCABzZE',
        description: 'Multiple timeframe analysis.',
      },
      {
        id: 20,
        title: 'Technical Analysis - Lesson 12',
        duration: '15:45',
        embedUrl: 'https://www.youtube.com/embed/nka3fnXlI9o',
        youtubeId: 'nka3fnXlI9o',
        description: 'Putting technical analysis together.',
      },
    ],
  },
  {
    title: 'Risk Management',
    description: 'Protect your capital',
    videos: [
      {
        id: 21,
        title: 'Risk Management - Lesson 1',
        duration: '18:20',
        embedUrl: 'https://www.youtube.com/embed/qhQ6zJ2VRTE',
        youtubeId: 'qhQ6zJ2VRTE',
        description: 'Introduction to risk management principles.',
      },
      {
        id: 22,
        title: 'Risk Management - Lesson 2',
        duration: '16:30',
        embedUrl: 'https://www.youtube.com/embed/vsEI1X4HzHs',
        youtubeId: 'vsEI1X4HzHs',
        description: 'Position sizing and capital allocation.',
      },
      {
        id: 23,
        title: 'Risk Management - Lesson 3',
        duration: '19:15',
        embedUrl: 'https://www.youtube.com/embed/th1e63PPgYc',
        youtubeId: 'th1e63PPgYc',
        description: 'Stop-loss strategies and implementation.',
      },
      {
        id: 24,
        title: 'Risk Management - Lesson 4',
        duration: '17:45',
        embedUrl: 'https://www.youtube.com/embed/UYhiCvN7fhk',
        youtubeId: 'UYhiCvN7fhk',
        description: 'Portfolio diversification and correlation.',
      },
      {
        id: 25,
        title: 'Risk Management - Lesson 5',
        duration: '15:30',
        embedUrl: 'https://www.youtube.com/embed/FOy969v_wNQ',
        youtubeId: 'FOy969v_wNQ',
        description: 'Risk-reward ratios and expectancy.',
      },
      {
        id: 26,
        title: 'Risk Management - Lesson 6',
        duration: '20:00',
        embedUrl: 'https://www.youtube.com/embed/dbgKKEMpIlw',
        youtubeId: 'dbgKKEMpIlw',
        description: 'Advanced risk management techniques.',
      },
    ],
  },
  {
    title: 'Advanced Strategies',
    description: 'Pro-level trading techniques',
    videos: [
      {
        id: 27,
        title: 'Advanced Strategies - Lesson 1',
        duration: '22:15',
        embedUrl: 'https://www.youtube.com/embed/fW-rSt9ai6g',
        youtubeId: 'fW-rSt9ai6g',
        description: 'Advanced trading strategies introduction.',
      },
      {
        id: 28,
        title: 'Advanced Strategies - Lesson 2',
        duration: '24:30',
        embedUrl: 'https://www.youtube.com/embed/ZTrYC7taCxQ',
        youtubeId: 'ZTrYC7taCxQ',
        description: 'Algorithmic and systematic trading.',
      },
      {
        id: 29,
        title: 'Advanced Strategies - Lesson 3',
        duration: '21:45',
        embedUrl: 'https://www.youtube.com/embed/ODPcZqMYK0I',
        youtubeId: 'ODPcZqMYK0I',
        description: 'Market microstructure and order flow.',
      },
      {
        id: 30,
        title: 'Advanced Strategies - Lesson 4',
        duration: '23:20',
        embedUrl: 'https://www.youtube.com/embed/0fV51TI2MQU',
        youtubeId: '0fV51TI2MQU',
        description: 'Options strategies and derivatives.',
      },
      {
        id: 31,
        title: 'Advanced Strategies - Lesson 5',
        duration: '25:00',
        embedUrl: 'https://www.youtube.com/embed/imo5lsZzOSE',
        youtubeId: 'imo5lsZzOSE',
        description: 'Professional trading psychology and mastery.',
      },
    ],
  },
];

export default function FreeVideosPage() {
  const totalVideos = videoSections.reduce(
    (total, section) => total + section.videos.length,
    0
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black text-white'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      <div className='relative z-10'>
        {/* Hero Banner */}
        <HeroBanner />

        {/* Shared Navigation */}
        <SharedNavbar currentPage='free-videos' />

        {/* Hero Section - Mobile-First */}
        <section className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16'>
          <div className='text-center mb-12 sm:mb-16'>
            {/* Free Badge */}
            <div className='inline-flex items-center gap-2 bg-green-600/20 border border-green-400/30 rounded-full px-3 sm:px-4 py-2 mb-4 sm:mb-6 text-sm'>
              <Award className='w-4 h-4 sm:w-5 sm:h-5 text-green-400' />
              <span className='text-green-400 font-medium'>
                100% Free Course Content
              </span>
            </div>

            <h1 className='text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight px-2'>
              <span className='bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent'>
                Free Trading Course
              </span>
              <br />
              <span className='text-white'>Master the Markets</span>
            </h1>

            <p className='text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4'>
              Access our complete trading education library with {totalVideos}{' '}
              professional lessons covering everything from basics to advanced
              strategies.
            </p>

            {/* Stats - Mobile-First Grid */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 xl:gap-8 mb-8 sm:mb-12 text-center max-w-5xl mx-auto'>
              <div className='flex flex-col items-center bg-gradient-to-b from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-blue-400/20 touch-manipulation'>
                <div className='text-xl sm:text-2xl lg:text-3xl font-bold text-blue-400'>
                  {totalVideos}
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Free Videos
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-green-400/20 touch-manipulation'>
                <div className='text-xl sm:text-2xl lg:text-3xl font-bold text-green-400'>
                  8+
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Hours Content
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-purple-400/20 touch-manipulation'>
                <div className='text-xl sm:text-2xl lg:text-3xl font-bold text-purple-400'>
                  4
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>
                  Course Modules
                </div>
              </div>
              <div className='flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-yellow-400/20 touch-manipulation'>
                <div className='text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400'>
                  HD
                </div>
                <div className='text-xs sm:text-sm text-gray-300'>Quality</div>
              </div>
            </div>

            {/* CTA Section - Mobile-Optimized */}
            <div className='flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8 px-4'>
              <Link href='/pricing'>
                <Button className='bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-lg touch-manipulation min-h-[44px] w-full sm:w-auto'>
                  <ArrowRight className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />
                  <span className='hidden sm:inline'>Upgrade to Premium</span>
                  <span className='sm:hidden'>Get Premium</span>
                </Button>
              </Link>
              <div className='text-green-400 text-sm flex items-center gap-2'>
                <Star className='w-4 h-4' />
                <span>Premium access available</span>
              </div>
            </div>
          </div>
        </section>

        {/* Video Sections */}
        <section id='videos' className='max-w-7xl mx-auto px-4 sm:px-6 pb-16'>
          {videoSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className='mb-16'>
              {/* Section Header */}
              <div className='text-center mb-12'>
                <h2 className='text-3xl sm:text-4xl font-bold mb-4'>
                  <span className='bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
                    {section.title}
                  </span>
                </h2>
                <p className='text-lg text-gray-300 max-w-2xl mx-auto'>
                  {section.description}
                </p>
              </div>

              {/* Video Grid */}
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {section.videos.map(video => (
                  <div
                    key={video.id}
                    className='group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/10 backdrop-blur-sm'
                  >
                    {/* YouTube Video Embed */}
                    <div className='relative aspect-video bg-gradient-to-br from-gray-900 to-black overflow-hidden'>
                      <iframe
                        src={`${video.embedUrl}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&wmode=transparent&controls=1&autohide=1`}
                        title={video.title}
                        className='w-full h-full'
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                        allowFullScreen
                        loading='lazy'
                      />

                      {/* Duration Badge */}
                      <div className='absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs flex items-center gap-1 z-10'>
                        <Clock className='w-3 h-3' />
                        {video.duration}
                      </div>

                      {/* Video Number */}
                      <div className='absolute top-2 left-2 bg-yellow-500/90 px-2 py-1 rounded text-black text-xs font-bold z-10'>
                        #{video.id}
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className='p-4'>
                      <h3 className='text-lg font-semibold mb-2 group-hover:text-yellow-300 transition-colors line-clamp-2'>
                        {video.title}
                      </h3>
                      <p className='text-gray-400 text-sm mb-3 line-clamp-2'>
                        {video.description}
                      </p>

                      <a
                        href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='w-full inline-flex items-center justify-center bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-400/30 text-yellow-400 hover:bg-gradient-to-r hover:from-yellow-500 hover:to-yellow-600 hover:text-black transition-all duration-300 rounded-md px-4 py-2 text-sm font-medium'
                      >
                        <Play className='w-4 h-4 mr-2' />
                        Watch on YouTube
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* CTA Section */}
        <section className='bg-gradient-to-r from-gray-900/50 to-black py-20'>
          <div className='max-w-4xl mx-auto px-4 sm:px-6 text-center'>
            <div className='bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-400/30 rounded-2xl p-8'>
              <h2 className='text-3xl sm:text-4xl font-bold mb-4'>
                Ready for Advanced Training?
              </h2>
              <p className='text-xl text-gray-300 mb-6'>
                Get real-time trade alerts, live sessions, and premium
                strategies with our paid membership.
              </p>
              <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
                <Link href='/pricing'>
                  <Button className='bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold px-8 py-4 text-lg rounded-lg'>
                    Get Premium Access
                  </Button>
                </Link>
                <div className='flex items-center gap-2 text-green-400 text-sm'>
                  <Star className='w-4 h-4' />
                  <span>Professional trading alerts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className='bg-gradient-to-b from-gray-900/50 to-black py-16'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6'>
            <div className='text-center'>
              <div className='flex items-center justify-center gap-3 mb-4'>
                <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center'>
                  <NextImage
                    src='/logo.png'
                    alt='TradersUtopia'
                    width={20}
                    height={20}
                  />
                </div>
                <span className='text-white font-bold'>TradersUtopia</span>
              </div>
              <p className='text-gray-400 text-sm mb-4'>
                Professional trading education and signals platform.
              </p>
              <div className='flex items-center justify-center gap-6 text-sm'>
                <Link href='/' className='text-gray-400 hover:text-white'>
                  Home
                </Link>
                <Link
                  href='/pricing'
                  className='text-gray-400 hover:text-white'
                >
                  Pricing
                </Link>
                <Link href='/free-videos' className='text-yellow-400'>
                  Free Videos
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
