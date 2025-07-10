'use client';

import { useState, useEffect } from 'react';
import { SharedNavbar } from '@/components/shared-navbar';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Scale,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function TermsOfServicePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      const scrollPosition = window.scrollY + 100;

      sections.forEach(section => {
        const sectionTop = (section as HTMLElement).offsetTop;
        const sectionHeight = (section as HTMLElement).offsetHeight;
        const sectionId = section.getAttribute('id');

        if (
          scrollPosition >= sectionTop &&
          scrollPosition < sectionTop + sectionHeight
        ) {
          setActiveSection(sectionId || '');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const tableOfContents = [
    { id: 'platform-use', title: 'Use of Platform', icon: Shield },
    { id: 'educational-purpose', title: 'Educational Purpose', icon: FileText },
    {
      id: 'membership',
      title: 'Membership & Subscriptions',
      icon: CheckCircle,
    },
    {
      id: 'earnings-disclaimer',
      title: 'Earnings Disclaimer',
      icon: AlertTriangle,
    },
    { id: 'risk-disclosure', title: 'Risk Disclosure', icon: XCircle },
    { id: 'account-sharing', title: 'Account Sharing', icon: Shield },
    { id: 'affiliate-program', title: 'Affiliate Program', icon: Scale },
    { id: 'contact', title: 'Contact Information', icon: Mail },
  ];

  if (!isMounted) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black'>
        <SharedNavbar />
        <div className='animate-pulse p-8'>
          <div className='max-w-4xl mx-auto space-y-4'>
            <div className='h-12 bg-gray-700 rounded'></div>
            <div className='h-4 bg-gray-700 rounded w-3/4'></div>
            <div className='space-y-2'>
              {[...Array(10)].map((_, i) => (
                <div key={i} className='h-4 bg-gray-700 rounded'></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white'>
      <SharedNavbar />

      {/* Hero Section */}
      <section className='relative pt-20 pb-16 overflow-hidden pwa-safe-top pt-24 md:pt-20'>
        <div className='absolute inset-0 bg-gradient-to-br from-red-900/20 via-gray-900/40 to-black/80'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6'>
          <div className='flex items-center gap-4 mb-8'>
            <Link
              href='/'
              className='text-gray-400 hover:text-white transition-colors'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='flex items-center gap-2'>
              <Scale className='w-6 h-6 text-red-400' />
              <span className='text-gray-400'>Legal Document</span>
            </div>
          </div>

          <div className='text-center'>
            <h1 className='text-3xl sm:text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent'>
              Terms of Service
            </h1>
            <p className='text-lg sm:text-xl text-gray-300 mb-8 max-w-3xl mx-auto'>
              These terms govern your use of Trader's Utopia platform. Please
              read carefully and completely.
            </p>
            <div className='flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400 flex-wrap'>
              <div className='flex items-center gap-2'>
                <Clock className='w-4 h-4' />
                <span>Effective Date: January 6, 2024</span>
              </div>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4 text-yellow-400' />
                <span>Legally Binding</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 pb-20'>
        <div className='grid lg:grid-cols-4 gap-8'>
          {/* Table of Contents - Sidebar */}
          <div className='lg:col-span-1'>
            <div className='sticky top-24 bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-4 sm:p-6 border border-gray-700/50 backdrop-blur-sm pwa-safe-top'>
              <h3 className='text-lg font-semibold mb-4 text-yellow-400'>
                Table of Contents
              </h3>
              <nav className='space-y-2'>
                {tableOfContents.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all duration-200 text-left ${
                        activeSection === item.id
                          ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className='w-4 h-4 flex-shrink-0' />
                      <span className='truncate'>{item.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className='lg:col-span-3 space-y-12'>
            {/* Introduction */}
            <section className='bg-gradient-to-br from-red-900/20 via-gray-800/40 to-gray-900/40 rounded-2xl p-6 sm:p-8 border border-red-400/30 backdrop-blur-sm'>
              <div className='flex items-center gap-3 mb-6'>
                <AlertTriangle className='w-8 h-8 text-red-400' />
                <h2 className='text-2xl font-bold text-red-300'>
                  Important Notice
                </h2>
              </div>
              <p className='text-gray-300 text-lg leading-relaxed'>
                Welcome to Trader's Utopia! By accessing or using our website
                and services (the "Platform"), you agree to comply with and be
                bound by the following Terms and Conditions ("Terms").
              </p>
            </section>

            {/* Section 1: Use of Platform */}
            <section
              id='platform-use'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Shield className='w-8 h-8 text-blue-400' />
                <h2 className='text-2xl font-bold'>1. Use of the Platform</h2>
              </div>
              <p className='text-gray-300 leading-relaxed'>
                You must be at least 18 years old to register or use our
                services. All information you provide must be accurate and up to
                date. You agree to use the Platform only for lawful purposes.
              </p>
            </section>

            {/* Section 2: Educational Purpose */}
            <section
              id='educational-purpose'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <FileText className='w-8 h-8 text-green-400' />
                <h2 className='text-2xl font-bold'>
                  2. Educational Purpose Only
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed'>
                Trader's Utopia offers educational content and tools only. We do
                not provide financial, investment, or trading advice of any
                kind. Any decisions you make based on our content are entirely
                your own and at your own risk. Trader's Utopia is not
                responsible for any financial gains or losses you may
                experience.
              </p>
            </section>

            {/* Section 3: Membership */}
            <section
              id='membership'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <CheckCircle className='w-8 h-8 text-purple-400' />
                <h2 className='text-2xl font-bold'>
                  3. Membership and Subscriptions
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                By registering, you agree to pay all fees associated with your
                chosen subscription plan.
              </p>

              <div className='space-y-6'>
                <div className='bg-red-900/20 rounded-xl p-6 border border-red-400/30'>
                  <h3 className='text-lg font-semibold text-red-300 mb-3'>
                    3.2 No Refund Policy
                  </h3>
                  <p className='text-gray-300 mb-4'>
                    <strong>
                      All subscription fees are non-refundable under any
                      circumstances.
                    </strong>{' '}
                    This includes, but is not limited to, cases where:
                  </p>
                  <ul className='space-y-2 text-gray-300'>
                    <li className='flex items-start gap-2'>
                      <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                      <span>You forget to cancel</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                      <span>You do not use or access the service</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                      <span>You change your mind</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                      <span>You experience personal or financial issues</span>
                    </li>
                  </ul>
                  <p className='text-gray-300 mt-4'>
                    Refunds may be considered only in the event of billing
                    errors.
                  </p>
                </div>

                <div className='bg-yellow-900/20 rounded-xl p-6 border border-yellow-400/30'>
                  <h3 className='text-lg font-semibold text-yellow-300 mb-3'>
                    3.4 Chargebacks & Payment Disputes
                  </h3>
                  <p className='text-gray-300'>
                    By subscribing to Trader's Utopia, you agree not to initiate
                    chargebacks or payment disputes with your financial
                    institution. All sales are final. Any unauthorized
                    chargebacks will be treated as potential fraud, and we
                    reserve the right to pursue legal action and ban the
                    associated user accounts permanently.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Earnings Disclaimer */}
            <section
              id='earnings-disclaimer'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <AlertTriangle className='w-8 h-8 text-orange-400' />
                <h2 className='text-2xl font-bold'>4. Earnings Disclaimer</h2>
              </div>
              <p className='text-gray-300 leading-relaxed'>
                Trader's Utopia makes no representations or guarantees regarding
                earnings, profits, or income. Any examples of trading success
                shown on our Platform or social media are exceptional results
                and not typical. Your success depends on your own decisions,
                skills, market conditions, and risk tolerance. You may lose
                money. By using our services, you accept full responsibility for
                your trading and financial outcomes.
              </p>
            </section>

            {/* Section 5: Risk Disclosure */}
            <section
              id='risk-disclosure'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <XCircle className='w-8 h-8 text-red-400' />
                <h2 className='text-2xl font-bold'>5. Risk Disclosure</h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                Trading and investing involve substantial risk and are not
                suitable for all investors. Past performance does not guarantee
                future results. You must carefully consider your investment
                objectives, level of experience, and risk tolerance before
                investing.
              </p>

              <div className='space-y-4'>
                <div className='bg-red-900/20 rounded-xl p-4 border border-red-400/30'>
                  <h3 className='text-lg font-semibold text-red-300 mb-2'>
                    5.1 Canada Government Required Disclaimer
                  </h3>
                  <p className='text-gray-300'>
                    Futures and options trading involve substantial risk of loss
                    and are not suitable for all investors.
                  </p>
                </div>

                <div className='bg-red-900/20 rounded-xl p-4 border border-red-400/30'>
                  <h3 className='text-lg font-semibold text-red-300 mb-2'>
                    5.2 SEC Statement on Day Trading
                  </h3>
                  <p className='text-gray-300'>
                    Day trading is a risky activity and not suitable for most
                    investors. Be prepared for severe financial losses. Day
                    trading is not investing, and claims of easy profits are
                    often false. Educational materials may not be objective.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8: Account Sharing */}
            <section
              id='account-sharing'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Shield className='w-8 h-8 text-red-400' />
                <h2 className='text-2xl font-bold'>
                  8. Account Sharing & Fair Use
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                Access to Trader's Utopia is for individual use only. Sharing
                your account login, redistributing materials, or reselling
                content — including trade alerts and market analysis — is
                strictly prohibited.
              </p>

              <div className='bg-red-900/20 rounded-xl p-6 border border-red-400/30'>
                <h3 className='text-lg font-semibold text-red-300 mb-3'>
                  Violations may result in:
                </h3>
                <ul className='space-y-2 text-gray-300'>
                  <li className='flex items-start gap-2'>
                    <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                    <span>Immediate termination without refund</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                    <span>Permanent banning from the Platform</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <XCircle className='w-4 h-4 text-red-400 mt-1 flex-shrink-0' />
                    <span>Legal action for damages</span>
                  </li>
                </ul>
                <p className='text-gray-300 mt-4'>
                  We actively monitor for unauthorized sharing. Screenshots,
                  screen recordings, or leaks are treated as theft.
                </p>
              </div>
            </section>

            {/* Section 13: Affiliate Program */}
            <section
              id='affiliate-program'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Scale className='w-8 h-8 text-purple-400' />
                <h2 className='text-2xl font-bold'>
                  13. Affiliate Program & Referral Agreements
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                Trader's Utopia may offer individuals or partners the
                opportunity to earn commissions or compensation through
                referrals or affiliate promotions. Participation in our
                affiliate or referral program is not automatic, and all terms
                are governed solely at our discretion.
              </p>

              <div className='space-y-4'>
                <div className='bg-purple-900/20 rounded-xl p-4 border border-purple-400/30'>
                  <h3 className='text-lg font-semibold text-purple-300 mb-2'>
                    13.1 No Permanent Entitlement
                  </h3>
                  <p className='text-gray-300'>
                    Affiliates acknowledge that any participation is a revocable
                    privilege, not a right. Trader's Utopia may modify, suspend,
                    or terminate any affiliate's access, commission rate, or
                    participation at any time and for any reason, with or
                    without notice.
                  </p>
                </div>

                <div className='bg-purple-900/20 rounded-xl p-4 border border-purple-400/30'>
                  <h3 className='text-lg font-semibold text-purple-300 mb-2'>
                    13.5 Legal Protections
                  </h3>
                  <p className='text-gray-300'>
                    By participating in the affiliate program, you waive all
                    rights to pursue damages, loss of future income, or business
                    interruption claims if your affiliate access is terminated.
                    Any attempt to damage the business, reputation, or
                    operations of Trader's Utopia will be treated as malicious
                    interference and may result in civil legal action.
                  </p>
                </div>
              </div>
            </section>

            {/* Additional Key Sections */}
            <section className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'>
              <h2 className='text-2xl font-bold mb-6'>
                Additional Important Terms
              </h2>

              <div className='space-y-6'>
                <div>
                  <h3 className='text-lg font-semibold text-yellow-300 mb-3'>
                    16. Dispute Resolution — No Court or Class Action
                  </h3>
                  <p className='text-gray-300'>
                    All disputes must be resolved through binding arbitration.
                    You waive all rights to sue in court or join any
                    class-action lawsuit. Arbitration is governed by Ontario
                    law.
                  </p>
                </div>

                <Separator className='bg-gray-700/50' />

                <div>
                  <h3 className='text-lg font-semibold text-yellow-300 mb-3'>
                    17. Right to Deny Access
                  </h3>
                  <p className='text-gray-300'>
                    We may suspend or terminate access at our discretion, with
                    or without cause. No refunds will be issued if access is
                    terminated for cause.
                  </p>
                </div>

                <Separator className='bg-gray-700/50' />

                <div>
                  <h3 className='text-lg font-semibold text-yellow-300 mb-3'>
                    19. Social Media Disclosure
                  </h3>
                  <p className='text-gray-300'>
                    Trader's Utopia and its representatives are not licensed
                    investment advisors. Any content shared on social media is
                    for entertainment and educational purposes only.
                  </p>
                </div>
              </div>
            </section>

            {/* Contact Section */}
            <section
              id='contact'
              className='bg-gradient-to-br from-blue-900/20 via-gray-800/40 to-gray-900/40 rounded-2xl p-8 border border-blue-400/30 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Mail className='w-8 h-8 text-blue-400' />
                <h2 className='text-2xl font-bold'>25. Contact Us</h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                For questions or concerns regarding these Terms of Service,
                please contact us at:
              </p>
              <div className='flex items-center gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-400/30'>
                <Mail className='w-5 h-5 text-blue-400' />
                <a
                  href='mailto:info@tradersutopia.com'
                  className='text-blue-300 hover:text-blue-200 transition-colors'
                >
                  info@tradersutopia.com
                </a>
              </div>
            </section>

            {/* Footer Actions */}
            <div className='text-center py-12'>
              <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'>
                <h3 className='text-2xl font-bold mb-4'>
                  Ready to Get Started?
                </h3>
                <p className='text-gray-300 mb-6'>
                  By using our platform, you agree to these terms and
                  conditions.
                </p>
                <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                  <Link href='/'>
                    <Button
                      variant='outline'
                      className='bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white'
                    >
                      <ArrowLeft className='w-4 h-4 mr-2' />
                      Back to Home
                    </Button>
                  </Link>
                  <Link href='/pricing'>
                    <Button className='bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'>
                      View Pricing
                      <ChevronRight className='w-4 h-4 ml-2' />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
