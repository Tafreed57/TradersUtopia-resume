'use client';

import { Button } from '@/components/ui/button';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import {
  Music,
  Youtube,
  Twitter,
  MessageCircle,
  Instagram,
} from 'lucide-react';

// Social media links - actual TradersUtopia social media accounts
const socialMediaLinks = {
  tiktok: 'https://tiktok.com/@tradersutopia', // TikTok link needed
  youtube: 'https://www.youtube.com/@ShehrozeAfridi', // Shehroze Afridi YouTube
  x: 'https://x.com/tradersutopia', // X/Twitter link needed
  discord: 'https://discord.gg/3bbsbu9RyN', // TradersUtopia Discord
  instagram: 'https://www.instagram.com/rozetrader/', // RozeTrader Instagram
};

interface SocialMediaButtonsProps {
  className?: string;
  variant?: 'navbar' | 'compact';
}

export function SocialMediaButtons({
  className = '',
  variant = 'navbar',
}: SocialMediaButtonsProps) {
  const buttonSize = variant === 'compact' ? 'w-8 h-8' : 'w-9 h-9';
  const iconSize = variant === 'compact' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* TikTok */}
      <ActionTooltip label='Follow us on TikTok' side='bottom' align='center'>
        <Button
          variant='ghost'
          size='icon'
          className={`${buttonSize} hover:bg-white/10 bg-gray-700/20 backdrop-blur-sm border border-gray-600/30 rounded-lg transition-all duration-200 hover:border-pink-400/50 hover:scale-105 active:scale-95`}
          onClick={() => window.open(socialMediaLinks.tiktok, '_blank')}
        >
          <Music className={iconSize} />
        </Button>
      </ActionTooltip>

      {/* YouTube */}
      <ActionTooltip
        label='Subscribe to our YouTube'
        side='bottom'
        align='center'
      >
        <Button
          variant='ghost'
          size='icon'
          className={`${buttonSize} hover:bg-white/10 bg-gray-700/20 backdrop-blur-sm border border-gray-600/30 rounded-lg transition-all duration-200 hover:border-red-400/50 hover:scale-105 active:scale-95`}
          onClick={() => window.open(socialMediaLinks.youtube, '_blank')}
        >
          <Youtube className={iconSize} />
        </Button>
      </ActionTooltip>

      {/* X (formerly Twitter) */}
      <ActionTooltip label='Follow us on X' side='bottom' align='center'>
        <Button
          variant='ghost'
          size='icon'
          className={`${buttonSize} hover:bg-white/10 bg-gray-700/20 backdrop-blur-sm border border-gray-600/30 rounded-lg transition-all duration-200 hover:border-blue-400/50 hover:scale-105 active:scale-95`}
          onClick={() => window.open(socialMediaLinks.x, '_blank')}
        >
          <Twitter className={iconSize} />
        </Button>
      </ActionTooltip>

      {/* Discord */}
      <ActionTooltip label='Join our Discord' side='bottom' align='center'>
        <Button
          variant='ghost'
          size='icon'
          className={`${buttonSize} hover:bg-white/10 bg-gray-700/20 backdrop-blur-sm border border-gray-600/30 rounded-lg transition-all duration-200 hover:border-indigo-400/50 hover:scale-105 active:scale-95`}
          onClick={() => window.open(socialMediaLinks.discord, '_blank')}
        >
          <MessageCircle className={iconSize} />
        </Button>
      </ActionTooltip>

      {/* Instagram */}
      <ActionTooltip
        label='Follow us on Instagram'
        side='bottom'
        align='center'
      >
        <Button
          variant='ghost'
          size='icon'
          className={`${buttonSize} hover:bg-white/10 bg-gray-700/20 backdrop-blur-sm border border-gray-600/30 rounded-lg transition-all duration-200 hover:border-purple-400/50 hover:scale-105 active:scale-95`}
          onClick={() => window.open(socialMediaLinks.instagram, '_blank')}
        >
          <Instagram className={iconSize} />
        </Button>
      </ActionTooltip>
    </div>
  );
}
