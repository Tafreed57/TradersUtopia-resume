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
  ExternalLink,
  Crown,
  Star,
  Calendar,
  Clock,
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
          const response = await fetch("/api/user/profile");
          if (response.ok) {
            const data = await response.json();
            setProfileData(data);
          }
        } catch (error) {
          console.error("Failed to fetch profile data:", error);
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
          <div className="text-gray-400 text-lg">Loading profile...</div>
        </div>
      </div>
    );
  }

  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  const primaryPhone = user.phoneNumbers.find(
    (phone) => phone.id === user.primaryPhoneNumberId,
  );
  const isEmailVerified = primaryEmail?.verification?.status === "verified";

  // Check authentication methods
  const hasPassword = user.passwordEnabled;
  const oauthAccounts = user.externalAccounts || [];
  const googleAccount = oauthAccounts.find(
    (account) => account.provider === "oauth_google",
  );
  const hasOAuthOnly = oauthAccounts.length > 0 && !hasPassword;

  // Determine password display based on authentication method
  const getPasswordDisplay = () => {
    if (hasOAuthOnly) {
      return {
        text: "OAuth Authentication",
        subtitle: `Authenticated via ${oauthAccounts.map((acc) => acc.provider.replace("oauth_", "")).join(", ")}`,
        isOAuth: true,
      };
    } else if (hasPassword) {
      return {
        text: "••••••••••",
        subtitle: "Password-based authentication",
        isOAuth: false,
      };
    } else {
      return {
        text: "No password set",
        subtitle: "Set up a password for additional security",
        isOAuth: false,
      };
    }
  };

  const passwordInfo = getPasswordDisplay();

  const handlePasswordAction = () => {
    // Always redirect to the same password management page
    // The page will handle different scenarios based on user's current state
    window.open("/user/password", "_blank");
  };

  return (
    <div className="space-y-8">
      {/* Enhanced User Header */}
      <Card className="bg-gradient-to-br from-gray-700/50 via-gray-800/40 to-gray-900/50 border border-gray-600/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-400/10 overflow-hidden">
        <CardContent className="p-8">
          <div className="flex items-center space-x-6">
            {/* Enhanced Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-gradient-to-br from-yellow-400 to-yellow-600 shadow-2xl group-hover:scale-105 transition-transform duration-300">
                <img
                  src={user.imageUrl}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Enhanced online status indicator */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-4 border-gray-800 flex items-center justify-center shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              </div>
              {/* Enhanced OAuth indicator */}
              {googleAccount && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-white to-gray-100 rounded-full border-4 border-gray-800 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Enhanced User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-200 bg-clip-text text-transparent">
                  {user.firstName} {user.lastName}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-blue-500/20 hover:text-blue-400 transition-all duration-300"
                  onClick={() => window.open("/user-profile", "_blank")}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300 mb-4">
                <span className="font-mono bg-gray-700/50 px-3 py-1 rounded-lg">
                  @{user.username || user.firstName?.toLowerCase()}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs border-gray-500/50 text-gray-400"
                >
                  ID: {user.id.substring(0, 8)}...
                </Badge>
                {/* Enhanced authentication method badge */}
                {hasOAuthOnly ? (
                  <Badge className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500">
                    <Shield className="w-3 h-3 mr-1" />
                    OAuth Secure
                  </Badge>
                ) : hasPassword ? (
                  <Badge className="text-xs bg-gradient-to-r from-green-600 to-green-700 border-green-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Fully Secured
                  </Badge>
                ) : (
                  <Badge className="text-xs bg-gradient-to-r from-yellow-600 to-orange-600 border-yellow-500">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Setup Required
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Member since{" "}
                    {new Date(user.createdAt!).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    Last active{" "}
                    {new Date(user.lastSignInAt!).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Account Information */}
      <Card className="bg-gradient-to-br from-gray-700/50 via-gray-800/40 to-gray-900/50 border border-gray-600/30 backdrop-blur-md hover:border-purple-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-400/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              Account Information
            </h3>
          </div>

          <div className="space-y-6">
            {/* Enhanced Email Address */}
            <div className="group p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-400/30">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-300 tracking-wider">
                        EMAIL ADDRESS
                      </span>
                      {isEmailVerified ? (
                        <Badge className="text-xs bg-gradient-to-r from-green-600 to-green-700 border-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          VERIFIED
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-gradient-to-r from-red-600 to-red-700 border-red-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          UNVERIFIED
                        </Badge>
                      )}
                      {googleAccount && (
                        <Badge className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500">
                          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                          </svg>
                          Google
                        </Badge>
                      )}
                    </div>
                    <p className="text-white text-lg font-medium">
                      {primaryEmail?.emailAddress || "No email set"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-blue-500/20 hover:text-blue-400"
                  onClick={() => window.open("/user-profile#email", "_blank")}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Enhanced Phone Number */}
            <div className="group p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-400/30">
                    <Phone className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-300 tracking-wider block mb-2">
                      PHONE NUMBER
                    </span>
                    <p className="text-white text-lg font-medium">
                      {primaryPhone?.phoneNumber || "Not Set"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-green-500/20 hover:text-green-400"
                  onClick={() => window.open("/user-profile#phone", "_blank")}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Enhanced Password / Authentication */}
            <div
              className={`group p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-${passwordInfo.isOAuth ? "blue" : hasPassword ? "green" : "red"}-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-${passwordInfo.isOAuth ? "blue" : hasPassword ? "green" : "red"}-400/10`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-3 rounded-xl border ${
                      passwordInfo.isOAuth
                        ? "bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-400/30"
                        : hasPassword
                          ? "bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-400/30"
                          : "bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-400/30"
                    }`}
                  >
                    {passwordInfo.isOAuth ? (
                      <Key className={`h-5 w-5 text-blue-400`} />
                    ) : (
                      <Lock
                        className={`h-5 w-5 ${
                          hasPassword ? "text-green-400" : "text-red-400"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-300 tracking-wider">
                        {passwordInfo.isOAuth ? "AUTHENTICATION" : "PASSWORD"}
                      </span>
                      {passwordInfo.isOAuth && (
                        <Badge className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500">
                          <Shield className="h-3 w-3 mr-1" />
                          OAUTH SECURE
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-white text-lg font-medium font-mono">
                        {passwordInfo.text}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {passwordInfo.subtitle}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-${passwordInfo.isOAuth ? "blue" : hasPassword ? "green" : "red"}-500/20 hover:text-${passwordInfo.isOAuth ? "blue" : hasPassword ? "green" : "red"}-400`}
                  onClick={handlePasswordAction}
                >
                  {passwordInfo.isOAuth ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : (
                    <Edit className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Enhanced Username */}
            <div className="group p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-400/30">
                    <User className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-300 tracking-wider block mb-2">
                      USERNAME
                    </span>
                    <p className="text-white text-lg font-medium">
                      {user.username ||
                        user.firstName?.toLowerCase() ||
                        "Not set"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-purple-500/20 hover:text-purple-400"
                  onClick={() =>
                    window.open("/user-profile#username", "_blank")
                  }
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-8 bg-gray-600/30" />

          {/* Enhanced Account Stats */}
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-400" />
                <div className="text-sm font-semibold text-gray-300 tracking-wider">
                  MEMBER SINCE
                </div>
              </div>
              <div className="text-white text-xl font-bold">
                {new Date(user.createdAt!).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-green-400" />
                <div className="text-sm font-semibold text-gray-300 tracking-wider">
                  LAST ACTIVE
                </div>
              </div>
              <div className="text-white text-xl font-bold">
                {new Date(user.lastSignInAt!).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Authentication Methods */}
      <Card className="bg-gradient-to-br from-gray-700/50 via-gray-800/40 to-gray-900/50 border border-gray-600/30 backdrop-blur-md hover:border-yellow-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-yellow-400/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              Authentication Methods
            </h3>
          </div>

          <div className="space-y-4">
            {/* Enhanced Password Authentication */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <Lock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-300 font-medium">
                  Password Authentication
                </span>
              </div>
              <Badge
                variant={hasPassword ? "default" : "outline"}
                className={
                  hasPassword
                    ? "bg-gradient-to-r from-green-600 to-green-700 border-green-500"
                    : ""
                }
              >
                {hasPassword ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {/* Enhanced OAuth Providers */}
            {oauthAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-600/30 hover:border-blue-400/50 transition-all duration-300"
              >
                <div className="flex items-center space-x-4">
                  <Shield className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-gray-300 font-medium">
                    {account.provider.replace("oauth_", "").toUpperCase()} OAuth
                  </span>
                </div>
                <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500">
                  Connected
                </Badge>
              </div>
            ))}

            {/* Enhanced Two-Factor Authentication */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-600/30 hover:border-green-400/50 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="text-sm text-gray-300 font-medium">
                  Two-Factor Authentication
                </span>
              </div>
              {isLoadingProfile ? (
                <Badge variant="outline">Loading...</Badge>
              ) : (
                <Badge
                  variant={
                    profileData?.twoFactorEnabled ? "default" : "outline"
                  }
                  className={
                    profileData?.twoFactorEnabled
                      ? "bg-gradient-to-r from-green-600 to-green-700 border-green-500"
                      : ""
                  }
                >
                  {profileData?.twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              )}
            </div>

            {/* Enhanced Email Verification */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-600/30 hover:border-green-400/50 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-sm text-gray-300 font-medium">
                  Email Verification
                </span>
              </div>
              <Badge
                variant={isEmailVerified ? "default" : "outline"}
                className={
                  isEmailVerified
                    ? "bg-gradient-to-r from-green-600 to-green-700 border-green-500"
                    : ""
                }
              >
                {isEmailVerified ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>

          {/* Enhanced Security Recommendations */}
          {!hasPassword && oauthAccounts.length > 0 && (
            <div className="mt-6 p-6 bg-gradient-to-br from-yellow-600/20 via-orange-500/15 to-red-600/20 rounded-2xl border border-yellow-400/30 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Shield className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-yellow-200 font-semibold mb-2">
                    Security Recommendation
                  </p>
                  <p className="text-sm text-yellow-300">
                    Consider adding a password for additional security, even
                    with OAuth authentication enabled. This provides an extra
                    layer of protection for your account.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
