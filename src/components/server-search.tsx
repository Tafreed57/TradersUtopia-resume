'use client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Search, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface ServerSearchProps {
  data: {
    label: string;
    type: 'channel' | 'member';
    data:
      | {
          icon: React.ReactNode;
          id: string;
          name: string;
        }[]
      | undefined;
  }[];
}

export function ServerSearch({ data }: ServerSearchProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const onClick = ({
    id,
    type,
  }: {
    id: string;
    type: 'channel' | 'member';
  }) => {
    setOpen(false);
    if (type === 'channel') {
      router.push(`/servers/${params?.serverId}/channels/${id}`);
    } else if (type === 'member') {
      router.push(`/servers/${params?.serverId}/conversations/${id}`);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='group px-3 py-2.5 rounded-xl flex items-center gap-x-3 w-full transition-all duration-300 bg-gradient-to-r from-gray-800/40 to-gray-700/40 border border-gray-600/30 backdrop-blur-sm hover:from-blue-600/20 hover:to-purple-600/20 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-400/10'
      >
        <div className='flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 group-hover:scale-110 transition-transform duration-300'>
          <Search className='w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300' />
        </div>
        <p className='font-medium text-sm text-gray-300 group-hover:text-white transition-colors duration-300 flex-1 text-left'>
          Search
        </p>
        <kbd className='pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-lg border border-gray-600/50 bg-gray-700/50 px-2 font-mono text-[10px] font-medium text-gray-400 group-hover:text-gray-300 group-hover:border-blue-400/50 transition-all duration-300 backdrop-blur-sm'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder='Search for channels or members' />
        <CommandList>
          <CommandEmpty>No results found</CommandEmpty>
          {data.map(({ label, type, data }) => {
            if (!data?.length) return null;
            return (
              <CommandGroup key={label} heading={label}>
                {data.map(({ icon, id, name }) => (
                  <CommandItem
                    className='cursor-pointer'
                    onSelect={() => onClick({ id, type })}
                    key={id}
                  >
                    {icon}
                    <span>{name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
