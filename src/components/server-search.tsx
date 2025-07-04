'use client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

interface ServerSearchProps {
  data: {
    label: string;
    type: 'channel' | 'member' | 'section';
    data:
      | {
          icon: ReactNode;
          name: string;
          id: string;
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
    type: 'channel' | 'member' | 'section';
  }) => {
    setOpen(false);

    if (type === 'member') {
      // Members no longer have conversation pages - just close search
      return;
    }

    if (type === 'channel') {
      return router.push(`/servers/${params?.serverId}/channels/${id}`);
    }

    if (type === 'section') {
      // For sections, we can navigate to the first channel in the section
      // or just close the search and let the user expand the section
      setOpen(false);
      return;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='group px-3 py-2 rounded-lg flex items-center gap-x-2 w-full bg-gradient-to-r from-gray-800/50 to-gray-700/50 hover:from-gray-700/60 hover:to-gray-600/60 transition-all duration-200 border border-gray-600/30 backdrop-blur-sm'
      >
        <Search className='w-4 h-4 text-gray-400 group-hover:text-gray-200 transition-colors' />
        <p className='font-medium text-sm text-gray-300 group-hover:text-gray-100 transition-colors'>
          Search
        </p>
        <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600/50 bg-gray-800/60 px-1.5 font-mono text-[10px] font-medium text-gray-400 ml-auto'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder='Search all channels and sections' />
        <CommandList>
          <CommandEmpty>No Results found</CommandEmpty>
          {data.map(({ label, type, data }) => {
            if (!data?.length) return null;

            return (
              <CommandGroup key={label} heading={label}>
                {data?.map(({ id, icon, name }) => {
                  return (
                    <CommandItem
                      key={id}
                      onSelect={() => onClick({ id, type })}
                      className='cursor-pointer'
                    >
                      {icon}
                      <span>{name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
