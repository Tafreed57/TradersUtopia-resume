'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Crown,
  Database,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { makeSecureRequest } from '@/lib/csrf-client';
import { formatDistanceToNow } from 'date-fns';

interface UserData {
  id: string;
  userId: string;
  name: string;
  email: string;
  imageUrl?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    customerId: string;
    subscriptionId: string;
    priceId: string;
    productId: string;
    productName: string;
    planName: string;
    createdAt: string;
  };
  stripeCustomer?: {
    id: string;
    email: string;
    name?: string;
    created: number;
    defaultSource?: string;
    subscriptions: any[];
    invoices: any[];
    paymentMethods: any[];
  };
  clerkData?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    emailAddresses: any[];
    phoneNumbers: any[];
    externalAccounts: any[];
    createdAt: number;
    updatedAt: number;
    lastSignInAt?: number;
    passwordEnabled: boolean;
  };
}

interface UserManagementProps {
  initialUsers?: UserData[];
  onUserUpdate?: (users: UserData[]) => void;
}

function UserManagement({
  initialUsers = [],
  onUserUpdate,
}: UserManagementProps) {
  const { user } = useUser();
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter users based on search term
  const filteredUsers = users.filter(
    user =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await makeSecureRequest('/api/admin/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        showToast.success('Users Loaded', `Found ${data.users.length} users`);
      } else {
        const error = await response.json();
        showToast.error('Failed to Load Users', error.message);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast.error('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (userId: string) => {
    if (
      !confirm(
        'Are you sure you want to DELETE this user account? This action cannot be undone and will remove ALL user data.'
      )
    ) {
      return;
    }

    setActionLoading(`delete-${userId}`);
    try {
      const response = await makeSecureRequest('/api/admin/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.userId !== userId));
        setSelectedUser(null);
        showToast.success(
          'Account Deleted',
          'User account has been permanently deleted'
        );
      } else {
        const error = await response.json();
        showToast.error('Delete Failed', error.message);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      showToast.error('Error', 'Failed to delete account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrant = async (userId: string) => {
    if (
      !confirm(
        'Are you sure you want to GRANT SUBSCRIPTION ACCESS to this user? This will give them premium features.'
      )
    ) {
      return;
    }

    setActionLoading(`grant-${userId}`);
    try {
      const response = await makeSecureRequest(
        '/api/admin/users/grant-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (response.ok) {
        await fetchUsers(); // Refresh the user list
        showToast.success(
          'Subscription Granted',
          'User has been granted subscription access'
        );
      } else {
        const error = await response.json();
        showToast.error('Grant Failed', error.message);
      }
    } catch (error) {
      console.error('Error granting subscription:', error);
      showToast.error('Error', 'Failed to grant subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to CANCEL this user's subscription? They will lose premium access."
      )
    ) {
      return;
    }

    setActionLoading(`cancel-${userId}`);
    try {
      const response = await makeSecureRequest(
        '/api/admin/users/cancel-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (response.ok) {
        await fetchUsers(); // Refresh the user list
        showToast.success(
          'Subscription Cancelled',
          'User subscription has been cancelled'
        );
      } else {
        const error = await response.json();
        showToast.error('Cancel Failed', error.message);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showToast.error('Error', 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (
    userId: string,
    isCurrentlyAdmin: boolean
  ) => {
    const action = isCurrentlyAdmin
      ? 'REMOVE ADMIN ACCESS from'
      : 'GRANT ADMIN ACCESS to';
    const consequence = isCurrentlyAdmin
      ? 'They will lose all administrative privileges.'
      : 'They will gain full administrative privileges.';

    if (
      !confirm(`Are you sure you want to ${action} this user? ${consequence}`)
    ) {
      return;
    }

    setActionLoading(`toggleAdmin-${userId}`);
    try {
      const response = await makeSecureRequest(
        '/api/admin/users/toggle-admin',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, grantAdmin: !isCurrentlyAdmin }),
        }
      );

      if (response.ok) {
        await fetchUsers(); // Refresh the user list
        showToast.success(
          isCurrentlyAdmin ? 'Admin Access Removed' : 'Admin Access Granted',
          isCurrentlyAdmin
            ? 'User no longer has admin privileges'
            : 'User now has admin privileges'
        );
      } else {
        const error = await response.json();
        showToast.error('Admin Toggle Failed', error.message);
      }
    } catch (error) {
      console.error('Error toggling admin status:', error);
      showToast.error('Error', 'Failed to toggle admin status');
    } finally {
      setActionLoading(null);
    }
  };

  // const handleFixAllAdminServerRoles = async () => {
  //   if (
  //     !confirm(
  //       "Fix ALL admin server roles? This will update ALL global admins to have ADMIN role in ALL servers and join them to any admin-created servers they're not already in."
  //     )
  //   ) {
  //     return;
  //   }

  //   setActionLoading('fix-admin-roles');
  //   try {
  //     const response = await makeSecureRequest(
  //       '/api/admin/update-all-server-roles',
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //       }
  //     );

  //     if (response.ok) {
  //       const data = await response.json();
  //       showToast.success(
  //         'Admin Server Roles Fixed!',
  //         `Updated ${data.summary.totalRolesUpdated} roles and joined ${data.summary.totalServersJoined} servers for ${data.summary.totalAdmins} admins`
  //       );

  //       // Refresh user data to reflect changes
  //       await fetchUsers();
  //     } else {
  //       const error = await response.json();
  //       showToast.error('Fix Failed', error.message);
  //     }
  //   } catch (error) {
  //     console.error('Error fixing admin server roles:', error);
  //     showToast.error('Error', 'Failed to fix admin server roles');
  //   } finally {
  //     setActionLoading(null);
  //   }
  // };

  const formatDate = (date: string | number) => {
    return (
      new Date(date).toLocaleDateString() +
      ' ' +
      new Date(date).toLocaleTimeString()
    );
  };

  const getStatusBadge = (user: UserData) => {
    if (user.isAdmin) {
      return (
        <Badge className='bg-red-600 text-white text-xs'>
          <Crown className='w-3 h-3 mr-1' />
          Admin
        </Badge>
      );
    }
    if (user.subscription?.status === 'active') {
      return (
        <Badge className='bg-green-600 text-white text-xs'>
          <CheckCircle className='w-3 h-3 mr-1' />
          {user.subscription.planName || 'Premium'}
        </Badge>
      );
    }
    return (
      <Badge variant='outline' className='text-xs'>
        <XCircle className='w-3 h-3 mr-1' />
        Free
      </Badge>
    );
  };

  if (!user) return null;

  return (
    <div className='w-full space-y-4 sm:space-y-6'>
      {/* Mobile-First Header */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4'>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-xl flex items-center justify-center'>
            <Users className='h-4 w-4 sm:h-6 sm:w-6 text-blue-400' />
          </div>
          <div>
            <h3 className='text-lg sm:text-xl font-bold text-white'>
              User Management
            </h3>
            <p className='text-gray-400 text-xs sm:text-sm'>
              Manage all registered users and their data
            </p>
          </div>
        </div>
        <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
          <Button
            onClick={fetchUsers}
            disabled={loading}
            size='sm'
            className='bg-blue-600 hover:bg-blue-700 w-full sm:w-auto'
          >
            {loading ? (
              <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
            ) : (
              <Database className='w-4 h-4 mr-2' />
            )}
            {loading ? 'Loading...' : 'Load Users'}
          </Button>
          {/* <Button
            onClick={handleFixAllAdminServerRoles}
            disabled={actionLoading === 'fix-admin-roles'}
            size='sm'
            className='bg-orange-600 hover:bg-orange-700 w-full sm:w-auto'
          >
            {actionLoading === 'fix-admin-roles' ? (
              <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
            ) : (
              <UserCog className='w-4 h-4 mr-2' />
            )}
            {actionLoading === 'fix-admin-roles'
              ? 'Fixing...'
              : 'Fix Admin Server Roles'}
          </Button> */}
        </div>
      </div>

      {users.length > 0 && (
        <>
          {/* Mobile-Optimized Search */}
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
            <Input
              placeholder='Search by name, email, or user ID...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10 bg-gray-800/50 border-gray-600 text-white h-10 sm:h-auto'
            />
          </div>

          {/* Mobile-First Stats Grid */}
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4'>
            <Card className='bg-gray-800/50 border-gray-600'>
              <CardContent className='p-3 sm:p-4'>
                <div className='text-lg sm:text-2xl font-bold text-blue-400'>
                  {users.length}
                </div>
                <div className='text-xs text-gray-400'>Total Users</div>
              </CardContent>
            </Card>
            <Card className='bg-gray-800/50 border-gray-600'>
              <CardContent className='p-3 sm:p-4'>
                <div className='text-lg sm:text-2xl font-bold text-green-400'>
                  {
                    users.filter(u => u.subscription?.status === 'active')
                      .length
                  }
                </div>
                <div className='text-xs text-gray-400'>Active Subs</div>
              </CardContent>
            </Card>
            <Card className='bg-gray-800/50 border-gray-600'>
              <CardContent className='p-3 sm:p-4'>
                <div className='text-lg sm:text-2xl font-bold text-red-400'>
                  {users.filter(u => u.isAdmin).length}
                </div>
                <div className='text-xs text-gray-400'>Admins</div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile-First Users List */}
          <Card className='bg-gray-800/50 border-gray-600'>
            <CardHeader className='pb-3 sm:pb-6'>
              <CardTitle className='text-white flex items-center gap-2 text-base sm:text-lg'>
                <Users className='w-4 h-4 sm:w-5 sm:h-5' />
                Users ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className='p-2 sm:p-6'>
              <ScrollArea className='h-[400px] sm:h-[600px]'>
                <div className='space-y-2 sm:space-y-3'>
                  {filteredUsers.map(userData => (
                    <Card
                      key={userData.id}
                      className='bg-gray-900/50 border-gray-600 hover:border-gray-500 transition-colors'
                    >
                      <CardContent className='p-3 sm:p-4'>
                        {/* Mobile-First Layout */}
                        <div className='space-y-3'>
                          {/* User Info Row */}
                          <div className='flex items-start gap-3'>
                            {userData.imageUrl ? (
                              <Image
                                src={userData.imageUrl}
                                alt={userData.name}
                                width={48}
                                height={48}
                                className='w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0'
                              />
                            ) : (
                              <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0'>
                                {userData.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className='flex-1 min-w-0'>
                              <div className='flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1'>
                                <h4 className='font-medium text-white text-sm sm:text-base truncate'>
                                  {userData.name}
                                </h4>
                                {getStatusBadge(userData)}
                              </div>
                              <p className='text-xs sm:text-sm text-gray-400 truncate'>
                                {userData.email}
                              </p>
                              {userData.subscription?.productName && (
                                <p className='text-xs text-blue-400 font-medium truncate'>
                                  {userData.subscription.productName}
                                </p>
                              )}
                              <div className='flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 mt-1'>
                                <span className='truncate'>
                                  ID:{' '}
                                  {userData.userId
                                    ? userData.userId.substring(0, 8) + '...'
                                    : 'N/A'}
                                </span>
                                <span className='truncate'>
                                  Joined:{' '}
                                  {formatDistanceToNow(
                                    new Date(userData.createdAt)
                                  )}{' '}
                                  ago
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Mobile Actions Row */}
                          <div className='flex flex-col sm:flex-row gap-2 sm:gap-1'>
                            {/* View Details Button - Full Width on Mobile */}
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => {
                                setSelectedUser(userData);
                                setShowDetailedView(true);
                              }}
                              className='border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto order-1 sm:order-none'
                            >
                              <Eye className='w-4 h-4 mr-2' />
                              View Details
                            </Button>

                            {/* Quick Actions - Grid on Mobile */}
                            <div className='grid grid-cols-3 gap-2 sm:flex sm:gap-1 order-2 sm:order-none'>
                              {/* Subscription Action */}
                              {userData.subscription?.status === 'active' ? (
                                <Button
                                  size='sm'
                                  variant='destructive'
                                  onClick={() => handleCancel(userData.userId)}
                                  disabled={
                                    actionLoading ===
                                    `cancel-${userData.userId}`
                                  }
                                  className='bg-orange-600 hover:bg-orange-700 min-w-0'
                                  title='Cancel Subscription'
                                >
                                  {actionLoading ===
                                  `cancel-${userData.userId}` ? (
                                    <RefreshCw className='w-3 h-3 sm:w-4 sm:h-4 animate-spin' />
                                  ) : (
                                    <CreditCard className='w-3 h-3 sm:w-4 sm:h-4' />
                                  )}
                                  <span className='ml-1 text-xs sm:hidden'>
                                    Cancel
                                  </span>
                                </Button>
                              ) : (
                                <Button
                                  size='sm'
                                  onClick={() => handleGrant(userData.userId)}
                                  disabled={
                                    actionLoading === `grant-${userData.userId}`
                                  }
                                  className='bg-green-600 hover:bg-green-700 min-w-0'
                                  title='Grant Subscription'
                                >
                                  {actionLoading ===
                                  `grant-${userData.userId}` ? (
                                    <RefreshCw className='w-3 h-3 sm:w-4 sm:h-4 animate-spin' />
                                  ) : (
                                    <UserPlus className='w-3 h-3 sm:w-4 sm:h-4' />
                                  )}
                                  <span className='ml-1 text-xs sm:hidden'>
                                    Grant
                                  </span>
                                </Button>
                              )}

                              {/* Admin Toggle */}
                              <Button
                                size='sm'
                                variant={
                                  userData.isAdmin ? 'destructive' : 'default'
                                }
                                onClick={() =>
                                  handleToggleAdmin(
                                    userData.userId,
                                    userData.isAdmin
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                    `toggleAdmin-${userData.userId}` ||
                                  userData.userId === user?.id
                                }
                                className={`min-w-0 ${
                                  userData.isAdmin
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                                title={
                                  userData.isAdmin
                                    ? 'Remove Admin'
                                    : 'Make Admin'
                                }
                              >
                                {actionLoading ===
                                `toggleAdmin-${userData.userId}` ? (
                                  <RefreshCw className='w-3 h-3 sm:w-4 sm:h-4 animate-spin' />
                                ) : (
                                  <Crown className='w-3 h-3 sm:w-4 sm:h-4' />
                                )}
                                <span className='ml-1 text-xs sm:hidden'>
                                  {userData.isAdmin ? 'Remove' : 'Admin'}
                                </span>
                              </Button>

                              {/* Delete User */}
                              <Button
                                size='sm'
                                variant='destructive'
                                onClick={() => handleDelete(userData.userId)}
                                disabled={
                                  actionLoading ===
                                    `delete-${userData.userId}` ||
                                  userData.userId === user?.id
                                }
                                className='min-w-0'
                                title='Delete User'
                              >
                                {actionLoading ===
                                `delete-${userData.userId}` ? (
                                  <RefreshCw className='w-3 h-3 sm:w-4 sm:h-4 animate-spin' />
                                ) : (
                                  <Trash2 className='w-3 h-3 sm:w-4 sm:h-4' />
                                )}
                                <span className='ml-1 text-xs sm:hidden'>
                                  Delete
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Mobile-Responsive Detailed User View Modal */}
      {showDetailedView && selectedUser && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm safe-area-full'>
          <Card className='w-full max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-gray-900 border-gray-600 flex flex-col shadow-2xl'>
            {/* Enhanced Header */}
            <CardHeader className='flex-shrink-0 pb-3 sm:pb-6 border-b border-gray-700/50'>
              <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  {selectedUser.imageUrl ? (
                    <Image
                      src={selectedUser.imageUrl}
                      alt={selectedUser.name}
                      width={56}
                      height={56}
                      className='w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 border-2 border-blue-500/30'
                    />
                  ) : (
                    <div className='w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-xl flex-shrink-0 border-2 border-blue-500/30'>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <CardTitle className='text-white text-base sm:text-xl truncate font-semibold'>
                      {selectedUser.name}
                    </CardTitle>
                    <CardDescription className='text-sm sm:text-base truncate text-gray-300'>
                      {selectedUser.email}
                    </CardDescription>
                    <div className='flex items-center gap-2 mt-1'>
                      {getStatusBadge(selectedUser)}
                    </div>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowDetailedView(false)}
                  className='flex-shrink-0 hover:bg-gray-700/50'
                >
                  <EyeOff className='w-4 h-4' />
                  <span className='ml-2 text-sm'>Close</span>
                </Button>
              </div>
            </CardHeader>

            {/* Enhanced Content Area */}
            <CardContent className='flex-1 overflow-hidden p-0'>
              <Tabs
                defaultValue='profile'
                className='w-full h-full flex flex-col'
              >
                {/* Enhanced Tab Navigation - Mobile Optimized */}
                <div className='flex-shrink-0 border-b border-gray-700/30 bg-gray-800/20'>
                  <TabsList className='grid grid-cols-4 w-full h-auto bg-transparent rounded-none p-0'>
                    <TabsTrigger
                      value='profile'
                      className='flex flex-col items-center justify-center py-3 px-2 text-gray-300 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400 hover:bg-gray-700/30 transition-all duration-200 min-h-[60px]'
                    >
                      <UserCog className='w-4 h-4 mb-1' />
                      <span className='text-xs font-medium'>Profile</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='subscription'
                      className='flex flex-col items-center justify-center py-3 px-2 text-gray-300 rounded-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400 hover:bg-gray-700/30 transition-all duration-200 min-h-[60px]'
                    >
                      <CreditCard className='w-4 h-4 mb-1' />
                      <span className='text-xs font-medium'>Sub</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='stripe'
                      className='flex flex-col items-center justify-center py-3 px-2 text-gray-300 rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 hover:bg-gray-700/30 transition-all duration-200 min-h-[60px]'
                    >
                      <CreditCard className='w-4 h-4 mb-1' />
                      <span className='text-xs font-medium'>Stripe</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='clerk'
                      className='flex flex-col items-center justify-center py-3 px-2 text-gray-300 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 hover:bg-gray-700/30 transition-all duration-200 min-h-[60px]'
                    >
                      <Users className='w-4 h-4 mb-1' />
                      <span className='text-xs font-medium'>Clerk</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Enhanced Tab Content */}
                <div className='flex-1 overflow-hidden'>
                  <ScrollArea className='h-full'>
                    <div className='p-4 sm:p-6'>
                      <TabsContent value='profile' className='mt-0 space-y-6'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6'>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              User ID
                            </label>
                            <p className='text-white font-mono text-sm bg-gray-900/50 p-2 rounded border break-all'>
                              {selectedUser.userId}
                            </p>
                          </div>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              Name
                            </label>
                            <p className='text-white text-sm'>
                              {selectedUser.name}
                            </p>
                          </div>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              Email
                            </label>
                            <p className='text-white text-sm break-all'>
                              {selectedUser.email}
                            </p>
                          </div>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              Admin Status
                            </label>
                            <div className='flex items-center gap-2'>
                              {selectedUser.isAdmin ? (
                                <Crown className='w-4 h-4 text-red-400' />
                              ) : (
                                <Users className='w-4 h-4 text-gray-400' />
                              )}
                              <p className='text-white text-sm'>
                                {selectedUser.isAdmin
                                  ? 'Admin User'
                                  : 'Regular User'}
                              </p>
                            </div>
                          </div>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              Account Created
                            </label>
                            <p className='text-white text-sm'>
                              {formatDate(selectedUser.createdAt)}
                            </p>
                          </div>
                          <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                            <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                              Last Updated
                            </label>
                            <p className='text-white text-sm'>
                              {formatDate(selectedUser.updatedAt)}
                            </p>
                          </div>
                          {selectedUser.lastActiveAt && (
                            <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                              <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                Last Active
                              </label>
                              <p className='text-white text-sm'>
                                {formatDate(selectedUser.lastActiveAt)}
                              </p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent
                        value='subscription'
                        className='mt-0 space-y-6'
                      >
                        {selectedUser.subscription ? (
                          <div className='space-y-6'>
                            {/* Subscription Overview */}
                            <div className='bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-6 border border-green-500/20'>
                              <h3 className='text-lg font-semibold text-white mb-4 flex items-center gap-2'>
                                <CheckCircle className='w-5 h-5 text-green-400' />
                                Active Subscription
                              </h3>
                              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                                <div>
                                  <label className='text-sm font-medium text-gray-300 mb-1 block'>
                                    Product Name
                                  </label>
                                  <p className='text-white font-semibold text-lg'>
                                    {selectedUser.subscription.productName}
                                  </p>
                                </div>
                                <div>
                                  <label className='text-sm font-medium text-gray-300 mb-1 block'>
                                    Plan Name
                                  </label>
                                  <p className='text-white font-semibold text-lg'>
                                    {selectedUser.subscription.planName}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Subscription Details */}
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                              <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                  Status
                                </label>
                                <div className='flex items-center gap-2'>
                                  <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                                  <p className='text-white capitalize font-medium'>
                                    {selectedUser.subscription.status}
                                  </p>
                                </div>
                              </div>
                              <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                  Renewal Date
                                </label>
                                <p className='text-white text-sm'>
                                  {formatDate(
                                    selectedUser.subscription.currentPeriodEnd
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Stripe Information */}
                            <div className='bg-gray-800/20 rounded-lg p-4 border border-gray-700/30'>
                              <h4 className='text-white font-semibold text-base mb-4 flex items-center gap-2'>
                                <CreditCard className='w-4 h-4' />
                                Stripe Details
                              </h4>
                              <div className='space-y-3'>
                                <div>
                                  <label className='text-sm font-medium text-gray-400 mb-1 block'>
                                    Subscription ID
                                  </label>
                                  <p className='text-white font-mono text-xs bg-gray-900/50 p-2 rounded border break-all'>
                                    {selectedUser.subscription.subscriptionId ||
                                      'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <label className='text-sm font-medium text-gray-400 mb-1 block'>
                                    Customer ID
                                  </label>
                                  <p className='text-white font-mono text-xs bg-gray-900/50 p-2 rounded border break-all'>
                                    {selectedUser.subscription.customerId ||
                                      'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className='text-center py-12'>
                            <XCircle className='mx-auto h-16 w-16 text-gray-400 mb-4' />
                            <h3 className='text-lg font-semibold text-gray-300 mb-2'>
                              No Subscription
                            </h3>
                            <p className='text-gray-400 text-sm'>
                              This user doesn't have an active subscription
                            </p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value='stripe' className='mt-0 space-y-6'>
                        {selectedUser.stripeCustomer ? (
                          <div className='space-y-6'>
                            <div className='bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6 border border-purple-500/20'>
                              <h3 className='text-lg font-semibold text-white mb-4 flex items-center gap-2'>
                                <CreditCard className='w-5 h-5 text-purple-400' />
                                Stripe Customer
                              </h3>
                              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Customer ID
                                  </label>
                                  <p className='text-white font-mono text-sm break-all'>
                                    {selectedUser.stripeCustomer.id}
                                  </p>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Email
                                  </label>
                                  <p className='text-white text-sm break-all'>
                                    {selectedUser.stripeCustomer.email}
                                  </p>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Created
                                  </label>
                                  <p className='text-white text-sm'>
                                    {formatDate(
                                      selectedUser.stripeCustomer.created * 1000
                                    )}
                                  </p>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Subscriptions
                                  </label>
                                  <p className='text-white text-sm'>
                                    {selectedUser.stripeCustomer.subscriptions
                                      ?.length || 0}{' '}
                                    active
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className='text-center py-12'>
                            <XCircle className='mx-auto h-16 w-16 text-gray-400 mb-4' />
                            <h3 className='text-lg font-semibold text-gray-300 mb-2'>
                              No Stripe Data
                            </h3>
                            <p className='text-gray-400 text-sm'>
                              No Stripe customer information available
                            </p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value='clerk' className='mt-0 space-y-6'>
                        {selectedUser.clerkData ? (
                          <div className='space-y-6'>
                            <div className='bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg p-6 border border-orange-500/20'>
                              <h3 className='text-lg font-semibold text-white mb-4 flex items-center gap-2'>
                                <Users className='w-5 h-5 text-orange-400' />
                                Clerk Authentication
                              </h3>
                              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Clerk ID
                                  </label>
                                  <p className='text-white font-mono text-sm break-all'>
                                    {selectedUser.clerkData.id}
                                  </p>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Username
                                  </label>
                                  <p className='text-white text-sm'>
                                    {selectedUser.clerkData.username || 'N/A'}
                                  </p>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Password Auth
                                  </label>
                                  <div className='flex items-center gap-2'>
                                    {selectedUser.clerkData.passwordEnabled ? (
                                      <CheckCircle className='w-4 h-4 text-green-400' />
                                    ) : (
                                      <XCircle className='w-4 h-4 text-red-400' />
                                    )}
                                    <p className='text-white text-sm'>
                                      {selectedUser.clerkData.passwordEnabled
                                        ? 'Enabled'
                                        : 'Disabled'}
                                    </p>
                                  </div>
                                </div>
                                <div className='bg-gray-800/30 rounded-lg p-4 border border-gray-700/30'>
                                  <label className='text-sm font-semibold text-gray-300 mb-2 block'>
                                    Last Sign In
                                  </label>
                                  <p className='text-white text-sm'>
                                    {selectedUser.clerkData.lastSignInAt
                                      ? formatDate(
                                          selectedUser.clerkData.lastSignInAt
                                        )
                                      : 'Never'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className='text-center py-12'>
                            <AlertTriangle className='mx-auto h-16 w-16 text-yellow-400 mb-4' />
                            <h3 className='text-lg font-semibold text-yellow-400 mb-2'>
                              Clerk Data Unavailable
                            </h3>
                            <p className='text-gray-400 text-sm max-w-md mx-auto'>
                              This user may have been deleted from Clerk or
                              there was an error fetching their authentication
                              data.
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    </div>
                  </ScrollArea>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
