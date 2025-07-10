'use client';

import { SharedNavbar } from '@/components/shared-navbar';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white'>
      <SharedNavbar />

      <section className='relative pt-20 pb-16 overflow-hidden pwa-safe-top pt-24 md:pt-20'>
        <div className='absolute inset-0 bg-gradient-to-br from-purple-900/20 via-gray-900/40 to-black/80'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6'>
          <div className='flex items-center gap-4 mb-8'>
            <Link
              href='/'
              className='text-gray-400 hover:text-white transition-colors'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='flex items-center gap-2'>
              <MessageSquare className='w-6 h-6 text-purple-400' />
              <span className='text-gray-400'>Support Center</span>
            </div>
          </div>

          <div className='text-center'>
            <h1 className='text-3xl sm:text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent'>
              Help & Support
            </h1>
            <p className='text-lg sm:text-xl text-gray-300 mb-8 max-w-3xl mx-auto'>
              We're here to help you succeed! Get instant support, join our
              community, and access comprehensive trading resources.
            </p>
          </div>
        </div>
      </section>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 pb-20'>
        <div className='space-y-12'>
          <section className='bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-gray-900/40 rounded-2xl p-6 sm:p-8 border border-purple-400/30 backdrop-blur-sm'>
            <div className='flex items-center gap-3 mb-6'>
              <MessageSquare className='w-8 h-8 text-blue-400' />
              <h2 className='text-2xl font-bold text-blue-300'>
                Join Our Discord Community
              </h2>
            </div>

            <p className='text-gray-300 text-lg leading-relaxed mb-6'>
              Connect with fellow traders, get instant support, and access
              exclusive content in our thriving Discord community of 1,000+
              members!
            </p>

            <div className='text-center'>
              <a
                href='https://discord.gg/3bbsbu9RyN'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-800 text-white px-8 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl border border-blue-400/30 hover:border-purple-400/50 hover:shadow-purple-500/25'
              >
                <MessageSquare className='w-5 h-5' />
                <span>Join Discord Community</span>
                <ExternalLink className='w-4 h-4' />
              </a>
              <p className='text-gray-400 text-sm mt-3'>
                Free to join • Instant access • 1,000+ members
              </p>
            </div>
          </section>

          <section className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm'>
            <div className='flex items-center gap-3 mb-6'>
              <Phone className='w-8 h-8 text-green-400' />
              <h2 className='text-2xl font-bold'>Contact Methods</h2>
            </div>

            <div className='grid md:grid-cols-2 gap-6'>
              <div className='bg-green-900/20 rounded-xl p-6 border border-green-400/30'>
                <div className='flex items-center gap-3 mb-4'>
                  <Phone className='w-6 h-6 text-green-400' />
                  <h3 className='text-lg font-semibold text-green-300'>
                    Phone Support
                  </h3>
                </div>
                <p className='text-gray-300 mb-3'>
                  Direct line for urgent support and account issues
                </p>
                <a
                  href='tel:+12893065228'
                  className='text-green-300 font-medium hover:text-green-200 transition-colors'
                >
                  +1 289 306 5228
                </a>
              </div>

              <div className='bg-purple-900/20 rounded-xl p-6 border border-purple-400/30'>
                <div className='flex items-center gap-3 mb-4'>
                  <Mail className='w-6 h-6 text-purple-400' />
                  <h3 className='text-lg font-semibold text-purple-300'>
                    Email Support
                  </h3>
                </div>
                <p className='text-gray-300 mb-3'>
                  Detailed inquiries and account management
                </p>
                <a
                  href='mailto:info@tradersutopia.com'
                  className='text-purple-300 font-medium hover:text-purple-200 transition-colors'
                >
                  info@tradersutopia.com
                </a>
              </div>
            </div>
          </section>

          <div className='text-center py-12'>
            <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'>
              <h3 className='text-2xl font-bold mb-4'>Still Need Help?</h3>
              <p className='text-gray-300 mb-6'>
                Our community and support team are here to help you succeed.
                Don't hesitate to reach out!
              </p>
              <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                <Link href='/'>
                  <Button
                    variant='outline'
                    className='bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white'
                  >
                    <ArrowLeft className='w-4 h-4 mr-2' />
                    Back to Home
                  </Button>
                </Link>
                <a
                  href='https://discord.gg/3bbsbu9RyN'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Button className='bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'>
                    <MessageSquare className='w-4 h-4 mr-2' />
                    Join Discord Now
                    <ExternalLink className='w-4 h-4 ml-2' />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
