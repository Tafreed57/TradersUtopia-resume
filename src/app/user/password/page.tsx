import { PasswordManager } from '@/components/user/password-manager';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function PasswordPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className='min-h-screen pwa-layout safe-min-height bg-gray-50 dark:bg-gray-900'>
      <div className='pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right'>
        <div className='max-w-4xl mx-auto px-4 py-8'>
          <PasswordManager />
        </div>
      </div>
    </div>
  );
}
