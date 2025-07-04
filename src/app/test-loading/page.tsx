import { ImmediateLoadingTest } from '@/components/immediate-loading-test';

export default function TestLoadingPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8'>
      <div className='container mx-auto px-4'>
        <div className='max-w-4xl mx-auto'>
          <div className='text-center mb-8'>
            <h1 className='text-4xl font-bold text-gray-900 mb-2'>
              🔥 Immediate Loading Test
            </h1>
            <p className='text-lg text-gray-600'>
              Test the immediate loading feedback system. Click any button and
              watch the loading states appear instantly!
            </p>
          </div>

          <ImmediateLoadingTest />
        </div>
      </div>
    </div>
  );
}
