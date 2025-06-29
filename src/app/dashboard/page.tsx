import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { DiscordProfile } from "@/components/user/discord-profile";
import { ModeToggle } from "@/components/mode-toggler";
import { TwoFactorAuth } from "@/components/security/two-factor-auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { SubscriptionManager } from "@/components/subscription/subscription-manager";
import { SubscriptionProtectedLink } from "@/components/subscription-protected-link";
import { initProfile, getAllServers } from "@/lib/query";
import { redirect } from "next/navigation";
import { ProductPaymentGate } from "@/components/product-payment-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  User,
  Settings,
  MessageSquare,
  Crown,
  Users,
  Sparkles,
  Activity,
  TrendingUp,
  BarChart3,
  Home,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminButton } from "@/components/admin-button";
import { AutoJoinDefault } from "@/components/auto-join-default";

export default async function Dashboard() {
  const profile = await initProfile();
  console.log(profile);

  // Get user's servers but don't redirect - let them choose what to do
  const servers = await getAllServers(profile.id);

  // Configure which Stripe products are allowed for dashboard access
  const allowedProductIds = [
    "prod_SWIyAf2tfVrJao", // Your current product ID
    // Add more product IDs here as you create them
  ];

  return (
    <ProductPaymentGate
      allowedProductIds={allowedProductIds}
      productName="Premium Dashboard Access"
      upgradeUrl="https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01"
      features={[
        "Exclusive dashboard access",
        "Advanced server management",
        "Premium support",
        "Priority features",
      ]}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden">
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000"></div>
          <div className="absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000"></div>
        </div>

        <div className="relative z-10">
          <main className="max-w-[85rem] w-full mx-auto p-6">
            {/* Enhanced Header */}
            <header className="flex items-center justify-between w-full h-20 gap-4 mb-12 bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/30 px-8 shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                      Trading Dashboard
                    </h1>
                    <p className="text-gray-400 text-sm">
                      Welcome back, {profile.name}
                    </p>
                  </div>
                </div>
                <ModeToggle />
              </div>
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button
                    variant="ghost"
                    className="text-white hover:bg-gray-700/50 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-300"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Homepage
                  </Button>
                </Link>
                <div className="flex items-center gap-3 bg-gray-700/30 rounded-full px-4 py-2 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-300">Online</span>
                </div>
                <NotificationBell />
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox:
                        "size-8 border-2 border-yellow-400/50",
                    },
                  }}
                />
              </div>
            </header>

            {/* Auto-join to default server */}
            {/* DISABLED: This was causing automatic redirects and misdirection issues */}
            {/* <AutoJoinDefault /> */}

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-600/20 via-blue-600/10 to-blue-700/20 border border-blue-400/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-400/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm font-medium">
                        Active Servers
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {servers.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-600/20 via-green-600/10 to-green-700/20 border border-green-400/30 backdrop-blur-md hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-400/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-200 text-sm font-medium">
                        Account Status
                      </p>
                      <p className="text-xl font-bold text-white">
                        {profile.isAdmin ? "Admin" : "Member"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-600/20 via-purple-600/10 to-purple-700/20 border border-purple-400/30 backdrop-blur-md hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-400/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm font-medium">
                        Security
                      </p>
                      <p className="text-xl font-bold text-white">
                        {profile.twoFactorEnabled ? "Secure" : "Basic"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-600/20 via-yellow-600/10 to-yellow-700/20 border border-yellow-400/30 backdrop-blur-md hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-400/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-200 text-sm font-medium">
                        Subscription
                      </p>
                      <p className="text-xl font-bold text-white">Premium</p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Admin Controls - Enhanced */}
            <Card className="mb-8 bg-gradient-to-br from-red-600/20 via-orange-500/15 to-red-700/20 border border-red-400/30 backdrop-blur-md hover:border-red-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-red-400/20">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-red-200">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Crown className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <span className="text-xl font-bold">Admin Controls</span>
                    <span className="block text-sm text-red-300 font-normal">
                      Testing Environment
                    </span>
                  </div>
                </CardTitle>
                <CardDescription className="text-red-300 ml-13">
                  For testing purposes only - Grant yourself admin privileges
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between bg-red-900/20 rounded-xl p-6 border border-red-400/20">
                  <div>
                    <p className="text-sm text-red-200 mb-2">
                      Current Role:{" "}
                      <span className="font-bold text-lg text-white">
                        {profile.isAdmin ? "Admin" : "Regular User"}
                      </span>
                    </p>
                    <p className="text-xs text-red-300">
                      {profile.isAdmin
                        ? "🎉 You have admin access - you can send messages, create servers, and manage channels"
                        : "⚠️ You have read-only access - click below to gain admin privileges"}
                    </p>
                  </div>
                  <AdminButton isAdmin={profile.isAdmin} />
                </div>
              </CardContent>
            </Card>

            {/* Servers Section - Enhanced */}
            <Card className="mb-8 bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-600/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-400/10">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                      Traders Utopia Community
                    </span>
                    <span className="block text-sm text-gray-400 font-normal">
                      Professional Trading Environment
                    </span>
                  </div>
                </CardTitle>
                <CardDescription className="text-gray-300 ml-15">
                  {profile.isAdmin
                    ? "🛡️ You have admin access - manage the community server and moderate discussions"
                    : "👀 You have read-only access - view the community discussions and trading insights"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {servers.map((server, index) => (
                    <SubscriptionProtectedLink
                      key={server.id}
                      href={`/servers/${server.id}`}
                    >
                      <Card className="group bg-gradient-to-br from-gray-700/50 to-gray-800/50 border border-gray-600/30 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/20 backdrop-blur-sm cursor-pointer">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            {server.imageUrl ? (
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-600 group-hover:border-yellow-400/50 transition-all duration-300">
                                <img
                                  src={server.imageUrl}
                                  alt={server.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                {server.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="font-bold text-white text-lg group-hover:text-yellow-300 transition-colors">
                                {server.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <div
                                  className={`w-2 h-2 rounded-full ${profile.isAdmin ? "bg-green-400" : "bg-blue-400"}`}
                                ></div>
                                <span className="text-sm text-gray-400">
                                  {profile.isAdmin
                                    ? "Admin Access"
                                    : "Member Access"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Active trading community with real-time signals
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </SubscriptionProtectedLink>
                  ))}
                </div>

                {servers.length === 0 && (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-600/30 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Users className="h-10 w-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Setting up your community server...
                    </h3>
                    <p className="text-gray-400">
                      You'll be automatically joined to Traders Utopia
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-100"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Tabs */}
            <Tabs defaultValue="profile" className="w-full">
              <div className="w-full flex justify-center mb-8">
                <div className="w-full max-w-4xl">
                  <TabsList
                    className="grid grid-cols-3 w-full h-auto p-4 rounded-2xl shadow-2xl"
                    style={{
                      background: "rgba(31, 41, 55, 0.6) !important",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(75, 85, 99, 0.3)",
                      height: "auto !important",
                      minHeight: "80px !important",
                      display: "grid !important",
                      gridTemplateColumns: "repeat(3, 1fr) !important",
                    }}
                  >
                    <TabsTrigger
                      value="profile"
                      className="flex items-center justify-center gap-4 h-auto min-h-[60px] py-5 px-8 text-lg font-semibold text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg"
                      style={{
                        height: "auto !important",
                        minHeight: "60px !important",
                        fontSize: "18px !important",
                        fontWeight: "600 !important",
                        color: "white !important",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex !important",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <User className="h-6 w-6" />
                      <span>Profile</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="security"
                      className="flex items-center justify-center gap-4 h-auto min-h-[60px] py-5 px-8 text-lg font-semibold text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-green-700 data-[state=active]:text-white data-[state=active]:shadow-lg"
                      style={{
                        height: "auto !important",
                        minHeight: "60px !important",
                        fontSize: "18px !important",
                        fontWeight: "600 !important",
                        color: "white !important",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex !important",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Shield className="h-6 w-6" />
                      <span>Security</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className="flex items-center justify-center gap-4 h-auto min-h-[60px] py-5 px-8 text-lg font-semibold text-white rounded-xl transition-all duration-300 hover:bg-gray-700/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-lg"
                      style={{
                        height: "auto !important",
                        minHeight: "60px !important",
                        fontSize: "18px !important",
                        fontWeight: "600 !important",
                        color: "white !important",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex !important",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Settings className="h-6 w-6" />
                      <span>Settings</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent value="profile" className="w-full">
                <div className="w-full bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 rounded-3xl p-6 lg:p-10 border border-gray-600/30 backdrop-blur-md min-h-[1000px] h-auto overflow-visible relative">
                  <div className="w-full h-full">
                    <DiscordProfile />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="w-full">
                <div className="w-full min-h-[800px] h-auto overflow-visible space-y-8">
                  <Card className="w-full bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-600/30 backdrop-blur-md hover:border-green-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-green-400/10 overflow-visible">
                    <CardHeader className="pb-6 px-6 lg:px-10 pt-6 lg:pt-10">
                      <CardTitle className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                          <Shield className="h-6 w-6 text-green-400" />
                        </div>
                        <span className="text-2xl font-bold">
                          Account Security
                        </span>
                      </CardTitle>
                      <CardDescription className="text-gray-300 ml-13">
                        Manage your account security settings and two-factor
                        authentication
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="w-full bg-gray-900/30 rounded-2xl mx-6 lg:mx-10 mb-6 lg:mb-10 p-6 lg:p-10 border border-gray-700/30 overflow-visible">
                      {console.log(
                        "Dashboard passing twoFactorEnabled:",
                        profile.twoFactorEnabled,
                      )}
                      <div className="w-full">
                        <TwoFactorAuth
                          initialTwoFactorEnabled={profile.twoFactorEnabled}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="w-full">
                <div className="w-full max-w-6xl mx-auto min-h-[800px] h-auto overflow-visible space-y-8">
                  {/* Enhanced Subscription Management */}
                  <div className="w-full bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 rounded-3xl p-8 lg:p-12 border border-gray-600/30 backdrop-blur-md overflow-visible shadow-2xl">
                    <div className="w-full max-w-4xl mx-auto">
                      <SubscriptionManager />
                    </div>
                  </div>

                  {/* Enhanced General Settings */}
                  <div className="w-full bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/60 rounded-3xl border border-gray-600/30 backdrop-blur-md overflow-visible shadow-2xl">
                    {/* Header Section */}
                    <div className="px-8 lg:px-12 pt-8 lg:pt-12 pb-6">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-400/20">
                          <Settings className="h-7 w-7 text-purple-400" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                            General Settings
                          </h2>
                          <p className="text-gray-400 text-sm mt-1">
                            Customize your experience and preferences
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-8 lg:px-12 pb-8 lg:pb-12">
                      <div className="w-full max-w-6xl mx-auto space-y-8">
                        {/* Notifications Section - Now at the top and larger */}
                        <div className="w-full">
                          <div className="mb-6">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600"></div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-white text-xl">
                                  Notifications
                                </h4>
                                <p className="text-sm text-gray-400 mt-1">
                                  Configure your notification preferences and
                                  delivery options
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gradient-to-r from-gray-800/60 to-gray-900/60 rounded-2xl border border-gray-600/30 p-6 lg:p-8 backdrop-blur-sm">
                            <NotificationSettings />
                          </div>
                        </div>

                        {/* Theme Setting */}
                        <div className="w-full flex items-center justify-between p-6 lg:p-8 bg-gradient-to-r from-gray-800/60 to-gray-900/60 rounded-2xl border border-gray-600/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/10 backdrop-blur-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600"></div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-white text-lg">
                                Theme
                              </h4>
                              <p className="text-sm text-gray-400 mt-1">
                                Toggle between light and dark mode
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <ModeToggle />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </ProductPaymentGate>
  );
}
