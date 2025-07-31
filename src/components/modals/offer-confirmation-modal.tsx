'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  DollarSign,
  TrendingDown,
  Sparkles,
  Crown,
} from 'lucide-react';
import { formatCurrency, dollarsToCents } from '@/lib/utils';

interface OfferConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrice: number;
  userInput: number;
  offerPrice: number;
  savings: number;
  percentOff: number;
}

export function OfferConfirmationModal({
  isOpen,
  onClose,
  originalPrice,
  userInput,
  offerPrice,
  savings,
  percentOff,
}: OfferConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-[92vw] sm:max-w-md lg:max-w-lg max-h-[92vh] sm:max-h-[85vh] p-0 border-0 bg-transparent overflow-y-auto fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50'>
        <div className='relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-emerald-500/30'>
          {/* Animated Background */}
          <div className='absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-green-600/10'></div>
          <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-r from-emerald-500/5 to-green-500/5 animate-pulse'></div>
          <div className='absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-gradient-to-bl from-emerald-400/20 to-transparent rounded-full blur-3xl animate-pulse'></div>

          {/* Sparkle decorations - Mobile optimized */}
          <div className='absolute top-3 left-3 sm:top-6 sm:left-6'>
            <Sparkles className='w-4 h-4 sm:w-6 sm:h-6 text-emerald-300 animate-pulse' />
          </div>
          <div className='absolute top-6 right-4 sm:top-12 sm:right-8'>
            <Sparkles className='w-3 h-3 sm:w-4 sm:h-4 text-green-300 animate-pulse delay-700' />
          </div>
          <div className='absolute bottom-4 left-4 sm:bottom-8 sm:left-8'>
            <Sparkles className='w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 animate-pulse delay-1000' />
          </div>

          <div className='relative z-10 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6'>
            {/* Header - Mobile optimized */}
            <DialogHeader className='text-center space-y-3 sm:space-y-4'>
              <div className='mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl animate-bounce'>
                <Crown className='w-8 h-8 sm:w-10 sm:h-10 text-white' />
              </div>

              <div className='space-y-2 px-2'>
                <DialogTitle className='text-xl xs:text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-200 to-green-200 bg-clip-text text-transparent leading-tight'>
                  🎉 Your Custom Offer
                </DialogTitle>
                <p className='text-emerald-200 text-sm sm:text-lg font-medium'>
                  We've crafted the perfect price just for you!
                </p>
              </div>
            </DialogHeader>

            {/* Offer Details - Mobile optimized spacing */}
            <div className='space-y-3 sm:space-y-4'>
              {/* What you wanted - Mobile responsive */}
              <div className='bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4'>
                <div className='flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-0'>
                  <span className='text-emerald-200 font-medium text-sm sm:text-base'>
                    You said you could afford:
                  </span>
                  <span className='text-white text-lg sm:text-xl font-bold'>
                    {formatCurrency(dollarsToCents(userInput))}/month
                  </span>
                </div>
              </div>

              {/* Your offer - Mobile responsive */}
              <div className='bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center'>
                <div className='space-y-2 sm:space-y-3'>
                  <div className='flex items-center justify-center gap-2 text-emerald-300 font-semibold text-sm sm:text-base'>
                    <CheckCircle className='w-4 h-4 sm:w-5 sm:h-5' />
                    <span>Your New Price</span>
                  </div>
                  <div className='text-3xl xs:text-4xl sm:text-5xl font-black text-white'>
                    {formatCurrency(dollarsToCents(offerPrice))}
                  </div>
                  <div className='text-emerald-200 text-base sm:text-lg font-medium'>
                    per month • locked forever
                  </div>

                  {/* Savings badge - Mobile responsive */}
                  <div className='inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg'>
                    <TrendingDown className='w-3 h-3 sm:w-4 sm:h-4' />
                    <span className='whitespace-nowrap'>
                      Save {formatCurrency(dollarsToCents(savings))}/month (
                      {percentOff}% OFF)
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparison - Mobile responsive grid */}
              <div className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4'>
                <div className='grid grid-cols-2 gap-3 sm:gap-4 text-center'>
                  <div>
                    <div className='text-gray-300 text-xs sm:text-sm font-medium mb-1'>
                      Original Price
                    </div>
                    <div className='text-white text-lg sm:text-xl font-bold line-through opacity-75'>
                      {formatCurrency(dollarsToCents(originalPrice))}
                    </div>
                  </div>
                  <div>
                    <div className='text-emerald-300 text-xs sm:text-sm font-medium mb-1'>
                      Your Price
                    </div>
                    <div className='text-emerald-400 text-lg sm:text-xl font-bold'>
                      {formatCurrency(dollarsToCents(offerPrice))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What you get - Mobile responsive */}
            <div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-xl sm:rounded-2xl p-3 sm:p-4'>
              <h3 className='text-white font-semibold text-base sm:text-lg mb-2 sm:mb-3 text-center'>
                Everything included at this price:
              </h3>
              <div className='grid grid-cols-1 gap-1.5 sm:gap-2 text-xs sm:text-sm'>
                {[
                  '📈 Daily trade alerts',
                  '💬 Private Discord access',
                  '📊 Market analysis',
                  '🎯 Personal guidance',
                  '📱 Mobile notifications',
                  '⚡ Real-time updates',
                ].map((feature, index) => (
                  <div
                    key={index}
                    className='flex items-center gap-2 text-gray-200'
                  >
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full flex-shrink-0'></div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button - Mobile optimized */}
            <div className='text-center pt-1 sm:pt-2'>
              <Button
                onClick={onClose}
                className='w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 sm:py-4 text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 touch-manipulation min-h-[48px]'
              >
                <span className='flex items-center justify-center gap-2'>
                  <span>Perfect! Apply This Offer</span>
                  <span>🚀</span>
                </span>
              </Button>
            </div>

            {/* Trust Signal - Mobile responsive */}
            <div className='text-center pt-1 sm:pt-2'>
              <p className='text-emerald-200 text-xs sm:text-sm leading-relaxed'>
                🔒 Price locked forever • 🎯 No hidden fees • 📞 Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
