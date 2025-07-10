'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import {
  Plus,
  Send,
  FileText,
  Image,
  Loader2,
  Users,
  Clock,
  TrendingUp,
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { useStore } from '@/store/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TrackRecordMinimal() {
  const { userId, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messagesCount, setMessagesCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminStatusChecked, setAdminStatusChecked] = useState(false);
  const onOpen = useStore(state => state.onOpen);

  // Load messages only (optimized to not check admin status every time)
  const loadMessages = async () => {
    try {
      const messagesResponse = await fetch('/api/track-record/messages');
      const messagesData = await messagesResponse.json();

      setMessages(messagesData.items || []);
      setMessagesCount(messagesData.items?.length || 0);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Check admin status only when needed (with caching)
  const checkAdminStatus = async () => {
    if (!userId || adminStatusChecked) return;

    try {
      // Check if we have cached admin status
      const cacheKey = `admin_status_${userId}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        const { isAdmin: cachedAdmin, timestamp } = JSON.parse(cached);
        // Use cache if it's less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setIsAdmin(cachedAdmin);
          setCurrentUserId(userId);
          setAdminStatusChecked(true);
          return;
        }
      }

      // Only make API call if not cached or cache expired
      const adminResponse = await fetch('/api/admin/check-status');

      if (adminResponse.status === 429) {
        // Rate limited - use cached value or default to false
        const fallback = cached ? JSON.parse(cached).isAdmin : false;
        setIsAdmin(fallback);
        setCurrentUserId(userId);
        setAdminStatusChecked(true);
        return;
      }

      const adminData = await adminResponse.json();
      setIsAdmin(adminData.isAdmin);
      setCurrentUserId(userId);
      setAdminStatusChecked(true);

      // Cache the result
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          isAdmin: adminData.isAdmin,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setCurrentUserId(userId);
      setAdminStatusChecked(true);
    }
  };

  const loadData = async () => {
    try {
      await loadMessages();

      if (userId && !adminStatusChecked) {
        await checkAdminStatus();
      } else if (!userId) {
        setIsAdmin(false);
        setCurrentUserId(null);
        setAdminStatusChecked(true);
      }
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
      // Only refresh messages, not admin status
      loadMessages();
    };

    window.addEventListener('trackRecordRefresh', handleRefresh);

    return () => {
      window.removeEventListener('trackRecordRefresh', handleRefresh);
    };
  }, [isLoaded, userId]);

  // Reset admin status check when user changes
  useEffect(() => {
    if (userId !== currentUserId) {
      setAdminStatusChecked(false);
    }
  }, [userId, currentUserId]);

  // Helper function to check if current user can edit/delete a message
  const canEditMessage = (message: any) => {
    return isAdmin && message.admin?.id === currentUserId;
  };

  const canDeleteMessage = (message: any) => {
    return isAdmin; // Admins can delete any message
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/track-record/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: inputValue }),
      });

      if (response.ok) {
        setInputValue('');

        // Reset textarea height
        const textarea = document.querySelector(
          'textarea'
        ) as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = '56px';
        }

        // Refresh messages only
        loadMessages();
      }
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

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
                      <div className='w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg'>
                        <span className='text-white text-sm font-bold'>T</span>
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='text-white font-semibold'>
                            {message.admin?.name || 'Trader'}
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

                    <div className='opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                      {isAdmin &&
                      (canEditMessage(message) || canDeleteMessage(message)) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50'
                            >
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align='end'
                            className='w-48 bg-gray-800 border border-gray-700 shadow-xl'
                          >
                            {canEditMessage(message) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onOpen('editTrackRecordMessage', { message })
                                }
                                className='text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer'
                              >
                                <Edit className='h-4 w-4 mr-2' />
                                Edit Message
                              </DropdownMenuItem>
                            )}
                            {canDeleteMessage(message) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onOpen('deleteTrackRecordMessage', {
                                    message,
                                  })
                                }
                                className='text-red-400 hover:text-red-300 hover:bg-red-900/20 cursor-pointer'
                              >
                                <Trash2 className='h-4 w-4 mr-2' />
                                Delete Message
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50'
                        >
                          <Clock className='h-4 w-4' />
                        </Button>
                      )}
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

      {/* Enhanced Admin Input */}
      {isAdmin && (
        <div className='border-t border-gray-700/50 bg-gradient-to-r from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl'>
          <div className='p-4 md:p-6'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
                <span className='text-green-400 text-sm font-medium'>
                  LIVE UPDATES
                </span>
              </div>
              <div className='text-xs text-gray-400'>
                Share your trading insights
              </div>
            </div>

            <form onSubmit={handleSubmit} className='space-y-3'>
              <div className='relative'>
                {/* Add File Button */}
                <button
                  type='button'
                  onClick={() =>
                    onOpen('trackRecordFile', {
                      apiUrl: '/api/track-record/messages',
                    })
                  }
                  className='absolute top-1/2 -translate-y-1/2 left-4 z-10 h-9 w-9 bg-gradient-to-br from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 rounded-xl flex items-center justify-center group backdrop-blur-sm hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20'
                >
                  <Plus className='h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-colors' />
                </button>

                {/* Textarea */}
                <textarea
                  value={inputValue}
                  onChange={e => {
                    setInputValue(e.target.value);
                    // Auto-resize
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder='Share a track record update... (Shift+Enter for new line)'
                  disabled={isSubmitting}
                  className='w-full pl-16 pr-32 py-4 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/30 focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 focus:ring-offset-0 text-white placeholder:text-gray-400 rounded-xl min-h-[56px] max-h-[200px] resize-none transition-all duration-300 hover:border-gray-500/50 backdrop-blur-sm'
                  style={{ resize: 'none' }}
                />

                {/* Right Side Controls */}
                <div className='absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-2'>
                  {/* Emoji Picker */}
                  <div className='h-9 w-9 rounded-xl bg-gradient-to-br from-gray-700/50 to-gray-600/50 border border-gray-600/30 backdrop-blur-sm hover:from-purple-600/20 hover:to-blue-600/20 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 flex items-center justify-center group'>
                    <EmojiPicker
                      onChange={emoji => setInputValue(prev => prev + emoji)}
                    />
                  </div>

                  {/* Send Button */}
                  <Button
                    type='submit'
                    disabled={isSubmitting || !inputValue.trim()}
                    className='h-9 w-9 p-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-400/20 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed'
                  >
                    {isSubmitting ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Send className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </div>

              <div className='flex items-center justify-between text-xs text-gray-400'>
                <span>Enter to send • Shift+Enter for new line</span>
                <span className='flex items-center gap-1'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  Ready to post
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
