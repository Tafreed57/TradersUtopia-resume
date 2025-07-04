'use client';

import { useState } from 'react';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import { ButtonLoading } from '@/components/ui/loading-components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, X, Play } from 'lucide-react';

export function ImmediateLoadingTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const apiLoading = useComprehensiveLoading('api');
  const buttonLoading = useComprehensiveLoading('button');
  const globalLoading = useComprehensiveLoading('global');

  const addResult = (result: string) => {
    setTestResults(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const testImmediateApiLoading = async () => {
    addResult('🔥 IMMEDIATE API Loading test started');

    try {
      const result = await apiLoading.withLoading(
        async () => {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 2000));
          return 'API call completed successfully';
        },
        {
          loadingMessage: 'Testing immediate API loading...',
          successMessage: 'API test completed!',
          immediate: true, // Force immediate loading
        }
      );
      addResult(`✅ ${result}`);
    } catch (error) {
      addResult(`❌ API test failed: ${error}`);
    }
  };

  const testImmediateButtonLoading = async () => {
    addResult('🔥 IMMEDIATE Button Loading test started');

    try {
      const result = await buttonLoading.withLoading(
        async () => {
          // Simulate button action
          await new Promise(resolve => setTimeout(resolve, 1500));
          return 'Button action completed successfully';
        },
        {
          loadingMessage: 'Processing button action...',
          successMessage: 'Button action completed!',
          immediate: true, // Force immediate loading
        }
      );
      addResult(`✅ ${result}`);
    } catch (error) {
      addResult(`❌ Button test failed: ${error}`);
    }
  };

  const testImmediateGlobalLoading = async () => {
    addResult('🔥 IMMEDIATE Global Loading test started');

    try {
      const result = await globalLoading.withLoading(
        async () => {
          // Simulate global operation
          await new Promise(resolve => setTimeout(resolve, 3000));
          return 'Global operation completed successfully';
        },
        {
          loadingMessage: 'Testing global loading screen...',
          successMessage: 'Global test completed!',
          immediate: true, // Force immediate loading
        }
      );
      addResult(`✅ ${result}`);
    } catch (error) {
      addResult(`❌ Global test failed: ${error}`);
    }
  };

  const testInstantFeedback = () => {
    addResult('🔥 INSTANT Feedback test - this should appear immediately!');

    // Test immediate state change
    buttonLoading.startLoading('Instant feedback test...');

    setTimeout(() => {
      buttonLoading.stopLoading();
      addResult('✅ Instant feedback test completed');
    }, 1000);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Play className='h-6 w-6' />
            Immediate Loading Test Suite
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Test immediate loading feedback across different loading types.
            Loading states should appear instantly when you click any button.
          </p>
        </CardHeader>

        <CardContent className='space-y-4'>
          {/* Test Buttons */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Button
              onClick={testImmediateApiLoading}
              disabled={apiLoading.isLoading}
              className='w-full'
            >
              <ButtonLoading
                isLoading={apiLoading.isLoading}
                loadingText={apiLoading.message}
              >
                🔥 Test API Loading (2s)
              </ButtonLoading>
            </Button>

            <Button
              onClick={testImmediateButtonLoading}
              disabled={buttonLoading.isLoading}
              className='w-full'
            >
              <ButtonLoading
                isLoading={buttonLoading.isLoading}
                loadingText={buttonLoading.message}
              >
                🔥 Test Button Loading (1.5s)
              </ButtonLoading>
            </Button>

            <Button
              onClick={testImmediateGlobalLoading}
              disabled={globalLoading.isLoading}
              className='w-full'
            >
              <ButtonLoading
                isLoading={globalLoading.isLoading}
                loadingText='Testing global loading...'
              >
                🔥 Test Global Loading (3s)
              </ButtonLoading>
            </Button>

            <Button
              onClick={testInstantFeedback}
              disabled={buttonLoading.isLoading}
              className='w-full'
            >
              <ButtonLoading
                isLoading={buttonLoading.isLoading}
                loadingText={buttonLoading.message}
              >
                ⚡ Test Instant Feedback (1s)
              </ButtonLoading>
            </Button>
          </div>

          {/* Control Buttons */}
          <div className='flex gap-2'>
            <Button variant='outline' onClick={clearResults} className='flex-1'>
              <X className='h-4 w-4 mr-2' />
              Clear Results
            </Button>
          </div>

          {/* Test Results */}
          <div className='bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto'>
            <h3 className='font-semibold mb-2'>Test Results:</h3>
            {testResults.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No tests run yet. Click a button above to start testing.
              </p>
            ) : (
              <div className='space-y-1'>
                {testResults.map((result, index) => (
                  <div key={index} className='text-sm font-mono'>
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <h3 className='font-semibold text-blue-900 mb-2'>
              Expected Behavior:
            </h3>
            <ul className='text-sm text-blue-800 space-y-1'>
              <li>
                ✅ Loading states should appear <strong>immediately</strong>{' '}
                when clicking buttons
              </li>
              <li>✅ No delay between click and loading feedback</li>
              <li>✅ Global loading should show full-screen overlay</li>
              <li>✅ Button loading should show spinner and disable button</li>
              <li>✅ Results should be logged in real-time</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
