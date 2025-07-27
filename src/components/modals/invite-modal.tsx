'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrigin } from '@/hooks/use-origin';
import { useStore } from '@/store/store';
import { secureAxiosPatch } from '@/lib/csrf-client';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from './base';

export function InviteModal() {
  const onOpen = useStore(state => state.onOpen);
  const data = useStore(state => state.data);
  const origin = useOrigin();

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inviteUrl = `${origin}/invite/${data?.server?.inviteCode}`;

  const onCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  const onGenerate = async () => {
    try {
      setIsLoading(true);
      const res = await secureAxiosPatch(
        `/api/servers/${data?.server?.id}/invite-code`
      );
      onOpen('invite', { server: res.data });
    } catch (error) {
      //
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseModal type='invite' title='Invite Friends' loading={isLoading}>
      <div className='space-y-4'>
        <Label className='uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70'>
          Server invite link
        </Label>
        <div className='flex items-center gap-x-2'>
          <Input
            aria-readonly
            readOnly
            disabled={isLoading}
            className='bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0'
            value={inviteUrl}
          />
          <Button disabled={isLoading} onClick={onCopy} size='icon'>
            {copied ? (
              <Check className='w-4 h-4' />
            ) : (
              <Copy className='w-4 h-4' />
            )}
          </Button>
        </div>
        <Button
          onClick={onGenerate}
          disabled={isLoading}
          variant='link'
          size='sm'
          className='text-sm text-zinc-500'
        >
          Generate a new link
          <RefreshCw className='w-4 h-4 ml-2' />
        </Button>
      </div>
    </BaseModal>
  );
}
