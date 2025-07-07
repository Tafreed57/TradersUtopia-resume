'use client';

import {
  Check,
  TrendingUp,
  BarChart3,
  Users,
  Target,
  Zap,
  Award,
} from 'lucide-react';

export function FeaturesSection() {
  const features = [
    {
      icon: TrendingUp,
      title: 'Real-Time Trade Alerts',
      description:
        'Receive instant notifications for high-probability setups with entry, stop-loss, and target levels.',
      items: [
        'SMS & Email alerts',
        'Risk management included',
        'Mobile app access',
      ],
      gradient: 'from-yellow-500/20 to-yellow-600/30',
      hoverColor: 'hover:border-yellow-400/50',
      shadowColor: 'hover:shadow-yellow-400/10',
      iconColor: 'text-yellow-400',
      titleHover: 'group-hover:text-yellow-300',
    },
    {
      icon: BarChart3,
      title: 'Expert Market Analysis',
      description:
        'Daily market breakdowns, key level analysis, and economic calendar insights from professional traders.',
      items: ['Daily market reports', 'Video breakdowns', 'Economic calendar'],
      gradient: 'from-blue-500/20 to-blue-600/30',
      hoverColor: 'hover:border-blue-400/50',
      shadowColor: 'hover:shadow-blue-400/10',
      iconColor: 'text-blue-400',
      titleHover: 'group-hover:text-blue-300',
    },
    {
      icon: Users,
      title: 'Live Trading Sessions',
      description:
        'Join live sessions where experts explain their thought process and trade in real-time.',
      items: ['3x weekly sessions', 'Q&A opportunities', 'Session recordings'],
      gradient: 'from-purple-500/20 to-purple-600/30',
      hoverColor: 'hover:border-purple-400/50',
      shadowColor: 'hover:shadow-purple-400/10',
      iconColor: 'text-purple-400',
      titleHover: 'group-hover:text-purple-300',
    },
    {
      icon: Target,
      title: 'Risk Management Tools',
      description:
        'Advanced position sizing calculators and risk management strategies to protect your capital.',
      items: [
        'Position size calculator',
        'Stop-loss strategies',
        'Portfolio tracking',
      ],
      gradient: 'from-green-500/20 to-green-600/30',
      hoverColor: 'hover:border-green-400/50',
      shadowColor: 'hover:shadow-green-400/10',
      iconColor: 'text-green-400',
      titleHover: 'group-hover:text-green-300',
    },
    {
      icon: Zap,
      title: 'Premium Community',
      description:
        'Connect with successful traders, share strategies, and get feedback on your trades.',
      items: [
        'Private Discord server',
        'Trade review sessions',
        'Mentorship program',
      ],
      gradient: 'from-red-500/20 to-red-600/30',
      hoverColor: 'hover:border-red-400/50',
      shadowColor: 'hover:shadow-red-400/10',
      iconColor: 'text-red-400',
      titleHover: 'group-hover:text-red-300',
    },
    {
      icon: Award,
      title: 'Educational Resources',
      description:
        'Comprehensive trading courses, webinars, and resources for all skill levels.',
      items: [
        '50+ hours of content',
        'Interactive quizzes',
        'Certification program',
      ],
      gradient: 'from-orange-500/20 to-orange-600/30',
      hoverColor: 'hover:border-orange-400/50',
      shadowColor: 'hover:shadow-orange-400/10',
      iconColor: 'text-orange-400',
      titleHover: 'group-hover:text-orange-300',
    },
  ];

  return (
    <section
      id='features'
      className='bg-gradient-to-b from-gray-900/50 to-black py-12 sm:py-16 md:py-20'
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6'>
        <div className='text-center mb-16'>
          <h2 className='text-4xl md:text-5xl font-bold mb-4'>
            Everything You Need to{' '}
            <span className='text-yellow-400'>Trade Profitably</span>
          </h2>
          <p className='text-xl text-gray-300 max-w-3xl mx-auto'>
            Our comprehensive platform provides real-time alerts, expert
            education, and a supportive community of successful traders.
          </p>
        </div>

        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 ${feature.hoverColor} transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl ${feature.shadowColor} backdrop-blur-sm`}
            >
              <div
                className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
              >
                <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
              </div>
              <h3
                className={`text-2xl font-bold mb-4 ${feature.titleHover} transition-colors`}
              >
                {feature.title}
              </h3>
              <p className='text-gray-300 mb-6 leading-relaxed'>
                {feature.description}
              </p>
              <div className='space-y-2'>
                {feature.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className='flex items-center gap-2 text-sm'
                  >
                    <Check className='w-4 h-4 text-green-400' />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
