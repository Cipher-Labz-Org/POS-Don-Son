'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Siren,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProtectedPage } from '@/components/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { developerApi, type DeveloperOverview } from '@/lib/api/developer';
import type { DnPrintPresence, PosDevicePresence, PosDeviceStatus } from '@/lib/api/dn-print-jobs';
import { formatSlDateTime } from '@/lib/sri-lanka-time';
import { Modal, ModalFooter } from '@/components/ui/modal';

function apiErrorMessage(error: unknown, fallback: string) {
  const e = error as {
    response?: { data?: { error?: { message?: string }; detail?: string; title?: string; message?: string } };
    message?: string;
  };
  const data = e?.response?.data;
  return (
    data?.error?.message ||
    data?.detail ||
    data?.message ||
    data?.title ||
    fallback
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: online ? '#DCFCE7' : '#F3F4F6',
        color: online ? '#166534' : '#4B5563',
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: online ? '#16a34a' : '#9ca3af' }}
      />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function ClientStatusCard({
  title,
  presence,
  queueHint,
}: {
  title: string;
  presence: DnPrintPresence | null;
  queueHint: string;
}) {
  const online = presence?.isOnline === true;
  const agent = presence?.agents?.find((a) => a.isOnline) ?? presence?.agents?.[0];
  const lastSeen = agent?.lastHeartbeatAt
    ? formatSlDateTime(agent.lastHeartbeatAt)
    : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{title}</span>
          <StatusPill online={online} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <p>
          <span className="font-medium" style={{ color: 'var(--foreground)' }}>
            Last seen{' '}
          </span>
          {lastSeen}
        </p>
        {agent?.machineName || agent?.printerName ? (
          <p>
            {[agent.stationCode, agent.machineName, agent.printerName].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <p className="break-all font-mono text-xs">
          Queue: {presence?.queueUrlHint || queueHint}
        </p>
        <p className="text-xs">Jobs are queued on the server; the client pulls them.</p>
      </CardContent>
    </Card>
  );
}

function DeveloperModeContent() {
  const user = useAuthStore((s) => s.user);
  const [overview, setOverview] = useState<DeveloperOverview | null>(null);
  const [pos, setPos] = useState<PosDevicePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshTarget, setRefreshTarget] = useState<PosDeviceStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await developerApi.getOverview();
      setOverview(data);
      setPos(data.posDevices);
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Failed to load developer overview'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Terminal className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--muted-foreground)' }} />
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Super Admin only
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Developer Mode is restricted to Super Admin accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Command failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Developer Mode
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Print client controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill online={overview?.dnPrint.isOnline === true} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            DN Print: {overview?.dnPrint.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => developerApi.checkDnPrint(), 'DN Print check queued')}
        >
          <Search className="mr-2 h-4 w-4" />
          Check DN Print Client
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void run(() => developerApi.restartDnPrint(), 'DN Print restart queued')}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Restart DN Print Client
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => developerApi.checkLabelPrint(), 'Label Print check queued')}
        >
          <Search className="mr-2 h-4 w-4" />
          Check Label Print Client
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void run(() => developerApi.restartLabelPrint(), 'Label Print restart queued')}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Restart Label Print Client
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void run(() => developerApi.refreshAllPos(), 'POS refresh queued')}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh All POS
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const p = await developerApi.refreshPosStatus();
              setPos(p);
            }, 'POS status refreshed')
          }
        >
          Refresh POS Device Status
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ClientStatusCard
              title="DN Print Client Status"
              presence={overview?.dnPrint ?? null}
              queueHint="/api/dn-print-jobs/pending"
            />
            <ClientStatusCard
              title="Label Print Client Status"
              presence={overview?.labelPrint ?? null}
              queueHint="/api/label-print-agents"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>POS Device Online Status</CardTitle>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Live status by showroom device name.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="success" size="sm">
                    Online {pos?.onlineCount ?? 0}
                  </Badge>
                  <Badge variant="danger" size="sm">
                    <Siren className="mr-1 h-3 w-3" />
                    Offline {pos?.offlineCount ?? 0}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    Unknown {pos?.unknownCount ?? 0}
                  </Badge>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Last checked:{' '}
                {pos?.checkedAt ? formatSlDateTime(pos.checkedAt) : '—'}
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2 pr-3 font-semibold">Showroom</th>
                    <th className="py-2 pr-3 font-semibold">Device</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Last Seen</th>
                    <th className="py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(pos?.devices ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
                        No POS devices have heartbeated yet. Open a till (DMS-POS) while logged in.
                      </td>
                    </tr>
                  ) : (
                    (pos?.devices ?? []).map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2.5 pr-3">{d.showroom}</td>
                        <td className="py-2.5 pr-3">{d.device}</td>
                        <td className="py-2.5 pr-3">
                          <Badge
                            variant={
                              d.status === 'Online'
                                ? 'success'
                                : d.status === 'Offline'
                                  ? 'danger'
                                  : 'neutral'
                            }
                            size="sm"
                          >
                            {d.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3">
                          {d.lastHeartbeatAt ? formatSlDateTime(d.lastHeartbeatAt) : '—'}
                        </td>
                        <td className="py-2.5">
                          <Button size="sm" variant="secondary" onClick={() => setRefreshTarget(d)}>
                            Refresh Device
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Modal
        isOpen={!!refreshTarget}
        onClose={() => setRefreshTarget(null)}
        title="Refresh POS Device"
      >
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Send refresh command to <strong style={{ color: 'var(--foreground)' }}>{refreshTarget?.device}</strong>?
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setRefreshTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              if (!refreshTarget) return;
              void run(
                () => developerApi.refreshPosDevice(refreshTarget.id),
                `Refresh queued for ${refreshTarget.device}`,
              ).then(() => setRefreshTarget(null));
            }}
          >
            Refresh Device
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export default function DeveloperModePage() {
  return (
    <ProtectedPage permission="setting:view">
      <DeveloperModeContent />
    </ProtectedPage>
  );
}
