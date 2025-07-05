'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { useStore } from '@/store/store';
import { Plus, Lock } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function SideBarActions() {
  const onOpen = useStore.use.onOpen();
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // Check if user has admin permissions
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/admin/check-status', {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingPermissions(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const handleServerCreation = () => {
    onOpen('createServer');
  };

  // Show loading state while checking permissions
  if (checkingPermissions) {
    return (
      <ActionTooltip align='center' side='right' label='Loading...'>
        <button
          disabled
          className='group flex items-center justify-center cursor-not-allowed touch-manipulation p-3'
        >
          <div className='flex items-center justify-center h-[56px] w-[56px] rounded-[28px] transition-all duration-300 bg-gradient-to-br from-gray-700/50 to-gray-600/50 border border-gray-600/30 backdrop-blur-sm opacity-50 shadow-lg'>
            <Plus size={28} className='text-gray-400' />
          </div>
        </button>
      </ActionTooltip>
    );
  }

  // ✅ UPDATED: Only show the button if user is admin
  if (!isAdmin) {
    return null;
  }

  return (
    <ActionTooltip align='center' side='right' label='Add a server'>
      <button
        onClick={handleServerCreation}
        className='group flex items-center justify-center touch-manipulation p-3'
      >
        <div className='flex items-center justify-center h-[56px] w-[56px] rounded-[28px] group-hover:rounded-[20px] transition-all duration-300 shadow-lg border-2 border-transparent bg-gradient-to-br from-emerald-600/30 to-green-600/30 group-hover:from-emerald-500/50 group-hover:to-green-500/50 group-hover:border-emerald-400/50 group-hover:shadow-2xl group-hover:shadow-emerald-400/20 group-hover:scale-110 backdrop-blur-sm'>
          <Plus
            size={28}
            className='group-hover:text-white transition-all duration-300 text-emerald-400 group-hover:scale-110'
          />
        </div>
      </button>
    </ActionTooltip>
  );
}
