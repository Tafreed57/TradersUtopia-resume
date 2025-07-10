'use client';

import { useState, useEffect } from 'react';
import { SharedNavbar } from '@/components/shared-navbar';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Eye,
  Lock,
  UserCheck,
  Settings,
  Users,
  Clock,
  Mail,
  ChevronRight,
  ArrowLeft,
  Database,
  AlertTriangle,
  Globe,
  Phone,
  Instagram,
} from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function PrivacyPolicyPage() {
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
    {
      id: 'information-collect',
      title: 'Information We Collect',
      icon: Database,
    },
    { id: 'how-we-use', title: 'How We Use Information', icon: Settings },
    {
      id: 'how-we-disclose',
      title: 'How We Disclose Information',
      icon: Users,
    },
    { id: 'your-rights', title: 'Your Rights', icon: UserCheck },
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
        <div className='absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-900/40 to-black/80'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6'>
          <div className='flex items-center gap-4 mb-8'>
            <Link
              href='/'
              className='text-gray-400 hover:text-white transition-colors'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='flex items-center gap-2'>
              <Shield className='w-6 h-6 text-blue-400' />
              <span className='text-gray-400'>Privacy Document</span>
            </div>
          </div>

          <div className='text-center'>
            <h1 className='text-3xl sm:text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent'>
              Privacy Policy
            </h1>
            <p className='text-lg sm:text-xl text-gray-300 mb-8 max-w-3xl mx-auto'>
              We are committed to protecting your privacy and handling your data
              responsibly and transparently.
            </p>
            <div className='flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400 flex-wrap'>
              <div className='flex items-center gap-2'>
                <Clock className='w-4 h-4' />
                <span>Last Updated: March 26, 2024</span>
              </div>
              <div className='flex items-center gap-2'>
                <Lock className='w-4 h-4 text-blue-400' />
                <span>Your Privacy Protected</span>
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
              <h3 className='text-lg font-semibold mb-4 text-blue-400'>
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
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
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
            <section className='bg-gradient-to-br from-blue-900/20 via-gray-800/40 to-gray-900/40 rounded-2xl p-6 sm:p-8 border border-blue-400/30 backdrop-blur-sm'>
              <div className='flex items-center gap-3 mb-6'>
                <Shield className='w-8 h-8 text-blue-400' />
                <h2 className='text-2xl font-bold text-blue-300'>
                  Privacy Protection
                </h2>
              </div>
              <p className='text-gray-300 text-lg leading-relaxed'>
                This Privacy Policy describes how Traders Utopia ("we", "us", or
                "our") collects, uses, and discloses your information when you
                visit our website (the "Site") or use our services (the
                "Services").
              </p>
            </section>

            {/* Section 1: Information We Collect */}
            <section
              id='information-collect'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Database className='w-8 h-8 text-green-400' />
                <h2 className='text-2xl font-bold'>Information We Collect</h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                We collect various information about you, including:
              </p>

              <div className='grid md:grid-cols-2 gap-4 mb-6'>
                <div className='bg-green-900/20 rounded-xl p-4 border border-green-400/30'>
                  <h3 className='text-lg font-semibold text-green-300 mb-3'>
                    Personal Information
                  </h3>
                  <ul className='space-y-2 text-gray-300 text-sm'>
                    <li className='flex items-start gap-2'>
                      <UserCheck className='w-4 h-4 text-green-400 mt-1 flex-shrink-0' />
                      <span>
                        Contact details (name, address, phone number, email)
                      </span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <Lock className='w-4 h-4 text-green-400 mt-1 flex-shrink-0' />
                      <span>Account credentials (username, password)</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <Settings className='w-4 h-4 text-green-400 mt-1 flex-shrink-0' />
                      <span>Shopping preferences</span>
                    </li>
                  </ul>
                </div>

                <div className='bg-blue-900/20 rounded-xl p-4 border border-blue-400/30'>
                  <h3 className='text-lg font-semibold text-blue-300 mb-3'>
                    Transaction Data
                  </h3>
                  <ul className='space-y-2 text-gray-300 text-sm'>
                    <li className='flex items-start gap-2'>
                      <Database className='w-4 h-4 text-blue-400 mt-1 flex-shrink-0' />
                      <span>
                        Order information (billing/shipping address, payment
                        details)
                      </span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <Mail className='w-4 h-4 text-blue-400 mt-1 flex-shrink-0' />
                      <span>Customer support inquiries</span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <Eye className='w-4 h-4 text-blue-400 mt-1 flex-shrink-0' />
                      <span>
                        Usage data through cookies and similar technologies
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className='bg-yellow-900/20 rounded-xl p-4 border border-yellow-400/30'>
                <p className='text-gray-300 text-sm'>
                  <AlertTriangle className='w-4 h-4 text-yellow-400 inline mr-2' />
                  We also collect usage data through cookies and similar
                  technologies to understand how you interact with the Services.
                </p>
              </div>
            </section>

            {/* Section 2: How We Use Your Information */}
            <section
              id='how-we-use'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Settings className='w-8 h-8 text-purple-400' />
                <h2 className='text-2xl font-bold'>
                  How We Use Your Information
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                We use your information to:
              </p>

              <div className='grid md:grid-cols-2 gap-4'>
                <div className='space-y-3'>
                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <Settings className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Service Delivery
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Provide and fulfill your orders
                      </p>
                    </div>
                  </div>

                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <UserCheck className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Account Management
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Manage your account
                      </p>
                    </div>
                  </div>

                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <Mail className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Communications
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Send marketing and promotional communications (with your
                        consent)
                      </p>
                    </div>
                  </div>
                </div>

                <div className='space-y-3'>
                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <Shield className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Security
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Detect and prevent fraud
                      </p>
                    </div>
                  </div>

                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <Settings className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Improvements
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Improve the Services
                      </p>
                    </div>
                  </div>

                  <div className='flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-400/30'>
                    <Globe className='w-5 h-5 text-purple-400 mt-1 flex-shrink-0' />
                    <div>
                      <h4 className='font-semibold text-purple-300'>
                        Legal Compliance
                      </h4>
                      <p className='text-gray-300 text-sm'>
                        Comply with legal obligations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: How We Disclose Your Information */}
            <section
              id='how-we-disclose'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Users className='w-8 h-8 text-orange-400' />
                <h2 className='text-2xl font-bold'>
                  How We Disclose Your Information
                </h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                We may disclose your information to:
              </p>

              <div className='space-y-4'>
                <div className='bg-orange-900/20 rounded-xl p-4 border border-orange-400/30'>
                  <h3 className='text-lg font-semibold text-orange-300 mb-3'>
                    Third-Party Service Providers
                  </h3>
                  <p className='text-gray-300 text-sm'>
                    Such as payment processors, data analysts, and other service
                    providers necessary for business operations.
                  </p>
                </div>

                <div className='bg-orange-900/20 rounded-xl p-4 border border-orange-400/30'>
                  <h3 className='text-lg font-semibold text-orange-300 mb-3'>
                    Business and Marketing Partners
                  </h3>
                  <p className='text-gray-300 text-sm'>
                    Only with your explicit consent for marketing and
                    partnership purposes.
                  </p>
                </div>

                <div className='bg-orange-900/20 rounded-xl p-4 border border-orange-400/30'>
                  <h3 className='text-lg font-semibold text-orange-300 mb-3'>
                    Affiliates & Legal Requirements
                  </h3>
                  <p className='text-gray-300 text-sm'>
                    To our affiliates and as required by law or legal process.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Your Rights */}
            <section
              id='your-rights'
              className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <UserCheck className='w-8 h-8 text-cyan-400' />
                <h2 className='text-2xl font-bold'>Your Rights</h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                Depending on your location, you may have rights regarding your
                information, such as:
              </p>

              <div className='grid md:grid-cols-2 gap-4 mb-6'>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-400/30'>
                    <Eye className='w-5 h-5 text-cyan-400' />
                    <span className='text-cyan-300 font-medium'>Access</span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-400/30'>
                    <Database className='w-5 h-5 text-cyan-400' />
                    <span className='text-cyan-300 font-medium'>Deletion</span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-400/30'>
                    <Settings className='w-5 h-5 text-cyan-400' />
                    <span className='text-cyan-300 font-medium'>
                      Correction
                    </span>
                  </div>
                </div>

                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-400/30'>
                    <Globe className='w-5 h-5 text-cyan-400' />
                    <span className='text-cyan-300 font-medium'>
                      Portability
                    </span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-400/30'>
                    <Mail className='w-5 h-5 text-cyan-400' />
                    <span className='text-cyan-300 font-medium'>
                      Opting out of marketing
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-blue-900/20 rounded-xl p-6 border border-blue-400/30'>
                <h3 className='text-lg font-semibold text-blue-300 mb-3'>
                  Exercise Your Rights
                </h3>
                <p className='text-gray-300 mb-4'>
                  You can exercise these rights by contacting us through the
                  following methods:
                </p>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-blue-900/30 rounded-lg'>
                    <Instagram className='w-5 h-5 text-pink-400' />
                    <span className='text-gray-300'>
                      Instagram:{' '}
                      <span className='text-pink-300 font-medium'>
                        @RozeTrader15
                      </span>
                    </span>
                  </div>
                  <div className='flex items-center gap-3 p-3 bg-blue-900/30 rounded-lg'>
                    <Phone className='w-5 h-5 text-green-400' />
                    <span className='text-gray-300'>
                      Phone:{' '}
                      <span className='text-green-300 font-medium'>
                        +1 289 306 5228
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact Section */}
            <section
              id='contact'
              className='bg-gradient-to-br from-blue-900/20 via-gray-800/40 to-gray-900/40 rounded-2xl p-6 sm:p-8 border border-blue-400/30 backdrop-blur-sm'
            >
              <div className='flex items-center gap-3 mb-6'>
                <Mail className='w-8 h-8 text-blue-400' />
                <h2 className='text-2xl font-bold'>Contact</h2>
              </div>
              <p className='text-gray-300 leading-relaxed mb-6'>
                If you have any questions about this Privacy Policy, please
                contact us:
              </p>
              <div className='grid md:grid-cols-2 gap-4'>
                <div className='flex items-center gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-400/30'>
                  <Instagram className='w-5 h-5 text-pink-400' />
                  <div>
                    <p className='text-gray-400 text-sm'>Instagram</p>
                    <p className='text-pink-300 font-medium'>@RozeTrader15</p>
                  </div>
                </div>
                <div className='flex items-center gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-400/30'>
                  <Phone className='w-5 h-5 text-green-400' />
                  <div>
                    <p className='text-gray-400 text-sm'>Phone Number</p>
                    <p className='text-green-300 font-medium'>
                      +1 289 306 5228
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer Actions */}
            <div className='text-center py-12'>
              <div className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm'>
                <h3 className='text-2xl font-bold mb-4'>
                  Your Privacy Matters
                </h3>
                <p className='text-gray-300 mb-6'>
                  We are committed to protecting your personal information and
                  respecting your privacy rights.
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
                  <Link href='/terms-of-service'>
                    <Button
                      variant='outline'
                      className='bg-transparent border-blue-600 text-blue-300 hover:bg-blue-700 hover:text-white'
                    >
                      View Terms of Service
                      <ChevronRight className='w-4 h-4 ml-2' />
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
