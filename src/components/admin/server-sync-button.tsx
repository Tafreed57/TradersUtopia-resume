// 'use client';

// import { Button } from '@/components/ui/button';
// import { useState } from 'react';
// import { RefreshCw, Users, CheckCircle, AlertCircle } from 'lucide-react';

// import { useRouter } from 'next/navigation';
// import { toast } from 'sonner';
// import { useUser } from '@clerk/nextjs';

// export function ServerSyncButton() {
//   const [isLoading, setIsLoading] = useState(false);
//   const [result, setResult] = useState<any>(null);
//   const [error, setError] = useState<string | null>(null);
//   const router = useRouter();
//   const { user } = useUser();

//   const handleSync = async () => {
//     setIsLoading(true);
//     setError(null);
//     setResult(null);

//     try {
//       const response = await fetch('/api/servers/ensure-all-users', {
//         method: 'POST',
//       });
//       const data = await response.json();
//       if (data.success) {
//         toast.success(data.message);
//         router.refresh();
//       } else {
//         throw new Error(data.message || 'Server sync failed');
//       }
//     } catch (error: any) {
//       toast.error('Sync Error', {
//         description: error.message,
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   if (!user || !(user.publicMetadata as any)?.isAdmin) {
//     return null;
//   }

//   return (
//     <div className='space-y-4'>
//       <div className='flex items-center gap-3'>
//         <Button
//           onClick={handleSync}
//           disabled={isLoading}
//           className='bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
//         >
//           {isLoading ? (
//             <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
//           ) : (
//             <Users className='w-4 h-4 mr-2' />
//           )}
//           {isLoading ? 'Syncing...' : 'Sync All Users to Admin Servers'}
//         </Button>
//       </div>

//       {/* Success Result */}
//       {result && (
//         <div className='p-4 bg-green-900/20 border border-green-700/50 rounded-lg'>
//           <div className='flex items-center gap-2 mb-2'>
//             <CheckCircle className='w-5 h-5 text-green-400' />
//             <h3 className='font-semibold text-green-300'>
//               Sync Completed Successfully!
//             </h3>
//           </div>
//           <div className='text-sm text-green-200 space-y-1'>
//             <p>• Processed {result.totalServersProcessed} admin servers</p>
//             <p>• Added {result.totalMembershipsAdded} new memberships</p>
//             <p className='text-green-100 mt-2'>{result.message}</p>
//           </div>

//           {result.details && result.details.length > 0 && (
//             <details className='mt-3'>
//               <summary className='text-green-300 cursor-pointer hover:text-green-200'>
//                 View Details
//               </summary>
//               <div className='mt-2 space-y-2'>
//                 {result.details.map((server: any, index: number) => (
//                   <div
//                     key={index}
//                     className='text-xs text-green-200 bg-green-900/30 p-2 rounded'
//                   >
//                     <strong>"{server.serverName}":</strong>{' '}
//                     {server.addedCount > 0
//                       ? `Added ${server.addedCount} users`
//                       : server.message}
//                   </div>
//                 ))}
//               </div>
//             </details>
//           )}
//         </div>
//       )}

//       {/* Error Display */}
//       {error && (
//         <div className='p-4 bg-red-900/20 border border-red-700/50 rounded-lg'>
//           <div className='flex items-center gap-2 mb-2'>
//             <AlertCircle className='w-5 h-5 text-red-400' />
//             <h3 className='font-semibold text-red-300'>Sync Failed</h3>
//           </div>
//           <p className='text-sm text-red-200'>{error}</p>
//         </div>
//       )}

//       {/* Info Box */}
//       <div className='p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg'>
//         <h4 className='font-semibold text-blue-300 mb-2'>What this does:</h4>
//         <ul className='text-sm text-blue-200 space-y-1'>
//           <li>• Finds all servers created by admin users</li>
//           <li>
//             • Ensures every user is a member of every admin-created server
//           </li>
//           <li>• Fixes visibility issues where users can't see admin servers</li>
//           <li>• Admin users get ADMIN role, regular users get GUEST role</li>
//         </ul>
//       </div>
//     </div>
//   );
// }
