'use client';

import { UserAvatar } from '@/components/user/user-avatar';
import { cn } from '@/lib/utils';
import { ShieldAlert, FileText } from 'lucide-react';
import NextImage from 'next/image';

interface TrackRecordItemProps {
  id: string;
  content: string;
  admin: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  timestamp: string;
  fileUrl?: string;
  deleted: boolean;
  isUpdated: boolean;
}

export function TrackRecordItem({
  id,
  content,
  admin,
  timestamp,
  fileUrl,
  deleted,
  isUpdated,
}: TrackRecordItemProps) {
  const isPDF = fileUrl?.endsWith('.pdf') && fileUrl;
  const isImage = fileUrl && !isPDF;

  return (
    <div className='relative group flex items-start hover:bg-black/5 p-3 sm:p-4 transition w-full touch-manipulation'>
      <div className='group flex gap-x-2 sm:gap-x-3 items-start w-full'>
        <div className='flex-shrink-0'>
          <UserAvatar
            src={admin.imageUrl ?? undefined}
            className='h-8 w-8 sm:h-10 sm:w-10'
          />
        </div>
        <div className='flex flex-col w-full min-w-0'>
          <div className='flex items-center gap-x-2 flex-wrap'>
            <div className='flex items-center gap-x-1'>
              <div className='font-semibold text-sm sm:text-base text-white truncate'>
                {admin.name}
              </div>
              <div className='flex items-center gap-1'>
                <ShieldAlert className='w-4 h-4 text-red-500' />
                <span className='text-xs text-red-400 font-medium'>ADMIN</span>
              </div>
            </div>
            <span className='text-xs text-gray-400 flex-shrink-0'>
              {timestamp}
            </span>
          </div>

          {isImage && (
            <a
              href={fileUrl}
              target='_blank'
              rel='noreferrer noopener'
              className='relative rounded-md mt-2 overflow-hidden border flex items-center bg-secondary h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48 touch-manipulation'
            >
              <NextImage
                src={fileUrl}
                alt={content}
                fill
                className='object-cover'
              />
            </a>
          )}

          {isPDF && (
            <a
              href={fileUrl}
              target='_blank'
              rel='noreferrer noopener'
              className='relative rounded-md mt-2 overflow-hidden border flex items-center bg-secondary h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48 touch-manipulation'
            >
              <FileText className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-400 m-auto' />
            </a>
          )}

          {!fileUrl && (
            <div
              className={cn(
                'text-sm sm:text-base text-gray-200 break-words whitespace-pre-wrap mt-1',
                deleted && 'italic text-gray-400 text-xs sm:text-sm'
              )}
            >
              {content}
              {isUpdated && !deleted && (
                <span className='text-[10px] sm:text-xs text-gray-400 ml-1'>
                  (edited)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
