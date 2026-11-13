using DMS_Backend.Data;
using DMS_Backend.Models.DTOs.DnPrint;
using DMS_Backend.Models.Entities;
using DMS_Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DMS_Backend.Services.Implementations;

public sealed class LabelPrintAgentService : ILabelPrintAgentService
{
    private readonly ApplicationDbContext _context;

    public LabelPrintAgentService(ApplicationDbContext context) => _context = context;

    public async Task<DnPrintAgentStatusDto> HeartbeatAsync(
        LabelPrintHeartbeatDto dto,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dto.StationCode))
            throw new InvalidOperationException("Station code is required.");

        await _context.EnsurePrintAgentTablesAsync(cancellationToken);

        var code = dto.StationCode.Trim();
        var now = DateTime.UtcNow;
        var agent = await _context.LabelPrintAgents
            .FirstOrDefaultAsync(a => a.StationCode == code, cancellationToken);

        if (agent == null)
        {
            agent = new LabelPrintAgent
            {
                Id = Guid.NewGuid(),
                StationCode = code,
                CreatedAt = now,
                IsActive = true,
            };
            _context.LabelPrintAgents.Add(agent);
        }

        agent.MachineName = Trunc(dto.MachineName, 120);
        agent.PrinterName = Trunc(dto.PrinterName, 200);
        agent.AppVersion = Trunc(dto.AppVersion, 40);
        agent.IpAddress = Trunc(ipAddress, 64);
        agent.LastHeartbeatAt = now;
        agent.UpdatedAt = now;
        agent.IsActive = true;

        var pending = agent.PendingCommand;
        if (pending != RemoteClientCommand.None)
        {
            agent.PendingCommand = RemoteClientCommand.None;
            agent.LastCheckedAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        var status = ToStatus(agent, now);
        status.PendingCommand = pending == RemoteClientCommand.None ? null : pending.ToString();
        return status;
    }

    public async Task<DnPrintPresenceDto> GetPresenceAsync(CancellationToken cancellationToken = default)
    {
        await _context.EnsurePrintAgentTablesAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var agents = await _context.LabelPrintAgents.AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.StationCode)
            .ToListAsync(cancellationToken);
        var statuses = agents.Select(a => ToStatus(a, now)).ToList();
        return new DnPrintPresenceDto
        {
            IsOnline = statuses.Any(s => s.IsOnline),
            OnlineAgentCount = statuses.Count(s => s.IsOnline),
            OfflineSecondsThreshold = ILabelPrintAgentService.OfflineAfterSeconds,
            Agents = statuses,
            QueueUrlHint = "/api/label-print-agents/pending-jobs",
        };
    }

    public async Task QueueCommandAsync(RemoteClientCommand command, CancellationToken cancellationToken = default)
    {
        await _context.EnsurePrintAgentTablesAsync(cancellationToken);
        var agents = await _context.LabelPrintAgents.Where(a => a.IsActive).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        foreach (var a in agents)
        {
            a.PendingCommand = command;
            a.LastCheckedAt = now;
            a.UpdatedAt = now;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static DnPrintAgentStatusDto ToStatus(LabelPrintAgent agent, DateTime now)
    {
        var seconds = (int)Math.Max(0, (now - agent.LastHeartbeatAt).TotalSeconds);
        return new DnPrintAgentStatusDto
        {
            StationCode = agent.StationCode,
            MachineName = agent.MachineName,
            PrinterName = agent.PrinterName,
            IpAddress = agent.IpAddress,
            LastHeartbeatAt = agent.LastHeartbeatAt,
            SecondsSinceHeartbeat = seconds,
            IsOnline = seconds <= ILabelPrintAgentService.OfflineAfterSeconds,
            PendingCommand = agent.PendingCommand == RemoteClientCommand.None ? null : agent.PendingCommand.ToString(),
            LastCheckedAt = agent.LastCheckedAt,
        };
    }

    private static string? Trunc(string? v, int max) =>
        string.IsNullOrWhiteSpace(v) ? null : (v.Trim().Length <= max ? v.Trim() : v.Trim()[..max]);
}

public sealed class PosDeviceAgentService : IPosDeviceAgentService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PosDeviceAgentService> _logger;

    public PosDeviceAgentService(ApplicationDbContext context, ILogger<PosDeviceAgentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PosDeviceStatusDto> HeartbeatAsync(
        PosDeviceHeartbeatDto dto,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dto.DeviceId))
            throw new InvalidOperationException("DeviceId is required.");

        var deviceId = dto.DeviceId.Trim();
        var now = DateTime.UtcNow;
        var agent = await _context.PosDeviceAgents
            .FirstOrDefaultAsync(a => a.DeviceId == deviceId, cancellationToken);

        if (agent == null)
        {
            agent = new PosDeviceAgent
            {
                Id = Guid.NewGuid(),
                DeviceId = deviceId,
                CreatedAt = now,
                IsActive = true,
            };
            _context.PosDeviceAgents.Add(agent);
        }

        agent.OutletId = dto.OutletId;
        agent.OutletName = Trunc(dto.OutletName, 100);
        agent.DeviceName = Trunc(dto.DeviceName ?? dto.OutletName, 120);
        agent.MachineName = Trunc(dto.MachineName, 120);
        agent.AppVersion = Trunc(dto.AppVersion, 40);
        agent.IpAddress = Trunc(ipAddress, 64);
        agent.LastHeartbeatAt = now;
        agent.UpdatedAt = now;
        agent.IsActive = true;

        var pending = agent.PendingCommand;
        if (pending != RemoteClientCommand.None)
        {
            agent.PendingCommand = RemoteClientCommand.None;
            agent.LastCheckedAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        var status = ToStatus(agent, now);
        status.PendingCommand = pending == RemoteClientCommand.None ? null : pending.ToString();
        return status;
    }

    public async Task<PosDevicePresenceDto> GetPresenceAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        try
        {
            var agents = await _context.PosDeviceAgents.AsNoTracking()
                .Where(a => a.IsActive)
                .OrderBy(a => a.OutletName)
                .ThenBy(a => a.DeviceName)
                .ToListAsync(cancellationToken);

            var devices = agents.Select(a => ToStatus(a, now)).ToList();
            return new PosDevicePresenceDto
            {
                OnlineCount = devices.Count(d => d.Status == "Online"),
                OfflineCount = devices.Count(d => d.Status == "Offline"),
                UnknownCount = devices.Count(d => d.Status == "Unknown"),
                CheckedAt = now,
                OfflineSecondsThreshold = IPosDeviceAgentService.OfflineAfterSeconds,
                Devices = devices,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "POS device presence query failed; returning empty status.");
            return EmptyPresence(now);
        }
    }

    public async Task QueueRefreshAsync(Guid? deviceRowId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        if (deviceRowId.HasValue)
        {
            var agent = await _context.PosDeviceAgents
                .FirstOrDefaultAsync(a => a.Id == deviceRowId.Value, cancellationToken)
                ?? throw new InvalidOperationException("POS device not found.");
            agent.PendingCommand = RemoteClientCommand.Refresh;
            agent.LastCheckedAt = now;
            agent.UpdatedAt = now;
        }
        else
        {
            await QueueRefreshAllAsync(cancellationToken);
            return;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task QueueRefreshAllAsync(CancellationToken cancellationToken = default)
    {
        var agents = await _context.PosDeviceAgents.Where(a => a.IsActive).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        foreach (var a in agents)
        {
            a.PendingCommand = RemoteClientCommand.Refresh;
            a.LastCheckedAt = now;
            a.UpdatedAt = now;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static PosDevicePresenceDto EmptyPresence(DateTime now) => new()
    {
        OnlineCount = 0,
        OfflineCount = 0,
        UnknownCount = 0,
        CheckedAt = now,
        OfflineSecondsThreshold = IPosDeviceAgentService.OfflineAfterSeconds,
        Devices = new List<PosDeviceStatusDto>(),
    };

    private static PosDeviceStatusDto ToStatus(PosDeviceAgent agent, DateTime now)
    {
        var never = agent.LastHeartbeatAt == default || agent.LastHeartbeatAt.Year < 2;
        var seconds = never ? int.MaxValue : SecondsSince(agent.LastHeartbeatAt, now);
        var online = !never && seconds <= IPosDeviceAgentService.OfflineAfterSeconds;
        var status = never ? "Unknown" : online ? "Online" : "Offline";
        return new PosDeviceStatusDto
        {
            Id = agent.Id,
            DeviceId = agent.DeviceId,
            OutletId = agent.OutletId,
            Showroom = agent.OutletName ?? "—",
            Device = agent.DeviceName ?? agent.MachineName ?? agent.DeviceId,
            Status = status,
            IsOnline = online,
            LastHeartbeatAt = never ? null : agent.LastHeartbeatAt,
            PendingCommand = agent.PendingCommand == RemoteClientCommand.None ? null : agent.PendingCommand.ToString(),
            LastCheckedAt = agent.LastCheckedAt,
        };
    }

    private static int SecondsSince(DateTime last, DateTime now)
    {
        var total = (now - last).TotalSeconds;
        if (total <= 0) return 0;
        if (total >= int.MaxValue) return int.MaxValue;
        return (int)total;
    }

    private static string? Trunc(string? v, int max) =>
        string.IsNullOrWhiteSpace(v) ? null : (v.Trim().Length <= max ? v.Trim() : v.Trim()[..max]);
}
