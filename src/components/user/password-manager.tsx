"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Key,
  ExternalLink
} from "lucide-react";
import { showToast } from "@/lib/notifications";

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<any>(null);

  const hasPassword = user?.passwordEnabled;
  const oauthAccounts = user?.externalAccounts || [];
  const hasOAuthOnly = oauthAccounts.length > 0 && !hasPassword;

  // Check password requirements
  const checkRequirements = (password: string): PasswordRequirements => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  });

  const requirements = checkRequirements(newPassword);
  const allRequirementsMet = Object.values(requirements).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  // Fetch password status on component mount
  useEffect(() => {
    const fetchPasswordStatus = async () => {
      try {
        const response = await fetch('/api/user/password');
        if (response.ok) {
          const data = await response.json();
          setPasswordStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch password status:', error);
      }
    };

    if (user) {
      fetchPasswordStatus();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!allRequirementsMet || !passwordsMatch) {
      showToast.error("Please fix the password requirements before continuing.");
      return;
    }

    if (hasPassword && !currentPassword) {
      showToast.error("Current password is required to change your password.");
      return;
    }

    setIsLoading(true);

    try {
      const action = hasPassword ? 'change' : 'add';
      
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success(data.message);
        
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // Refresh user data
        window.location.reload();
      } else {
        showToast.error(data.error || 'Failed to update password');
      }
    } catch (error) {
      console.error('Password update error:', error);
      showToast.error('An unexpected error occurred. Please try again.');
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
      <span className={`text-sm ${met ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
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
              : "Set up a password for your account"
          }
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
                <Lock className={`h-4 w-4 ${hasPassword ? 'text-green-600' : 'text-gray-400'}`} />
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
                  <Key className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.provider.replace('oauth_', '').toUpperCase()} OAuth
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
                You're currently using OAuth authentication only. Adding a password provides an additional layer of security.
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
            {/* Current Password (only if user has a password) */}
            {hasPassword && (
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
                  <span className={`text-sm ${passwordsMatch ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {passwordsMatch ? "Passwords match" : "Passwords don't match"}
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
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
            >
              {isLoading ? (
                "Updating..."
              ) : hasPassword ? (
                "Update Password"
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security Note */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Security Notice</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Your password is encrypted and stored securely using industry-standard practices. 
                We never store passwords in plain text, and they cannot be recovered by our support team.
              </p>
              {hasOAuthOnly && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  Even with OAuth authentication, having a password provides backup access to your account.
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
              <h4 className="font-medium text-gray-900 dark:text-white">Advanced Settings</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage additional account settings and security options
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.open('/user-profile', '_blank')}
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