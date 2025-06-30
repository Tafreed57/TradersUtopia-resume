'use client';

import { SignIn } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function Page({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  // Get the redirect URL from search params, default to homepage
  const redirectUrl = searchParams.redirect_url || '/';

  // Comprehensive Google OAuth account selection interceptor with debugging
  useEffect(() => {
    console.log('🚀 [OAUTH-DEBUG] Google OAuth interceptor starting...');

    // 1. Intercept fetch requests (most common for modern OAuth)
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      console.log('🌐 [OAUTH-DEBUG] Fetch intercepted:', url);

      if (typeof input === 'string' && input.includes('accounts.google.com')) {
        try {
          const urlObj = new URL(input);
          urlObj.searchParams.set('prompt', 'select_account');
          urlObj.searchParams.set('access_type', 'offline');
          input = urlObj.toString();
          console.log(
            '✅ Modified Google OAuth fetch URL to force account selection:',
            input
          );
        } catch (e) {
          console.warn('Failed to modify OAuth fetch URL:', e);
        }
      }
      return originalFetch.call(this, input, init);
    };

    // 2. Multiple click detection strategies
    const handleDocumentClick = (e: Event) => {
      const target = e.target as HTMLElement;
      console.log(
        '👆 [OAUTH-DEBUG] Click detected on:',
        target.tagName,
        target.className,
        target.textContent?.slice(0, 50)
      );

      // Cast a wider net for Google buttons
      const buttonElement = target.closest('button');
      const googleButton =
        target.closest('[data-provider="google"]') ||
        target.closest('.cl-socialButtonsBlockButton__google') ||
        target.closest('.cl-socialButtonsBlockButton') ||
        (buttonElement &&
        (buttonElement.textContent?.includes('Google') ||
          buttonElement.textContent?.includes('Continue with Google') ||
          buttonElement.innerHTML?.includes('google') ||
          buttonElement.className?.includes('google'))
          ? buttonElement
          : null) ||
        target.closest('[class*="google"]') ||
        target.closest('[class*="Google"]');

      if (googleButton) {
        console.log(
          '🔍 [OAUTH-DEBUG] Google OAuth button detected! Element:',
          googleButton
        );
        console.log('🔍 [OAUTH-DEBUG] Button details:', {
          tagName: googleButton.tagName,
          className: googleButton.className,
          textContent: googleButton.textContent,
          innerHTML: googleButton.innerHTML?.slice(0, 200),
        });

        // Start aggressive URL monitoring
        let monitorCount = 0;
        const urlMonitor = setInterval(() => {
          monitorCount++;
          const currentUrl = window.location.href;
          console.log(
            `🔎 [OAUTH-DEBUG] Monitor check #${monitorCount}:`,
            currentUrl
          );

          if (currentUrl.includes('accounts.google.com')) {
            console.log('🎯 [OAUTH-DEBUG] Found Google OAuth URL!', currentUrl);
            try {
              const url = new URL(currentUrl);
              if (!url.searchParams.has('prompt')) {
                url.searchParams.set('prompt', 'select_account');
                url.searchParams.set('access_type', 'offline');
                console.log(
                  '✅ [OAUTH-DEBUG] Redirecting with account selection:',
                  url.toString()
                );
                window.location.replace(url.toString());
              } else {
                console.log(
                  '✅ [OAUTH-DEBUG] URL already has prompt parameter'
                );
              }
            } catch (e) {
              console.warn(
                '❌ [OAUTH-DEBUG] Failed to modify current OAuth URL:',
                e
              );
            }
            clearInterval(urlMonitor);
          }
        }, 50); // Check every 50ms for faster detection

        // Stop monitoring after 10 seconds
        setTimeout(() => {
          clearInterval(urlMonitor);
          console.log(
            '⏰ [OAUTH-DEBUG] URL monitoring stopped after 10 seconds'
          );
        }, 10000);
      }
    };

    // Additional click detection for specific Google button
    const handleGoogleButtonClick = (e: Event) => {
      console.log(
        '🎯 [OAUTH-DEBUG] Direct Google button click detected!',
        e.target
      );
      handleDocumentClick(e);
    };

    // 3. Override window.open (for popup flows)
    const originalOpen = window.open;
    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string
    ) {
      if (
        typeof url === 'string' &&
        url.includes('accounts.google.com/oauth')
      ) {
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.set('prompt', 'select_account');
          urlObj.searchParams.set('access_type', 'offline');
          url = urlObj.toString();
          console.log(
            '✅ Modified Google OAuth popup URL to force account selection'
          );
        } catch (e) {
          console.warn('Failed to modify OAuth popup URL:', e);
        }
      }
      return originalOpen.call(this, url, target, features);
    };

    // 4. Monitor for href changes using MutationObserver
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check for any new links that might be Google OAuth
          const addedNodes = Array.from(mutation.addedNodes);
          addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              const links = element.querySelectorAll
                ? element.querySelectorAll('a[href*="accounts.google.com"]')
                : [];
              links.forEach((link: Element) => {
                const anchor = link as HTMLAnchorElement;
                if (
                  anchor.href &&
                  anchor.href.includes('accounts.google.com/oauth')
                ) {
                  try {
                    const url = new URL(anchor.href);
                    url.searchParams.set('prompt', 'select_account');
                    url.searchParams.set('access_type', 'offline');
                    anchor.href = url.toString();
                    console.log(
                      '✅ Modified Google OAuth link to force account selection'
                    );
                  } catch (e) {
                    console.warn('Failed to modify OAuth link:', e);
                  }
                }
              });
            }
          });
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 5. Enhanced debugging and existing link checking
    const debugPageElements = () => {
      console.log(
        '🔍 [OAUTH-DEBUG] Scanning page for Google-related elements...'
      );

      // Check for various button selectors
      const selectors = [
        'button',
        '[data-provider="google"]',
        '.cl-socialButtonsBlockButton',
        '[class*="google"]',
        '[class*="Google"]',
        'a[href*="google"]',
        'a[href*="accounts.google.com"]',
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(
            `📍 [OAUTH-DEBUG] Found ${elements.length} elements with selector "${selector}":`,
            elements
          );
          elements.forEach((el, index) => {
            console.log(
              `  ${index + 1}. ${el.tagName} - Class: "${el.className}" - Text: "${el.textContent?.slice(0, 50)}" - HTML: "${el.innerHTML?.slice(0, 100)}"`
            );
          });
        }
      });

      // Check for OAuth links
      const existingLinks = document.querySelectorAll(
        'a[href*="accounts.google.com"], a[href*="oauth"], a[href*="google"]'
      );
      console.log(
        '🔗 [OAUTH-DEBUG] Found OAuth/Google links:',
        existingLinks.length
      );

      existingLinks.forEach((link: Element, index) => {
        const anchor = link as HTMLAnchorElement;
        console.log(`  Link ${index + 1}: ${anchor.href}`);

        if (anchor.href && anchor.href.includes('accounts.google.com/oauth')) {
          try {
            const url = new URL(anchor.href);
            if (!url.searchParams.has('prompt')) {
              url.searchParams.set('prompt', 'select_account');
              url.searchParams.set('access_type', 'offline');
              anchor.href = url.toString();
              console.log(
                '✅ [OAUTH-DEBUG] Modified existing Google OAuth link to force account selection'
              );
            }
          } catch (e) {
            console.warn(
              '❌ [OAUTH-DEBUG] Failed to modify existing OAuth link:',
              e
            );
          }
        }
      });
    };

    // Debug immediately and after delays for dynamic content
    debugPageElements();
    setTimeout(debugPageElements, 1000);
    setTimeout(debugPageElements, 3000);
    setTimeout(debugPageElements, 5000);

    // Add multiple click listeners for maximum coverage
    document.addEventListener('click', handleDocumentClick, true); // Capture phase
    document.addEventListener('click', handleDocumentClick, false); // Bubble phase

    // Direct button event listeners
    const addDirectListeners = () => {
      const googleButtons = document.querySelectorAll(
        '.cl-socialButtonsBlockButton__google, .cl-socialButtonsBlockButton'
      );
      console.log(
        `🎯 [OAUTH-DEBUG] Adding direct listeners to ${googleButtons.length} Google buttons`
      );

      googleButtons.forEach((button, index) => {
        console.log(
          `  Button ${index + 1}:`,
          button.className,
          button.textContent
        );
        button.addEventListener('click', handleGoogleButtonClick, true);
        button.addEventListener('click', handleGoogleButtonClick, false);
        button.addEventListener('mousedown', handleGoogleButtonClick, true);
        button.addEventListener('mouseup', handleGoogleButtonClick, true);
      });
    };

    // Add listeners immediately and after delays
    addDirectListeners();
    setTimeout(addDirectListeners, 1000);
    setTimeout(addDirectListeners, 3000);

    return () => {
      // Restore all original functions and cleanup
      window.fetch = originalFetch;
      window.open = originalOpen;
      observer.disconnect();
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('click', handleDocumentClick, false);

      // Remove direct button listeners
      const googleButtons = document.querySelectorAll(
        '.cl-socialButtonsBlockButton__google, .cl-socialButtonsBlockButton'
      );
      googleButtons.forEach(button => {
        button.removeEventListener('click', handleGoogleButtonClick, true);
        button.removeEventListener('click', handleGoogleButtonClick, false);
        button.removeEventListener('mousedown', handleGoogleButtonClick, true);
        button.removeEventListener('mouseup', handleGoogleButtonClick, true);
      });
    };
  }, []);

  return (
    <div className='w-full'>
      <SignIn
        fallbackRedirectUrl={redirectUrl}
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'w-full max-w-md mx-auto shadow-2xl border-gray-700 bg-gray-800/90 backdrop-blur-sm',
            headerTitle: 'text-white text-xl sm:text-2xl font-bold',
            headerSubtitle: 'text-gray-300 text-sm sm:text-base',
            socialButtonsBlockButton:
              'bg-white border-gray-200 hover:bg-transparent hover:border-black text-gray-600 hover:text-black min-h-[44px] touch-manipulation',
            socialButtonsBlockButtonText: 'font-semibold text-sm sm:text-base',
            formFieldInput:
              'bg-gray-700 border-gray-600 text-white min-h-[44px] touch-manipulation',
            formButtonPrimary:
              'bg-yellow-500 hover:bg-yellow-600 text-black font-semibold min-h-[44px] touch-manipulation',
            footerActionText: 'text-gray-300 text-sm',
            footerActionLink: 'text-yellow-400 hover:text-yellow-300',
            dividerText: 'text-gray-400 text-sm',
            otpCodeFieldInput:
              'bg-gray-700 border-gray-600 text-white min-h-[44px] touch-manipulation',
          },
        }}
      />
    </div>
  );
}
