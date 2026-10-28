'use client';

import { Bell, LogOut, Menu, User, Settings as SettingsIcon, Wifi, WifiOff, Siren } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme/theme-context';
import { useState, useEffect, useCallback } from 'react';
import ThemeToggle from '@/components/theme/theme-toggle';
import { formatSlDate, formatSlTime } from '@/lib/sri-lanka-time';
import { usePermissions } from '@/hooks/usePermissions';
import { operationApprovalsApi } from '@/lib/api/operation-approvals';
import { approvalsApi } from '@/lib/api/approvals';
import { developerApi } from '@/lib/api/developer';
interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, refreshToken, logout } = useAuthStore();
  const { canAny, isSuperAdmin } = usePermissions();
  const router = useRouter();
  const { pageColor } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [offlinePosCount, setOfflinePosCount] = useState(0);

  const canSeeApprovals = canAny([
    'approval:view',
    'operation:approvals:view',
    'production:approvals:view',
  ]);

  const loadPendingApprovals = useCallback(async () => {
    if (!canSeeApprovals && !isSuperAdmin) {
      setPendingApprovalCount(0);
      return;
    }
    let count = 0;
    try {
      const summary = await operationApprovalsApi.getPending();
      count = Math.max(count, Number(summary.totalPendingCount) || 0);
    } catch {
      /* no operation-approvals access */
    }
    try {
      const queue = await approvalsApi.getPending(1, 1);
      count = Math.max(count, Number(queue.totalCount) || 0);
    } catch {
      /* no approval-queue access */
    }
    setPendingApprovalCount(count);
  }, [canSeeApprovals, isSuperAdmin]);

  const loadOfflinePosCount = useCallback(async () => {
    if (!isSuperAdmin) {
      setOfflinePosCount(0);
      return;
    }
    try {
      const presence = await developerApi.getPosStatus();
      setOfflinePosCount(Number(presence.offlineCount) || 0);
    } catch {
      setOfflinePosCount(0);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadPendingApprovals();
    const id = window.setInterval(() => void loadPendingApprovals(), 45_000);
    const onFocus = () => void loadPendingApprovals();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadPendingApprovals]);

  useEffect(() => {
    void loadOfflinePosCount();
    const id = window.setInterval(() => void loadOfflinePosCount(), 20_000);
    const onFocus = () => void loadOfflinePosCount();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadOfflinePosCount]);
  
  // Mock news ticker data - will be replaced with real data later
  const [newsItems] = useState([
    'System running smoothly',
    'Daily production report available',
    'New delivery schedule updated',
  ]);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [clockNow, setClockNow] = useState(() => new Date());

  // Live clock for top bar (date + time)
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // News ticker rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % newsItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [newsItems.length]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      logout();
      router.push('/login');
    }
  };

  return (
    <header className="flex-shrink-0" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
      {/* News Ticker / Notification Bar */}
      <div
        className="h-8 px-4 flex items-center justify-between text-white text-xs"
        style={{ backgroundColor: pageColor }}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="hidden md:block animate-pulse">
            {newsItems[currentNewsIndex]}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs whitespace-nowrap tabular-nums">
          <span>
            {formatSlDate(clockNow, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="opacity-80" aria-hidden="true">
            ·
          </span>
          <time dateTime={clockNow.toISOString()}>
            {formatSlTime(clockNow, {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </time>
        </div>
      </div>

      {/* Main Header */}
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        {/* Left Section - Mobile Menu */}
        <div className="flex items-center flex-1 space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--foreground)';
              e.currentTarget.style.backgroundColor = 'var(--muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted-foreground)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Super Admin: siren when POS tills are offline */}
          {isSuperAdmin && offlinePosCount > 0 ? (
            <button
              type="button"
              onClick={() => router.push('/administrator/developer')}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: '#ea580c' }}
              title={`${offlinePosCount} POS device${offlinePosCount === 1 ? '' : 's'} offline`}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Siren className="w-5 h-5" />
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {offlinePosCount > 99 ? '99+' : offlinePosCount}
              </span>
            </button>
          ) : null}

          {/* Notifications — only when pending approvals exist */}
          {pendingApprovalCount > 0 ? (
            <button
              type="button"
              onClick={() => router.push('/administrator/approvals')}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              title={`${pendingApprovalCount} pending approval${pendingApprovalCount === 1 ? '' : 's'}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.backgroundColor = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted-foreground)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Bell className="w-5 h-5" />
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none text-white"
                style={{ backgroundColor: pageColor }}
              >
                {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
              </span>
            </button>
          ) : null}

          {/* User Menu */}
          <div className="relative flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-4" style={{ borderLeft: '1px solid var(--border)' }}>
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {user?.isSuperAdmin ? 'Super Admin' : user?.roles?.[0]?.name || 'User'}
              </p>
            </div>
            
            {/* User Avatar with Dropdown */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: pageColor }}
            >
              {user?.firstName?.charAt(0)}
              {user?.lastName?.charAt(0)}
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUserMenu(false)}
                ></div>
                <div className="absolute right-0 top-12 w-56 rounded-lg shadow-lg py-2 z-20" style={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--popover-foreground)' }}>
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/dashboard');
                    }}
                    className="w-full px-4 py-2 text-left text-sm flex items-center space-x-2"
                    style={{ color: 'var(--foreground)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/administrator/system-settings');
                    }}
                    className="w-full px-4 py-2 text-left text-sm flex items-center space-x-2"
                    style={{ color: 'var(--foreground)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm flex items-center space-x-2"
                      style={{ color: '#DC2626' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
