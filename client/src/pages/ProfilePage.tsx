import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { profileApi, type Profile } from "../lib/profile";
import { subscriptionApi, type Subscription } from "../lib/subscription";
import { useToast } from "../components/Toast";

type ProfileView = "overview" | "edit" | "password" | "billing";

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const { logout } = useAuth();

  const { showToast } = useToast();
  const [view, setView] = useState<ProfileView>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Billing state
  const [isCanceling, setIsCanceling] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileApi.get();
      setProfile(data.user);
      setEditName(data.user.name || "");
      setEditBio(data.user.bio || "");
      setEditAvatarUrl(data.user.avatarUrl || "");
    } catch {
      showToast("Failed to load profile", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const fetchSubscription = useCallback(async () => {
    try {
      const data = await subscriptionApi.get();
      setSubscription(data.subscription);
    } catch {
      // Silently fail - subscription is non-critical
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSubscription();
  }, [fetchProfile, fetchSubscription]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const data = await profileApi.update({
        name: editName || undefined,
        bio: editBio || undefined,
        avatarUrl: editAvatarUrl || null,
      });
      setProfile(data.user);
      showToast("Profile updated successfully", "success");
      setView("overview");
    } catch (err: any) {
      showToast(err?.message || "Failed to update profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await profileApi.changePassword({ currentPassword, newPassword });
      showToast("Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setView("overview");
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      await subscriptionApi.cancel();
      showToast("Subscription canceled. You are now on the free plan.", "success");
      fetchSubscription();
    } catch (err: any) {
      showToast(err?.message || "Failed to cancel subscription", "error");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    try {
      const data = await subscriptionApi.createCheckoutSession(plan);
      showToast(`Redirecting to checkout for ${plan} plan...`, "info");
      // In production: window.location.href = data.url;
      showToast(`Mock: ${data.url}`, "info");
    } catch (err: any) {
      showToast(err?.message || "Failed to create checkout session", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700 border-gray-200",
    pro: "bg-blue-100 text-blue-700 border-blue-200",
    enterprise: "bg-purple-100 text-purple-700 border-purple-200",
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Profile</h1>
          </div>

          <button
            onClick={logout}
            className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 font-medium transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <span className="hidden sm:inline">Sign out</span>
            <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8">
        {/* ─── Navigation Tabs ──────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          {([
            { key: "overview", label: "Overview" },
            { key: "edit", label: "Edit Profile" },
            { key: "password", label: "Password" },
            { key: "billing", label: "Billing" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                view === tab.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Overview ─────────────────────────────────────────── */}
        {view === "overview" && profile && (
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
              <div className="flex items-center gap-4 mb-6">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {(profile.name || profile.email)[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {profile.name || "Unnamed User"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
                  {profile.bio && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{profile.bio}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile._count.todos}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Todos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile._count.projects}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile._count.tags}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tags</div>
                </div>
              </div>
            </div>

            {/* Subscription Card */}
            {subscription && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Subscription</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${planColors[subscription.plan] || planColors.free}`}
                    >
                      {subscription.plan}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{subscription.status}</span>
                  </div>
                  <button
                    onClick={() => setView("billing")}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Manage
                  </button>
                </div>
              </div>
            )}

            {/* Account Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Account</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Member since</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(profile.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Last updated</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(profile.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Edit Profile ─────────────────────────────────────── */}
        {view === "edit" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none dark:bg-gray-700 dark:text-gray-200"
                  placeholder="A short bio about yourself..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{editBio.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Avatar URL</label>
                <input
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setEditName(profile?.name || "");
                    setEditBio(profile?.bio || "");
                    setEditAvatarUrl(profile?.avatarUrl || "");
                    setView("overview");
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Change Password ──────────────────────────────────── */}
        {view === "password" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Change Password</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                    setView("overview");
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Billing & Subscription ───────────────────────────── */}
        {view === "billing" && (
          <div className="space-y-6">
            {/* Current Plan */}
            {subscription && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Current Plan</h2>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${planColors[subscription.plan] || planColors.free}`}
                    >
                      {subscription.plan}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 capitalize">{subscription.status}</span>
                  </div>
                </div>

                {subscription.plan !== "free" && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {isCanceling ? "Canceling..." : "Cancel subscription"}
                  </button>
                )}
              </div>
            )}

            {/* Available Plans */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors duration-200">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Available Plans</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Free Plan */}
                <div className={`rounded-xl border-2 p-5 ${
                  subscription?.plan === "free" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600"
                }`}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Free</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">$0</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">/month</p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Up to 50 todos
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      3 projects
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Basic tags
                    </li>
                  </ul>
                  {subscription?.plan === "free" && (
                    <div className="mt-4 text-xs text-blue-600 font-medium text-center">Current Plan</div>
                  )}
                </div>

                {/* Pro Plan */}
                <div className={`rounded-xl border-2 p-5 ${
                  subscription?.plan === "pro" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600"
                }`}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pro</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">$9</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">/month</p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Unlimited todos
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Unlimited projects
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Priority support
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Advanced features
                    </li>
                  </ul>
                  {subscription?.plan === "pro" ? (
                    <div className="mt-4 text-xs text-blue-600 font-medium text-center">Current Plan</div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade("pro")}
                      className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
