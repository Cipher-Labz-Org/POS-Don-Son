import apiClient from './api-client';
import type { DnPrintPresence, PosDevicePresence } from './dn-print-jobs';

export type { DnPrintPresence, PosDevicePresence };

export interface DeveloperOverview {
  dnPrint: DnPrintPresence;
  labelPrint: DnPrintPresence;
  posDevices: PosDevicePresence;
}

function unwrap(res: any) {
  return res?.data?.data ?? res?.data;
}

export const developerApi = {
  async getOverview(): Promise<DeveloperOverview> {
    const res = await apiClient.get<any>('/api/developer/overview');
    const raw = unwrap(res);
    return {
      dnPrint: normalizePresence(raw?.dnPrint ?? raw?.DnPrint),
      labelPrint: normalizePresence(raw?.labelPrint ?? raw?.LabelPrint),
      posDevices: normalizePos(raw?.posDevices ?? raw?.PosDevices),
    };
  },

  checkDnPrint: () => apiClient.post('/api/developer/dn-print/check', {}),
  restartDnPrint: () => apiClient.post('/api/developer/dn-print/restart', {}),
  checkLabelPrint: () => apiClient.post('/api/developer/label-print/check', {}),
  restartLabelPrint: () => apiClient.post('/api/developer/label-print/restart', {}),
  refreshAllPos: () => apiClient.post('/api/developer/pos/refresh-all', {}),
  refreshPosStatus: async () => {
    const res = await apiClient.post<any>('/api/developer/pos/refresh-status');
    return normalizePos(unwrap(res));
  },
  refreshPosDevice: (id: string) => apiClient.post(`/api/pos-devices/${id}/refresh`),
  getPosStatus: async () => {
    const res = await apiClient.get<any>('/api/pos-devices/status');
    return normalizePos(unwrap(res));
  },
};

function normalizePresence(raw: any): DnPrintPresence {
  return {
    isOnline: Boolean(raw?.isOnline ?? raw?.IsOnline),
    onlineAgentCount: Number(raw?.onlineAgentCount ?? raw?.OnlineAgentCount ?? 0),
    offlineSecondsThreshold: Number(raw?.offlineSecondsThreshold ?? raw?.OfflineSecondsThreshold ?? 15),
    queueUrlHint: raw?.queueUrlHint ?? raw?.QueueUrlHint,
    agents: (raw?.agents ?? raw?.Agents ?? []).map((a: any) => ({
      stationCode: a.stationCode ?? a.StationCode ?? '',
      machineName: a.machineName ?? a.MachineName,
      printerName: a.printerName ?? a.PrinterName,
      ipAddress: a.ipAddress ?? a.IpAddress,
      lastHeartbeatAt: a.lastHeartbeatAt ?? a.LastHeartbeatAt ?? '',
      isOnline: Boolean(a.isOnline ?? a.IsOnline),
      secondsSinceHeartbeat: Number(a.secondsSinceHeartbeat ?? a.SecondsSinceHeartbeat ?? 0),
      pendingCommand: a.pendingCommand ?? a.PendingCommand,
      lastCheckedAt: a.lastCheckedAt ?? a.LastCheckedAt,
    })),
  };
}

function normalizePos(raw: any): PosDevicePresence {
  return {
    onlineCount: Number(raw?.onlineCount ?? raw?.OnlineCount ?? 0),
    offlineCount: Number(raw?.offlineCount ?? raw?.OfflineCount ?? 0),
    unknownCount: Number(raw?.unknownCount ?? raw?.UnknownCount ?? 0),
    checkedAt: raw?.checkedAt ?? raw?.CheckedAt ?? new Date().toISOString(),
    offlineSecondsThreshold: Number(raw?.offlineSecondsThreshold ?? raw?.OfflineSecondsThreshold ?? 90),
    devices: (raw?.devices ?? raw?.Devices ?? []).map((d: any) => ({
      id: d.id ?? d.Id,
      deviceId: d.deviceId ?? d.DeviceId ?? '',
      outletId: d.outletId ?? d.OutletId,
      showroom: d.showroom ?? d.Showroom ?? '—',
      device: d.device ?? d.Device ?? '—',
      status: d.status ?? d.Status ?? 'Unknown',
      isOnline: Boolean(d.isOnline ?? d.IsOnline),
      lastHeartbeatAt: d.lastHeartbeatAt ?? d.LastHeartbeatAt,
      pendingCommand: d.pendingCommand ?? d.PendingCommand,
      lastCheckedAt: d.lastCheckedAt ?? d.LastCheckedAt,
    })),
  };
}
