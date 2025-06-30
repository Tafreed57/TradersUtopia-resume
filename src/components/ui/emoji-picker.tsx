'use client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onChange: (value: string) => void;
}

export function EmojiPicker({ onChange }: EmojiPickerProps) {
  return (
    <Popover>
      <PopoverTrigger>
        <Smile className='text-zinc-500 hover:text-zinc-600 transition'
          size={20}
        />
      </PopoverTrigger>
      <PopoverContent
        side='right'
        sideOffset={40} className='bg-transparent border-none shadow-none drop-shadow-none mb-16'
      >
        <Picker
          theme='light'
          data={data}
          onEmojiSelect={(emoji: any) => onChange(emoji.native)}
        />
      </PopoverContent>
    </Popover>
  );
}
