"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  Phone, 
  Lock, 
  User, 
  Edit, 
  Shield,
  CheckCircle,
  AlertTriangle,
  Key,
  ExternalLink
} from "lucide-react";

export function DiscordProfile() {
  const { user } = useUser();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Fetch profile data from our database to get accurate 2FA status
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const response = await fetch('/api/user/profile');
          if (response.ok) {
            const data = await response.json();
            setProfileData(data);
          }
        } catch (error) {
          console.error('Failed to fetch profile data:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
  const primaryPhone = user.phoneNumbers.find(phone => phone.id === user.primaryPhoneNumberId);
  const isEmailVerified = primaryEmail?.verification?.status === "verified";
  
  // Check authentication methods
  const hasPassword = user.passwordEnabled;
  const oauthAccounts = user.externalAccounts || [];
  const googleAccount = oauthAccounts.find(account => account.provider === "oauth_google");
  const hasOAuthOnly = oauthAccounts.length > 0 && !hasPassword;

  // Determine password display based on authentication method
  const getPasswordDisplay = () => {
    if (hasOAuthOnly) {
      return {
        text: "OAuth Authentication",
        subtitle: `Authenticated via ${oauthAccounts.map(acc => acc.provider.replace('oauth_', '')).join(', ')}`,
        isOAuth: true
      };
    } else if (hasPassword) {
      return {
        text: "••••••••••",
        subtitle: "Password-based authentication",
        isOAuth: false
      };
    } else {
      return {
        text: "No password set",
        subtitle: "Set up a password for additional security",
        isOAuth: false
      };
    }
  };

  const passwordInfo = getPasswordDisplay();

  const handlePasswordAction = () => {
    // Always redirect to the same password management page
    // The page will handle different scenarios based on user's current state
    window.open('/user/password', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* User Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="relative">
              <img
                src={user.imageUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-20 h-20 rounded-full border-4 border-gray-200 dark:border-gray-700"
              />
              {/* Online status indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
              {/* OAuth indicator if applicable */}
              {googleAccount && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full border-2 border-gray-200 flex items-center justify-center">
                  <svg className="w-3 h-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </h2>
                                 <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open('/user-profile', '_blank')}>
                   <Edit className="h-3 w-3" />
                 </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-mono">@{user.username || user.firstName?.toLowerCase()}</span>
                <Badge variant="outline" className="text-xs">
                  {user.id.substring(0, 8)}...
                </Badge>
                {/* Authentication method badge */}
                {hasOAuthOnly ? (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                    OAuth
                  </Badge>
                ) : hasPassword ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                    Secure
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                    Incomplete
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Account Information
          </h3>
          
          <div className="space-y-4">
            {/* Email Address */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      EMAIL ADDRESS
                    </span>
                    {isEmailVerified ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        VERIFIED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        UNVERIFIED
                      </Badge>
                    )}
                    {googleAccount && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                        Google
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-900 dark:text-white">
                    {primaryEmail?.emailAddress || 'No email set'}
                  </p>
                </div>
              </div>
                             <Button variant="ghost" size="sm" onClick={() => window.open('/user-profile#email', '_blank')}>
                 <Edit className="h-4 w-4" />
               </Button>
            </div>

            {/* Phone Number */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    PHONE NUMBER
                  </span>
                  <p className="text-gray-900 dark:text-white">
                    {primaryPhone?.phoneNumber || 'Not Set'}
                  </p>
                </div>
              </div>
                             <Button variant="ghost" size="sm" onClick={() => window.open('/user-profile#phone', '_blank')}>
                 <Edit className="h-4 w-4" />
               </Button>
            </div>

            {/* Password / Authentication */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  passwordInfo.isOAuth 
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : hasPassword 
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {passwordInfo.isOAuth ? (
                    <Key className={`h-4 w-4 text-blue-600 dark:text-blue-400`} />
                  ) : (
                    <Lock className={`h-4 w-4 ${
                      hasPassword 
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {passwordInfo.isOAuth ? 'AUTHENTICATION' : 'PASSWORD'}
                    </span>
                    {passwordInfo.isOAuth && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                        <Shield className="h-3 w-3 mr-1" />
                        OAUTH
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900 dark:text-white font-mono">
                      {passwordInfo.text}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {passwordInfo.subtitle}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handlePasswordAction}>
                {passwordInfo.isOAuth ? (
                  <ExternalLink className="h-4 w-4" />
                ) : (
                  <Edit className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Username */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                    USERNAME
                  </span>
                  <p className="text-gray-900 dark:text-white">
                    {user.username || user.firstName?.toLowerCase() || 'Not set'}
                  </p>
                </div>
              </div>
                             <Button variant="ghost" size="sm" onClick={() => window.open('/user-profile#username', '_blank')}>
                 <Edit className="h-4 w-4" />
               </Button>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Account Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                MEMBER SINCE
              </div>
              <div className="text-gray-900 dark:text-white">
                {new Date(user.createdAt!).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LAST ACTIVE
              </div>
              <div className="text-gray-900 dark:text-white">
                {new Date(user.lastSignInAt!).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Methods */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Authentication Methods
          </h3>
          
          <div className="space-y-3">
            {/* Password Authentication */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Lock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Password Authentication
                </span>
              </div>
              <Badge variant={hasPassword ? "default" : "outline"}>
                {hasPassword ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {/* OAuth Providers */}
            {oauthAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.provider.replace('oauth_', '').toUpperCase()} OAuth
                  </span>
                </div>
                <Badge variant="default">
                  Connected
                </Badge>
              </div>
            ))}

            {/* Two-Factor Authentication */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Two-Factor Authentication
                </span>
              </div>
              {isLoadingProfile ? (
                <Badge variant="outline">Loading...</Badge>
              ) : (
                <Badge variant={profileData?.twoFactorEnabled ? "default" : "outline"}>
                  {profileData?.twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              )}
            </div>
            
            {/* Email Verification */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Email Verification
                </span>
              </div>
              <Badge variant={isEmailVerified ? "default" : "outline"}>
                {isEmailVerified ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>

          {/* Security Recommendations */}
          {(!hasPassword && oauthAccounts.length > 0) && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <Shield className="h-4 w-4 inline mr-2" />
                <strong>Security Tip:</strong> Consider adding a password for additional security, even with OAuth authentication.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 