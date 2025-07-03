'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import { useParams, useRouter } from 'next/navigation';

interface SideBarItemProps {
  name: string;
  id: string;
  imageUrl: string | null;
}

export function SideBarItem({ name, id, imageUrl }: SideBarItemProps) {
  const router = useRouter();
  const params = useParams();

  const isActive = params?.serverId === id;

  return (
    <ActionTooltip side='right' align='center' label={name}>
      <button
        onClick={() => {
          router.push(`/servers/${id}`);
        }}
        className='relative group flex items-center justify-center touch-manipulation p-2 w-full'
      >
        {/* Active/Hover indicator bar */}
        <div
          className={cn(
            'absolute left-0 rounded-r-full transition-all duration-300 z-10',
            'w-[4px] bg-gradient-to-b',
            isActive
              ? 'h-[42px] from-blue-400 via-purple-500 to-pink-500 shadow-lg shadow-blue-400/30'
              : 'h-[10px] from-gray-400 to-gray-600 group-hover:h-[24px] group-hover:from-blue-400 group-hover:to-purple-500'
          )}
        />

        {/* Server icon container */}
        <div
          className={cn(
            'relative h-[56px] w-[56px] transition-all duration-300',
            'border-2 border-transparent shadow-lg',
            'group-hover:border-blue-400/30 group-hover:shadow-xl group-hover:shadow-blue-400/20 group-hover:scale-110',
            isActive && [
              'border-blue-400/50 shadow-xl shadow-blue-400/25 scale-105',
            ],
            // Conditional rounding based on state
            isActive
              ? 'rounded-[20px]'
              : 'rounded-[28px] group-hover:rounded-[20px]'
          )}
        >
          {imageUrl ? (
            <div
              className={cn(
                'w-full h-full overflow-hidden transition-all duration-300',
                // Conditional rounding for the image container
                isActive
                  ? 'rounded-[18px]'
                  : 'rounded-[26px] group-hover:rounded-[18px]'
              )}
            >
              <NextImage
                src={imageUrl}
                alt={name}
                width={56}
                height={56}
                className={cn(
                  'w-full h-full object-cover transition-all duration-300',
                  'group-hover:scale-105 group-hover:brightness-110'
                )}
                style={{
                  objectPosition: 'center',
                }}
                unoptimized
                priority={false}
              />
            </div>
          ) : (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center text-white font-bold text-2xl transition-all duration-300',
                'bg-gradient-to-br from-blue-500 to-purple-600',
                'group-hover:from-blue-400 group-hover:to-purple-500',
                // Conditional rounding for fallback
                isActive
                  ? 'rounded-[18px]'
                  : 'rounded-[26px] group-hover:rounded-[18px]'
              )}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Active server glow effect */}
          {isActive && (
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-500/10 animate-pulse',
                'rounded-[18px]'
              )}
            />
          )}

          {/* Background for active state */}
          {isActive && (
            <div
              className={cn(
                'absolute inset-[-2px] bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm -z-10',
                'rounded-[20px]'
              )}
            />
          )}
        </div>
      </button>
    </ActionTooltip>
  );
}
