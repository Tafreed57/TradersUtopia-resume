'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Loader2, Clock, TrendingUp, FileText, Image } from 'lucide-react';
import { UserAvatar } from '../user/user-avatar';

export function TrackRecordMinimal() {
  const { isLoaded } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);

  // Load messages only
  const loadMessages = async () => {
    try {
      const messagesResponse = await fetch('/api/track-record');
      const messagesData = await messagesResponse.json();
      console.log(messagesData);
      setMessages(messagesData.items || []);
      setMessagesCount(messagesData.items?.length || 0);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadData = async () => {
    try {
      await loadMessages();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;

    loadData();

    // Add event listener for refresh events
    const handleRefresh = () => {
      loadMessages();
    };

    window.addEventListener('trackRecordRefresh', handleRefresh);

    return () => {
      window.removeEventListener('trackRecordRefresh', handleRefresh);
    };
  }, [isLoaded]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isLoaded || isLoading) {
    return (
      <div className='flex flex-col h-[600px] md:h-[700px] items-center justify-center'>
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-purple-400/30 backdrop-blur-sm mb-4'>
          <Loader2 className='h-8 w-8 text-purple-400 animate-spin' />
        </div>
        <p className='text-sm text-gray-300'>Loading track record...</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-[600px] md:h-[700px] bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95'>
      {/* Enhanced Header */}
      <div className='sticky top-0 z-10 px-4 md:px-6 py-4 bg-gradient-to-r from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 pwa-safe-top'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-xl flex items-center justify-center border border-purple-400/30'>
                <TrendingUp className='h-5 w-5 text-purple-400' />
              </div>
              <div>
                <h2 className='text-lg font-bold text-white'>
                  Live Track Record
                </h2>
                <p className='text-sm text-gray-400'>
                  Real-time trading updates
                </p>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-4 text-sm text-gray-400'>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
              <span className='hidden sm:inline'>Live Updates</span>
            </div>
            <div className='flex items-center gap-2'>
              <Clock className='h-4 w-4' />
              <span className='hidden sm:inline'>{messagesCount} Updates</span>
              <span className='sm:hidden'>{messagesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6'>
        {messages.length === 0 ? (
          <div className='flex-1 flex items-center justify-center'>
            <div className='text-center space-y-6 p-8 max-w-md'>
              <div className='w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-3xl flex items-center justify-center mx-auto border border-purple-400/30 backdrop-blur-sm'>
                <TrendingUp className='h-10 w-10 text-purple-400' />
              </div>

              <div className='space-y-3'>
                <h3 className='text-xl font-bold text-white'>
                  Welcome to Our Live Track Record
                </h3>
                <p className='text-gray-300 leading-relaxed'>
                  This is where our professional traders share real-time updates
                  about their trading performance. Every trade, win or loss, is
                  documented here with complete transparency.
                </p>
              </div>

              <div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-400/20 backdrop-blur-sm'>
                <div className='flex items-center gap-2 mb-2'>
                  <div className='w-2 h-2 bg-blue-400 rounded-full'></div>
                  <span className='text-blue-400 font-semibold text-sm'>
                    100% Transparent
                  </span>
                </div>
                <p className='text-sm text-gray-300'>
                  All trading updates are verified and documented to ensure
                  authenticity and accuracy of performance information.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`group relative ${
                  index === 0
                    ? 'animate-in slide-in-from-top-1 duration-300'
                    : ''
                }`}
              >
                <div className='bg-gradient-to-r from-gray-800/80 to-gray-700/80 rounded-2xl p-4 md:p-6 border border-gray-700/50 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/20'>
                  {/* Message Header */}
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 bg-gradient-to-br to-emerald-600 rounded-xl flex items-center justify-center shadow-lg'>
                        <UserAvatar
                          src='/logo.png'
                          className='h-8 w-8 sm:h-10 sm:w-10'
                        />
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='text-white font-semibold'>
                            {'Shehroze Afridi'}
                          </span>
                          <div className='flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-400/30 rounded-full'>
                            <div className='w-2 h-2 bg-green-400 rounded-full'></div>
                            <span className='text-green-400 text-xs font-medium'>
                              VERIFIED
                            </span>
                          </div>
                        </div>
                        <span className='text-gray-400 text-sm flex items-center gap-1'>
                          {formatTimestamp(message.createdAt)}
                          {message.updatedAt &&
                            message.updatedAt !== message.createdAt && (
                              <span className='text-xs text-gray-500'>
                                (edited)
                              </span>
                            )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className='space-y-3'>
                    <p className='text-gray-100 leading-relaxed whitespace-pre-wrap'>
                      {message.content}
                    </p>

                    {/* File Attachment */}
                    {message.fileUrl && (
                      <div className='mt-4'>
                        {message.fileUrl.includes('.pdf') ? (
                          <a
                            href={message.fileUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-600/20 border border-purple-400/30 rounded-xl text-purple-400 hover:text-purple-300 transition-all duration-200 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10'
                          >
                            <FileText className='h-4 w-4' />
                            <span className='text-sm font-medium'>
                              View PDF Document
                            </span>
                          </a>
                        ) : (
                          <div className='relative inline-block'>
                            <img
                              src={message.fileUrl}
                              alt='Track record attachment'
                              className='max-w-sm rounded-xl border border-gray-600/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer'
                              onClick={() =>
                                window.open(message.fileUrl, '_blank')
                              }
                            />
                            <div className='absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-lg p-1'>
                              <Image className='h-4 w-4 text-white' />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
