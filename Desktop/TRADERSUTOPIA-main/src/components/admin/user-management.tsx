"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Search, 
  Crown, 
  Shield, 
  Trash2, 
  UserPlus, 
  CreditCard, 
  Calendar, 
  Mail, 
  Phone, 
  Activity,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Database
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
  twoFactorEnabled: boolean;
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

export function UserManagement() {
  const { user } = useUser();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
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

  const handleDeleteAccount = async (userId: string) => {
    if (!confirm('Are you sure you want to DELETE this user account? This action cannot be undone and will remove ALL user data.')) {
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
        showToast.success('Account Deleted', 'User account has been permanently deleted');
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

  const handleDeleteSubscription = async (userId: string) => {
    if (!confirm('Are you sure you want to cancel this user\'s subscription? They will lose access immediately.')) {
      return;
    }

    setActionLoading(`subscription-${userId}`);
    try {
      const response = await makeSecureRequest('/api/admin/users/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Refresh user data
        await fetchUsers();
        showToast.success('Subscription Cancelled', 'User subscription has been cancelled');
      } else {
        const error = await response.json();
        showToast.error('Cancellation Failed', error.message);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showToast.error('Error', 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantSubscription = async (userId: string) => {
    if (!confirm('Grant subscription access to this user? They will get immediate access to premium features.')) {
      return;
    }

    setActionLoading(`grant-${userId}`);
    try {
      const response = await makeSecureRequest('/api/admin/users/grant-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Refresh user data
        await fetchUsers();
        showToast.success('Access Granted', 'User now has subscription access');
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

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    const action = isCurrentlyAdmin ? 'revoke' : 'grant';
    if (!confirm(`${action === 'grant' ? 'Grant' : 'Revoke'} admin privileges ${action === 'grant' ? 'to' : 'from'} this user?`)) {
      return;
    }

    setActionLoading(`admin-${userId}`);
    try {
      const response = await makeSecureRequest('/api/admin/users/toggle-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, grantAdmin: !isCurrentlyAdmin }),
      });

      if (response.ok) {
        // Refresh user data
        await fetchUsers();
        showToast.success('Admin Status Updated', `User is now ${!isCurrentlyAdmin ? 'an admin' : 'a regular user'}`);
      } else {
        const error = await response.json();
        showToast.error('Update Failed', error.message);
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      showToast.error('Error', 'Failed to update admin status');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string | number) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const getStatusBadge = (user: UserData) => {
    if (user.isAdmin) {
      return <Badge className="bg-red-600 text-white"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
    }
    if (user.subscription?.status === 'active') {
      return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />{user.subscription.planName || 'Premium'}</Badge>;
    }
    return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Free</Badge>;
  };

  if (!user) return null;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Users className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">User Management</h3>
            <p className="text-gray-400 text-sm">Manage all registered users and their data</p>
          </div>
        </div>
        <Button onClick={fetchUsers} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Database className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Loading...' : 'Load Users'}
        </Button>
      </div>

      {users.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by name, email, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-600 text-white"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gray-800/50 border-gray-600">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-400">{users.length}</div>
                <div className="text-xs text-gray-400">Total Users</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-600">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-400">
                  {users.filter(u => u.subscription?.status === 'active').length}
                </div>
                <div className="text-xs text-gray-400">Active Subscriptions</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-600">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-400">
                  {users.filter(u => u.isAdmin).length}
                </div>
                <div className="text-xs text-gray-400">Admins</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-600">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-400">
                  {users.filter(u => u.twoFactorEnabled).length}
                </div>
                <div className="text-xs text-gray-400">2FA Enabled</div>
              </CardContent>
            </Card>
          </div>

          {/* Users List */}
          <Card className="bg-gray-800/50 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <Card key={user.id} className="bg-gray-900/50 border-gray-600 hover:border-gray-500 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {user.imageUrl ? (
                              <img src={user.imageUrl} alt={user.name} className="w-10 h-10 rounded-full" />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-white">{user.name}</h4>
                                {getStatusBadge(user)}
                              </div>
                              <p className="text-sm text-gray-400">{user.email}</p>
                              {user.subscription?.productName && (
                                <p className="text-xs text-blue-400 font-medium">{user.subscription.productName}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <span>ID: {user.userId.substring(0, 8)}...</span>
                                <span>Joined: {formatDistanceToNow(new Date(user.createdAt))} ago</span>
                                {user.lastActiveAt && (
                                  <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(user.lastActiveAt))} ago
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDetailedView(true);
                              }}
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            
                            {/* Quick Actions */}
                            <div className="flex gap-1">
                              {user.subscription?.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteSubscription(user.userId)}
                                  disabled={actionLoading === `subscription-${user.userId}`}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  {actionLoading === `subscription-${user.userId}` ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CreditCard className="w-3 h-3" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleGrantSubscription(user.userId)}
                                  disabled={actionLoading === `grant-${user.userId}`}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {actionLoading === `grant-${user.userId}` ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserPlus className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                variant={user.isAdmin ? "destructive" : "default"}
                                onClick={() => handleToggleAdmin(user.userId, user.isAdmin)}
                                disabled={actionLoading === `admin-${user.userId}` || user.userId === user.id}
                                className={user.isAdmin ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}
                              >
                                {actionLoading === `admin-${user.userId}` ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Crown className="w-3 h-3" />
                                )}
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteAccount(user.userId)}
                                disabled={actionLoading === `delete-${user.userId}` || user.userId === user.id}
                              >
                                {actionLoading === `delete-${user.userId}` ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
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

      {/* Detailed User View Modal */}
      {showDetailedView && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] bg-gray-900 border-gray-600">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedUser.imageUrl ? (
                  <img src={selectedUser.imageUrl} alt={selectedUser.name} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <CardTitle className="text-white">{selectedUser.name}</CardTitle>
                  <CardDescription>{selectedUser.email}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setShowDetailedView(false)}>
                <EyeOff className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="subscription">Subscription</TabsTrigger>
                    <TabsTrigger value="stripe">Stripe Data</TabsTrigger>
                    <TabsTrigger value="clerk">Clerk Data</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="profile" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-400">User ID</label>
                        <p className="text-white font-mono text-sm">{selectedUser.userId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Name</label>
                        <p className="text-white">{selectedUser.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Email</label>
                        <p className="text-white">{selectedUser.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Admin Status</label>
                        <p className="text-white">{selectedUser.isAdmin ? 'Admin' : 'Regular User'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">2FA Enabled</label>
                        <p className="text-white">{selectedUser.twoFactorEnabled ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Created</label>
                        <p className="text-white">{formatDate(selectedUser.createdAt)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Last Updated</label>
                        <p className="text-white">{formatDate(selectedUser.updatedAt)}</p>
                      </div>
                      {selectedUser.lastActiveAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-400">Last Active</label>
                          <p className="text-white">{formatDate(selectedUser.lastActiveAt)}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="subscription" className="space-y-6">
                    {selectedUser.subscription ? (
                      <div className="space-y-6">
                        {/* Subscription Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Product Name</label>
                            <p className="text-white font-semibold text-lg">{selectedUser.subscription.productName}</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Plan Name</label>
                            <p className="text-white font-semibold text-lg">{selectedUser.subscription.planName}</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Subscription Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Status</label>
                            <p className="text-white capitalize font-medium">{selectedUser.subscription.status}</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Current Period End</label>
                            <p className="text-white">{formatDate(selectedUser.subscription.currentPeriodEnd)}</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Stripe IDs */}
                        <div className="space-y-4">
                          <h4 className="text-white font-medium text-lg">Stripe Information</h4>
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-400">Subscription ID</label>
                              <p className="text-white font-mono text-sm bg-gray-800 p-2 rounded break-all">
                                {selectedUser.subscription.subscriptionId || 'N/A'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-400">Customer ID</label>
                              <p className="text-white font-mono text-sm bg-gray-800 p-2 rounded break-all">
                                {selectedUser.subscription.customerId || 'N/A'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-400">Product ID</label>
                              <p className="text-white font-mono text-sm bg-gray-800 p-2 rounded break-all">
                                {selectedUser.subscription.productId || 'N/A'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-400">Price ID</label>
                              <p className="text-white font-mono text-sm bg-gray-800 p-2 rounded break-all">
                                {selectedUser.subscription.priceId || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Created</label>
                            <p className="text-white">{formatDate(selectedUser.subscription.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No subscription data found for this user.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="stripe" className="space-y-4">
                    {selectedUser.stripeCustomer ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Stripe Customer ID</label>
                            <p className="text-white font-mono text-sm">{selectedUser.stripeCustomer.id}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Email</label>
                            <p className="text-white">{selectedUser.stripeCustomer.email}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Name</label>
                            <p className="text-white">{selectedUser.stripeCustomer.name || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Created</label>
                            <p className="text-white">{formatDate(selectedUser.stripeCustomer.created * 1000)}</p>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Subscriptions ({selectedUser.stripeCustomer.subscriptions.length})</h4>
                          {selectedUser.stripeCustomer.subscriptions.length > 0 ? (
                            <div className="space-y-2">
                              {selectedUser.stripeCustomer.subscriptions.map((sub: any, index: number) => (
                                <div key={index} className="bg-gray-800 p-3 rounded">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>Status: <span className="text-white">{sub.status}</span></div>
                                    <div>ID: <span className="text-white font-mono">{sub.id}</span></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm">No subscriptions found</p>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Payment Methods ({selectedUser.stripeCustomer.paymentMethods.length})</h4>
                          {selectedUser.stripeCustomer.paymentMethods.length > 0 ? (
                            <div className="space-y-2">
                              {selectedUser.stripeCustomer.paymentMethods.map((pm: any, index: number) => (
                                <div key={index} className="bg-gray-800 p-3 rounded">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>Type: <span className="text-white">{pm.type}</span></div>
                                    <div>ID: <span className="text-white font-mono">{pm.id}</span></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm">No payment methods found</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No Stripe customer data found for this user.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="clerk" className="space-y-4">
                    {selectedUser.clerkData ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Clerk User ID</label>
                            <p className="text-white font-mono text-sm">{selectedUser.clerkData.id}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Username</label>
                            <p className="text-white">{selectedUser.clerkData.username || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">First Name</label>
                            <p className="text-white">{selectedUser.clerkData.firstName || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Last Name</label>
                            <p className="text-white">{selectedUser.clerkData.lastName || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Password Enabled</label>
                            <p className="text-white">{selectedUser.clerkData.passwordEnabled ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Created</label>
                            <p className="text-white">{formatDate(selectedUser.clerkData.createdAt)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Updated</label>
                            <p className="text-white">{formatDate(selectedUser.clerkData.updatedAt)}</p>
                          </div>
                          {selectedUser.clerkData.lastSignInAt && (
                            <div>
                              <label className="text-sm font-medium text-gray-400">Last Sign In</label>
                              <p className="text-white">{formatDate(selectedUser.clerkData.lastSignInAt)}</p>
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Email Addresses ({selectedUser.clerkData.emailAddresses.length})</h4>
                          {selectedUser.clerkData.emailAddresses.map((email: any, index: number) => (
                            <div key={index} className="bg-gray-800 p-3 rounded mb-2">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Email: <span className="text-white">{email.emailAddress}</span></div>
                                <div>Verified: <span className="text-white">{email.verification?.status === 'verified' ? 'Yes' : 'No'}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Phone Numbers ({selectedUser.clerkData.phoneNumbers.length})</h4>
                          {selectedUser.clerkData.phoneNumbers.length > 0 ? (
                            selectedUser.clerkData.phoneNumbers.map((phone: any, index: number) => (
                              <div key={index} className="bg-gray-800 p-3 rounded mb-2">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>Phone: <span className="text-white">{phone.phoneNumber}</span></div>
                                  <div>Verified: <span className="text-white">{phone.verification?.status === 'verified' ? 'Yes' : 'No'}</span></div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No phone numbers found</p>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">External Accounts ({selectedUser.clerkData.externalAccounts.length})</h4>
                          {selectedUser.clerkData.externalAccounts.length > 0 ? (
                            selectedUser.clerkData.externalAccounts.map((account: any, index: number) => (
                              <div key={index} className="bg-gray-800 p-3 rounded mb-2">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>Provider: <span className="text-white">{account.provider}</span></div>
                                  <div>ID: <span className="text-white font-mono">{account.id}</span></div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No external accounts found</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No Clerk data found for this user.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 