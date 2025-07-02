'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { makeSecureRequest } from '@/lib/csrf-client';

interface DebugInfo {
  authenticated: boolean;
  clerkInfo?: any;
  primaryProfile?: any;
  allMatchingProfiles?: any[];
  profileExists: boolean;
  isAdmin: boolean;
  timestamp: string;
  debug?: any;
  error?: string;
}

export function AdminDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-admin-status');
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setDebugInfo({
        authenticated: false,
        profileExists: false,
        isAdmin: false,
        timestamp: new Date().toISOString(),
        error: 'Failed to check status',
      });
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = () => {
    // Clear all possible caches
    sessionStorage.clear();
    localStorage.clear();

    // Refresh the page
    window.location.reload();
  };

  const fixDuplicateProfiles = async (email: string) => {
    if (
      !confirm(
        `Fix duplicate profiles for ${email}? This will merge and remove duplicate entries.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const response = await makeSecureRequest(
        '/api/admin/fix-duplicate-profiles',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetEmail: email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(
          `✅ Success: ${data.message}\nDeleted ${data.deletedCount} duplicate profiles.`
        );
        // Refresh the debug info
        await checkAdminStatus();
      } else {
        alert(`❌ Error: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error('Error fixing duplicate profiles:', error);
      alert('❌ Error: Failed to fix duplicate profiles');
    } finally {
      setLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system-health');
      const data = await response.json();

      if (response.ok) {
        setHealthInfo(data);
        alert(
          `📊 System Health Check Complete!\n\nProfiles: ${data.system.totalProfiles}\nAdmins: ${data.system.totalAdmins}\nDuplicates: ${data.duplicates.count}\n\nCheck console for details.`
        );
        console.log('🔍 System Health Report:', data);
      } else {
        alert(`❌ Error: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error('Error checking system health:', error);
      alert('❌ Error: Failed to check system health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  return (
    <Card className='p-6 bg-gray-900/50 border-gray-700'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-white'>Admin Debug Panel</h3>
        <div className='flex gap-2'>
          <Button
            onClick={checkAdminStatus}
            disabled={loading}
            size='sm'
            variant='outline'
          >
            {loading ? (
              <RefreshCw className='h-4 w-4 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4' />
            )}
            Check Status
          </Button>
          <Button
            onClick={forceRefresh}
            size='sm'
            className='bg-blue-600 hover:bg-blue-700'
          >
            Force Refresh
          </Button>
        </div>
      </div>

      {debugInfo && (
        <div className='space-y-4'>
          {/* Authentication Status */}
          <div className='flex items-center gap-2'>
            {debugInfo.authenticated ? (
              <CheckCircle className='h-5 w-5 text-green-400' />
            ) : (
              <XCircle className='h-5 w-5 text-red-400' />
            )}
            <span className='text-white'>
              Authentication:{' '}
              {debugInfo.authenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>

          {/* Profile Status */}
          <div className='flex items-center gap-2'>
            {debugInfo.profileExists ? (
              <CheckCircle className='h-5 w-5 text-green-400' />
            ) : (
              <XCircle className='h-5 w-5 text-red-400' />
            )}
            <span className='text-white'>
              Profile: {debugInfo.profileExists ? 'Exists' : 'Not Found'}
            </span>
          </div>

          {/* Admin Status */}
          <div className='flex items-center gap-2'>
            {debugInfo.isAdmin ? (
              <CheckCircle className='h-5 w-5 text-green-400' />
            ) : (
              <XCircle className='h-5 w-5 text-red-400' />
            )}
            <span className='text-white'>
              Admin Status: {debugInfo.isAdmin ? 'Admin' : 'Not Admin'}
            </span>
          </div>

          {/* Timestamp */}
          <div className='text-sm text-gray-400'>
            Last Checked: {new Date(debugInfo.timestamp).toLocaleString()}
          </div>

          {/* Detailed Info */}
          {debugInfo.authenticated && debugInfo.clerkInfo && (
            <div className='bg-gray-800/50 rounded-lg p-4 mt-4'>
              <h4 className='text-sm font-semibold text-gray-300 mb-2'>
                User Info:
              </h4>
              <div className='text-sm text-gray-400 space-y-1'>
                <div>ID: {debugInfo.clerkInfo.id}</div>
                <div>Email: {debugInfo.clerkInfo.email}</div>
                <div>
                  Name: {debugInfo.clerkInfo.firstName}{' '}
                  {debugInfo.clerkInfo.lastName}
                </div>
              </div>
            </div>
          )}

          {/* Multiple Profiles Warning */}
          {debugInfo.allMatchingProfiles &&
            debugInfo.allMatchingProfiles.length > 1 && (
              <div className='bg-yellow-900/20 rounded-lg p-4 border border-yellow-600/30'>
                <div className='flex items-start gap-2 mb-3'>
                  <AlertTriangle className='h-5 w-5 text-yellow-400 mt-0.5' />
                  <div>
                    <div className='text-yellow-400 font-semibold'>
                      Multiple Profiles Found!
                    </div>
                    <div className='text-sm text-yellow-300'>
                      Found {debugInfo.allMatchingProfiles.length} profiles.
                      This causes admin status issues.
                    </div>
                  </div>
                </div>

                {debugInfo.clerkInfo?.email && (
                  <Button
                    onClick={() =>
                      fixDuplicateProfiles(debugInfo.clerkInfo.email)
                    }
                    disabled={loading}
                    size='sm'
                    className='bg-yellow-600 hover:bg-yellow-700 text-white'
                  >
                    {loading ? (
                      <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                    ) : (
                      <AlertTriangle className='h-4 w-4 mr-2' />
                    )}
                    Fix My Duplicate Profiles
                  </Button>
                )}
              </div>
            )}

          {/* Quick Fix for Specific Users */}
          <div className='bg-blue-900/20 rounded-lg p-4 border border-blue-600/30'>
            <h4 className='text-blue-400 font-semibold mb-2'>
              Admin Tools - Fix Known Duplicate Issues
            </h4>
            <div className='flex flex-col sm:flex-row gap-2'>
              <Button
                onClick={() => fixDuplicateProfiles('shehrozeps9721@gmail.com')}
                disabled={loading}
                size='sm'
                className='bg-blue-600 hover:bg-blue-700 text-white'
              >
                {loading ? (
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <AlertTriangle className='h-4 w-4 mr-2' />
                )}
                Fix Shehroze's Profiles
              </Button>
              <Button
                onClick={() => fixDuplicateProfiles('tafreed47@gmail.com')}
                disabled={loading}
                size='sm'
                className='bg-blue-600 hover:bg-blue-700 text-white'
              >
                {loading ? (
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <AlertTriangle className='h-4 w-4 mr-2' />
                )}
                Fix Tafreed's Profiles
              </Button>
            </div>
          </div>

          {/* System Health Check */}
          <div className='bg-green-900/20 rounded-lg p-4 border border-green-600/30'>
            <h4 className='text-green-400 font-semibold mb-2'>
              System Health & Monitoring
            </h4>
            <div className='flex flex-col sm:flex-row gap-2'>
              <Button
                onClick={checkSystemHealth}
                disabled={loading}
                size='sm'
                className='bg-green-600 hover:bg-green-700 text-white'
              >
                {loading ? (
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <CheckCircle className='h-4 w-4 mr-2' />
                )}
                Run System Health Check
              </Button>
            </div>

            {healthInfo && (
              <div className='mt-3 text-sm text-green-300 space-y-1'>
                <div>📊 Total Profiles: {healthInfo.system.totalProfiles}</div>
                <div>👑 Admins: {healthInfo.system.totalAdmins}</div>
                <div>⚠️ Duplicates: {healthInfo.duplicates.count}</div>
                <div>
                  🔧 Issues:{' '}
                  {healthInfo.issues.orphaned.length +
                    healthInfo.issues.multipleProfiles.length}
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {debugInfo.error && (
            <div className='flex items-start gap-2 bg-red-900/20 rounded-lg p-3'>
              <XCircle className='h-5 w-5 text-red-400 mt-0.5' />
              <div>
                <div className='text-red-400 font-semibold'>Error</div>
                <div className='text-sm text-red-300'>{debugInfo.error}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
