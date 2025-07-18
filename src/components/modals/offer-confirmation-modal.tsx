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
      <DialogContent className='max-w-md sm:max-w-lg p-0 border-0 bg-transparent'>
        <div className='relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-900 text-white rounded-3xl shadow-2xl border border-emerald-500/30'>
          {/* Animated Background */}
          <div className='absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-green-600/10'></div>
          <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-r from-emerald-500/5 to-green-500/5 animate-pulse'></div>
          <div className='absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-400/20 to-transparent rounded-full blur-3xl animate-pulse'></div>

          {/* Sparkle decorations */}
          <div className='absolute top-6 left-6'>
            <Sparkles className='w-6 h-6 text-emerald-300 animate-pulse' />
          </div>
          <div className='absolute top-12 right-8'>
            <Sparkles className='w-4 h-4 text-green-300 animate-pulse delay-700' />
          </div>
          <div className='absolute bottom-8 left-8'>
            <Sparkles className='w-5 h-5 text-emerald-400 animate-pulse delay-1000' />
          </div>

          <div className='relative z-10 p-6 sm:p-8 space-y-6'>
            {/* Header */}
            <DialogHeader className='text-center space-y-4'>
              <div className='mx-auto w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-3xl flex items-center justify-center shadow-2xl animate-bounce'>
                <Crown className='w-10 h-10 text-white' />
              </div>

              <div className='space-y-2'>
                <DialogTitle className='text-3xl font-black bg-gradient-to-r from-emerald-200 to-green-200 bg-clip-text text-transparent leading-tight'>
                  🎉 Your Custom Offer
                </DialogTitle>
                <p className='text-emerald-200 text-lg font-medium'>
                  We've crafted the perfect price just for you!
                </p>
              </div>
            </DialogHeader>

            {/* Offer Details */}
            <div className='space-y-4'>
              {/* What you wanted */}
              <div className='bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-emerald-200 font-medium'>
                    You said you could afford:
                  </span>
                  <span className='text-white text-xl font-bold'>
                    ${userInput.toFixed(2)}/month
                  </span>
                </div>
              </div>

              {/* Your offer */}
              <div className='bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 rounded-2xl p-6 text-center'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-center gap-2 text-emerald-300 font-semibold'>
                    <CheckCircle className='w-5 h-5' />
                    <span>Your New Price</span>
                  </div>
                  <div className='text-5xl font-black text-white'>
                    ${offerPrice.toFixed(2)}
                  </div>
                  <div className='text-emerald-200 text-lg font-medium'>
                    per month • locked forever
                  </div>

                  {/* Savings badge */}
                  <div className='inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg'>
                    <TrendingDown className='w-4 h-4' />
                    Save ${savings.toFixed(2)}/month ({percentOff}% OFF)
                  </div>
                </div>
              </div>

              {/* Comparison */}
              <div className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4'>
                <div className='grid grid-cols-2 gap-4 text-center'>
                  <div>
                    <div className='text-gray-300 text-sm font-medium mb-1'>
                      Original Price
                    </div>
                    <div className='text-white text-xl font-bold line-through opacity-75'>
                      ${originalPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className='text-emerald-300 text-sm font-medium mb-1'>
                      Your Price
                    </div>
                    <div className='text-emerald-400 text-xl font-bold'>
                      ${offerPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What you get */}
            <div className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-2xl p-4'>
              <h3 className='text-white font-semibold text-lg mb-3 text-center'>
                Everything included at this price:
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm'>
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
                    <div className='w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0'></div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div className='text-center pt-2'>
              <Button
                onClick={onClose}
                className='w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-4 text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105'
              >
                Perfect! Apply This Offer 🚀
              </Button>
            </div>

            {/* Trust Signal */}
            <div className='text-center pt-2'>
              <p className='text-emerald-200 text-sm'>
                🔒 Price locked forever • 🎯 No hidden fees • 📞 Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
