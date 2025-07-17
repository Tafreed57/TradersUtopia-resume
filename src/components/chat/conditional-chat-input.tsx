'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { ChatInput } from '@/components/chat/chat-input';
import { Member } from '@prisma/client';

interface ConditionalChatInputProps {
  name: string;
  type: 'channel';
  apiUrl: string;
  query: Record<string, any>;
  member: Member;
}

export function ConditionalChatInput({
  name,
  type,
  apiUrl,
  query,
  member,
}: ConditionalChatInputProps) {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

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

  // Don't render anything while checking admin status
  if (adminCheckLoading) {
    return null;
  }

  // Don't render anything for non-admin users
  if (!isAdmin) {
    return null;
  }

  // Only render the styled wrapper and input for admin users
  return (
    <div className='relative z-10 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-t border-gray-700/30 overflow-visible'>
      <ChatInput
        name={name}
        type={type}
        apiUrl={apiUrl}
        query={query}
        member={member}
      />
    </div>
  );
}
