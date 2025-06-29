"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Key,
  ExternalLink,
  Smartphone,
  HelpCircle,
} from "lucide-react";
import { showToast } from "@/lib/notifications-client";
import { makeSecureRequest } from "@/lib/csrf-client";

interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
}

export function PasswordManager() {
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<any>(null);
  const [authMethod, setAuthMethod] = useState<"password" | "2fa">("password");

  const hasPassword = user?.passwordEnabled;
  const oauthAccounts = user?.externalAccounts || [];
  const hasOAuthOnly = oauthAccounts.length > 0 && !hasPassword;

  // Check password requirements
  const checkRequirements = (password: string): PasswordRequirements => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  });

  const requirements = checkRequirements(newPassword);
  const allRequirementsMet = Object.values(requirements).every(Boolean);
  const passwordsMatch =
    newPassword === confirmPassword && newPassword.length > 0;
  const is2FACodeValid =
    twoFactorCode.length === 6 && /^\d{6}$/.test(twoFactorCode);

  // Fetch password status on component mount
  useEffect(() => {
    const fetchPasswordStatus = async () => {
      try {
        const response = await fetch("/api/user/password");
        if (response.ok) {
          const data = await response.json();
          setPasswordStatus(data);

          // If user doesn't have 2FA enabled, default to password auth
          if (!data.has2FA && hasPassword) {
            setAuthMethod("password");
          }
        }
      } catch (error) {
        console.error("Failed to fetch password status:", error);
      }
    };

    if (user) {
      fetchPasswordStatus();
    }
  }, [user, hasPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRequirementsMet || !passwordsMatch) {
      showToast.error(
        "Please fix the password requirements before continuing.",
      );
      return;
    }

    // Validation based on authentication method
    if (hasPassword) {
      if (authMethod === "password" && !currentPassword) {
        showToast.error(
          "Current password is required to change your password.",
        );
        return;
      }

      if (authMethod === "2fa" && !is2FACodeValid) {
        showToast.error(
          "Please enter a valid 6-digit 2FA code from your authenticator app.",
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const action = hasPassword ? "change" : "add";

      const requestBody = {
        action,
        newPassword,
        ...(hasPassword && authMethod === "password" && { currentPassword }),
        ...(hasPassword &&
          authMethod === "2fa" && {
            twoFactorCode,
            use2FA: true,
          }),
      };

      const response = await makeSecureRequest("/api/user/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success(data.message);

        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTwoFactorCode("");

        // Show additional success info
        if (data.authMethod) {
          showToast.success(
            `Password updated using ${data.authMethod === "2FA" ? "2FA verification" : "current password"}`,
          );
        }

        // Refresh after success
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast.error(data.error || "Failed to update password");
      }
    } catch (error) {
      console.error("Password update error:", error);
      showToast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center space-x-2">
      {met ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span
        className={`text-sm ${met ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
      >
        {text}
      </span>
    </div>
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Password Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {hasOAuthOnly
            ? "Add a password for enhanced security"
            : hasPassword
              ? "Update your account password"
              : "Set up a password for your account"}
        </p>
      </div>

      {/* Current Authentication Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current Authentication Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Password Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Lock
                  className={`h-4 w-4 ${hasPassword ? "text-green-600" : "text-gray-400"}`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Password Authentication
                </span>
              </div>
              <Badge variant={hasPassword ? "default" : "outline"}>
                {hasPassword ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {/* 2FA Status */}
            {passwordStatus && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone
                    className={`h-4 w-4 ${passwordStatus.has2FA ? "text-green-600" : "text-gray-400"}`}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Two-Factor Authentication
                  </span>
                </div>
                <Badge variant={passwordStatus.has2FA ? "default" : "outline"}>
                  {passwordStatus.has2FA ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            )}

            {/* OAuth Providers */}
            {oauthAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <Key className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.provider.replace("oauth_", "").toUpperCase()} OAuth
                  </span>
                </div>
                <Badge variant="default">Connected</Badge>
              </div>
            ))}
          </div>

          {hasOAuthOnly && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're currently using OAuth authentication only. Adding a
                password provides an additional layer of security.
              </AlertDescription>
            </Alert>
          )}

          {/* 2FA for Password Changes Info */}
          {passwordStatus?.canUse2FAForPasswordChange && (
            <Alert className="mt-4">
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <strong>Enhanced Security Available:</strong> You can use your
                2FA authenticator app instead of your current password to change
                your password. This is useful if you forgot your current
                password.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Password Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {hasPassword ? "Change Password" : "Set Password"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Authentication Method Selection (only for password changes with 2FA) */}
            {hasPassword && passwordStatus?.canUse2FAForPasswordChange && (
              <div className="space-y-3">
                <Label>Authentication Method</Label>
                <Tabs
                  value={authMethod}
                  onValueChange={(value) =>
                    setAuthMethod(value as "password" | "2fa")
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="password"
                      className="flex items-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      Current Password
                    </TabsTrigger>
                    <TabsTrigger
                      value="2fa"
                      className="flex items-center gap-2"
                    >
                      <Smartphone className="h-4 w-4" />
                      2FA Code
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="password" className="mt-4">
                    <Alert>
                      <Lock className="h-4 w-4" />
                      <AlertDescription>
                        Enter your current password to verify your identity
                        before changing it.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="2fa" className="mt-4">
                    <Alert>
                      <Smartphone className="h-4 w-4" />
                      <AlertDescription>
                        Use this option if you forgot your current password.
                        Enter the 6-digit code from your authenticator app.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Current Password (only if using password authentication) */}
            {hasPassword && authMethod === "password" && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* 2FA Code (only if using 2FA authentication) */}
            {hasPassword && authMethod === "2fa" && (
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">2FA Authentication Code</Label>
                <div className="relative">
                  <Input
                    id="twoFactorCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) =>
                      setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Enter 6-digit code from your authenticator app"
                    required
                    className="pr-10 text-center text-lg tracking-widest"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {is2FACodeValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : twoFactorCode.length > 0 ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <HelpCircle className="h-4 w-4" />
                  <span>
                    Open your authenticator app and enter the 6-digit code for
                    this account
                  </span>
                </div>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {hasPassword ? "New Password" : "Password"}
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>

              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className="flex items-center space-x-2">
                  {passwordsMatch ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${passwordsMatch ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
                  >
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </span>
                </div>
              )}
            </div>

            {/* Password Requirements */}
            {newPassword && (
              <div className="space-y-3">
                <Label>Password Requirements</Label>
                <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <RequirementItem
                    met={requirements.minLength}
                    text="At least 8 characters long"
                  />
                  <RequirementItem
                    met={requirements.hasUppercase}
                    text="Contains uppercase letter (A-Z)"
                  />
                  <RequirementItem
                    met={requirements.hasLowercase}
                    text="Contains lowercase letter (a-z)"
                  />
                  <RequirementItem
                    met={requirements.hasNumbers}
                    text="Contains number (0-9)"
                  />
                  <RequirementItem
                    met={requirements.hasSpecialChars}
                    text="Contains special character (!@#$%...)"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !allRequirementsMet ||
                !passwordsMatch ||
                (hasPassword &&
                  authMethod === "password" &&
                  !currentPassword) ||
                (hasPassword && authMethod === "2fa" && !is2FACodeValid)
              }
            >
              {isLoading
                ? "Updating..."
                : hasPassword
                  ? `Update Password ${authMethod === "2fa" ? "with 2FA" : "with Current Password"}`
                  : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Enhanced Security Notice */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Enhanced Security Notice
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Your password is encrypted and stored securely using
                industry-standard practices. We never store passwords in plain
                text, and they cannot be recovered by our support team.
              </p>
              {passwordStatus?.canUse2FAForPasswordChange && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  <strong>🔒 Enhanced Security:</strong> You can now use 2FA
                  authentication to change your password, providing an
                  additional layer of security even if you forget your current
                  password.
                </p>
              )}
              {hasOAuthOnly && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  Even with OAuth authentication, having a password provides
                  backup access to your account.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link to Clerk User Management */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Advanced Settings
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage additional account settings and security options
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open("/user-profile", "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              User Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
