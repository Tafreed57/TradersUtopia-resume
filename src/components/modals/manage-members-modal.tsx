'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/user/user-avatar';
import { ServerWithMembersWithUsers } from '@/types/server';
import { secureAxiosPatch, secureAxiosDelete } from '@/lib/csrf-client';
import {
  Check,
  Gavel,
  Loader2,
  MoreVertical,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import qs from 'query-string';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/store';

export function ManageMembersModal() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const { user } = useUser();
  const type = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const onOpen = useStore(state => state.onOpen);
  const onClose = useStore(state => state.onClose);
  const data = useStore(state => state.data) as {
    server: ServerWithMembersWithUsers;
  };
  const isModelOpen = isOpen && type === 'manageMembers';
  const roleIconMap: Record<string, React.ReactNode> = {
    free: null,
    premium: <ShieldCheck className='w-4 ml-2 h-4 text-indigo-500' />,
    // For backwards compatibility, also support these role names
    GUEST: null,
    ADMIN: <ShieldAlert className='w-4 h-4 ml-2 text-rose-500' />,
    MODERATOR: <ShieldCheck className='w-4 ml-2 h-4 text-indigo-500' />,
  };

  // Check if user is global admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setAdminCheckLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/check-status');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setAdminCheckLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const onRoleChange = async (memberId: string, role: string) => {
    try {
      setLoadingId(memberId);
      const url = qs.stringifyUrl({
        url: `/api/members/${memberId}`,
        query: {
          serverId: data.server.id,
        },
      });
      const res = await secureAxiosPatch(url, {
        role: role,
      });
      router.refresh();
      onOpen('manageMembers', { server: res.data });
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingId('');
    }
  };

  const onKick = async (memberId: string) => {
    try {
      setLoadingId(memberId);
      const url = qs.stringifyUrl({
        url: `/api/members/${memberId}`,
        query: {
          serverId: data.server.id,
        },
      });
      const res = await secureAxiosDelete(url);
      router.refresh();
      onOpen('manageMembers', { server: res.data });
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingId('');
    }
  };

  // Show loading state while checking admin status
  if (adminCheckLoading) {
    return (
      <Dialog open={isModelOpen} onOpenChange={onClose}>
        <DialogContent
          aria-describedby={undefined}
          className='bg-white text-black overflow-hidden'
        >
          <DialogHeader className='pt-8 px-6'>
            <DialogTitle className='text-2xl text-center font-bold'>
              Loading...
            </DialogTitle>
          </DialogHeader>
          <div className='px-6 py-8'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4'></div>
              <p className='text-gray-600'>Checking permissions...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show restricted message for non-admin users
  if (!isAdmin) {
    return (
      <Dialog open={isModelOpen} onOpenChange={onClose}>
        <DialogContent
          aria-describedby={undefined}
          className='bg-white text-black overflow-hidden'
        >
          <DialogHeader className='pt-8 px-6'>
            <DialogTitle className='text-2xl text-center font-bold'>
              Administrator Access Required
            </DialogTitle>
            <DialogDescription className='text-center text-sm text-zinc-500 dark:text-neutral-400 px-6 py-2'>
              Only global administrators can manage member roles
            </DialogDescription>
          </DialogHeader>
          <div className='px-6 py-8'>
            <div className='text-center'>
              <div className='flex items-center justify-center mb-4'>
                <svg
                  className='w-12 h-12 text-gray-400'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                Global Admin Required
              </h3>
              <p className='text-gray-600 mb-4'>
                Only global administrators can manage server member roles and
                permissions.
              </p>
              <p className='text-sm text-gray-500'>
                Server has {data?.server?.members?.length || 0} members
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Global admin interface - full member management
  return (
    <Dialog open={isModelOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className='bg-white text-black overflow-hidden'
      >
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            Manage Members
          </DialogTitle>
          <DialogDescription className='text-center text-sm text-zinc-500 dark:text-neutral-400 px-6 py-2'>
            {data?.server?.members?.length} members
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='mt-8 max-h-[420px] pr-6'>
          {data?.server?.members?.map(member => (
            <div key={member.id} className='flex items-center  gap-x-2 mb-6'>
              <UserAvatar src={member?.user?.imageUrl ?? undefined} />
              <div className='flex flex-col gap-y-1'>
                <div className='text-sm font-semibold  gap-x-1 flex items-center'>
                  {member.user?.name}
                  {roleIconMap[member.role?.name]}
                </div>
                <p className='text-xs text-zinc-500'>{member.user?.email}</p>
              </div>
              {data?.server?.id !== member.serverId &&
                loadingId !== member.id && (
                  <div className='ml-auto'>
                    <DropdownMenu modal={true}>
                      <DropdownMenuTrigger asChild>
                        <MoreVertical className='w-4 h-4 text-zinc-500' />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent side='left'>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className='flex items-center'>
                            <ShieldQuestion className='w-4 h-4 mr-2' />
                            <span>Role</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={() => onRoleChange(member.id, 'free')}
                              >
                                <Shield className='mr-2 h-4 w-4' />
                                Guest
                                {member.role?.name === 'free' && (
                                  <Check className='w-4 h-4 ml-auto' />
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  onRoleChange(member.id, 'premium')
                                }
                              >
                                <ShieldCheck className=' mr-2 h-4 w-4' />
                                Moderator
                                {member.role?.name === 'MODERATOR' && (
                                  <Check className='w-4 h-4 ml-auto' />
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onRoleChange(member.id, 'admin')}
                              >
                                <ShieldAlert className=' mr-2 h-4 w-4' />
                                Admin
                                {member.role?.name === 'admin' && (
                                  <Check className='w-4 h-4 ml-auto' />
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onKick(member.id)}>
                          <Gavel className='mr-2 h-4 w-4' />
                          Kick
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              {loadingId === member.id && (
                <Loader2 className='animate-spin text-zinc-500 ml-auto w-4 h-4' />
              )}
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
