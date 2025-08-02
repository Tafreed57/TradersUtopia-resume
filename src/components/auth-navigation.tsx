'use client';

import Link from 'next/link';

interface AuthNavigationProps {
  mode: 'signin' | 'signup';
  redirectUrl?: string;
}

export default function AuthNavigation({
  mode,
  redirectUrl,
}: AuthNavigationProps) {
  const href =
    mode === 'signin'
      ? `/sign-up${
          redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ''
        }`
      : `/sign-in${
          redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ''
        }`;

  const text =
    mode === 'signin' ? "Don't have an account?" : 'Already have an account?';

  const linkText = mode === 'signin' ? 'Sign up' : 'Sign in';

  return (
    <div className='mt-6 pt-6 border-t border-gray-700/50'>
      <div className='text-center'>
        <span className='text-gray-400 text-sm'>{text} </span>
        <Link
          href={href}
          className='text-yellow-400 hover:text-yellow-300 font-medium transition-colors duration-200'
        >
          {linkText}
        </Link>
      </div>
    </div>
  );
}
