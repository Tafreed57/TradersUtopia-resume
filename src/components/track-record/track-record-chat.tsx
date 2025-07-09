'use client';

import { TrackRecordHeader } from '@/components/track-record/track-record-header';
import { TrackRecordInput } from '@/components/track-record/track-record-input';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function TrackRecordChat() {
  const { userId, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoaded) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        // Fetch messages first (always available)
        const messagesResponse = await fetch('/api/track-record/messages');
        const messagesData = await messagesResponse.json();

        if (isMounted) {
          setMessages(messagesData.items || []);
        }

        // Check admin status if user is logged in
        if (userId) {
          const adminResponse = await fetch('/api/admin/check-status');
          const adminData = await adminResponse.json();

          if (isMounted) {
            setIsAdmin(adminData.isAdmin);
          }
        } else {
          if (isMounted) {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, userId]);

  // Don't render anything until auth is loaded
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
    <div className='flex flex-col h-[600px] md:h-[700px]'>
      <TrackRecordHeader />

      {/* Messages Display */}
      <div className='flex-1 flex flex-col py-4 overflow-y-auto'>
        {messages.length === 0 ? (
          <div className='flex-1 flex items-center justify-center'>
            <div className='text-center space-y-4 p-8'>
              <div className='w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                <div className='w-8 h-8 text-purple-400'>📊</div>
              </div>
              <h3 className='text-xl font-bold text-white'>
                Welcome to Our Track Record
              </h3>
              <p className='text-gray-300 max-w-md'>
                This is where our professional traders share real-time updates
                about their trading performance. Every trade, win or loss, is
                documented here with complete transparency.
              </p>
              <div className='text-center p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-400/20'>
                <p className='text-sm text-gray-300'>
                  <span className='text-yellow-400 font-medium'>Note:</span>{' '}
                  Only our verified administrators can post updates to ensure
                  authenticity and accuracy.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className='space-y-4 px-4'>
            {messages.map(message => (
              <div
                key={message.id}
                className='bg-gray-800/50 rounded-lg p-4 border border-gray-700/30'
              >
                <div className='flex items-center gap-2 mb-2'>
                  <div className='w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center'>
                    <span className='text-white text-xs font-bold'>A</span>
                  </div>
                  <span className='text-white font-semibold'>
                    {message.admin.name}
                  </span>
                  <span className='text-red-400 text-xs font-medium'>
                    ADMIN
                  </span>
                  <span className='text-gray-400 text-xs ml-auto'>
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className='text-gray-200 whitespace-pre-wrap'>
                  {message.content}
                </p>
                {message.fileUrl && (
                  <div className='mt-2'>
                    {message.fileUrl.includes('.pdf') ? (
                      <a
                        href={message.fileUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-400 hover:text-blue-300 underline'
                      >
                        📄 View PDF
                      </a>
                    ) : (
                      <img
                        src={message.fileUrl}
                        alt='Track record attachment'
                        className='max-w-xs rounded-lg'
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ FULL ADMIN INPUT: Now using the complete TrackRecordInput component */}
      {isAdmin && <TrackRecordInput apiUrl='/api/track-record/messages' />}
    </div>
  );
}
