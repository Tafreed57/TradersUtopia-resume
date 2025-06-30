import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Button } from './ui/button';
import Link from 'next/link';

export function AuthHeader() {
  return (
    <div className='flex items-center gap-3 h-full'>
      <SignedOut>
        <Link href='/sign-in'>
          <Button
            variant='outline'
            className='h-10 bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200'
          >
            Sign In
          </Button>
        </Link>
        <Link href='/sign-up'>
          <Button className='h-10 bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200'>
            Register
          </Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <div className='flex items-center gap-2 h-full'>
          <span className='text-white/80 text-sm'>Welcome back!</span>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-10 h-10',
              },
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
}
