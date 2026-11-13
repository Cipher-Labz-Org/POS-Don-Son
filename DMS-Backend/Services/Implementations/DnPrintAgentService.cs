using DMS_Backend.Data;
using DMS_Backend.Models.DTOs.DnPrint;
using DMS_Backend.Models.Entities;
using DMS_Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DMS_Backend.Services.Implementations;

public sealed class DnPrintAgentService : IDnPrintAgentService
{
    private readonly ApplicationDbContext _context;

    public DnPrintAgentService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DnPrintAgentStatusDto> HeartbeatAsync(
        DnPrintHeartbeatDto dto,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dto.StationCode))
            throw new InvalidOperationException("Station code is required.");

        await _context.EnsurePrintAgentTablesAsync(cancellationToken);

        var code = dto.StationCode.Trim();
        var now = DateTime.UtcNow;

        var agent = await _context.DnPrintAgents
            .FirstOrDefaultAsync(a => a.StationCode == code, cancellationToken);

        if (agent == null)
        {
            agent = new DnPrintAgent
            {
                Id = Guid.NewGuid(),
                StationCode = code,
                CreatedAt = now,
                IsActive = true,
            };
            _context.DnPrintAgents.Add(agent);
        }

        agent.MachineName = Truncate(dto.MachineName, 120);
        agent.PrinterName = Truncate(dto.PrinterName, 200);
        agent.AppVersion = Truncate(dto.AppVersion, 40);
        agent.IpAddress = Truncate(ipAddress, 64);
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
        var agents = await _context.DnPrintAgents
            .AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.StationCode)
            .ToListAsync(cancellationToken);

        var statuses = agents.Select(a => ToStatus(a, now)).ToList();
        var onlineCount = statuses.Count(s => s.IsOnline);

        return new DnPrintPresenceDto
        {
            IsOnline = onlineCount > 0,
            OnlineAgentCount = onlineCount,
            OfflineSecondsThreshold = IDnPrintAgentService.OfflineAfterSeconds,
            Agents = statuses,
            QueueUrlHint = "/api/dn-print-jobs/pending",
        };
    }

    public async Task QueueCommandAsync(RemoteClientCommand command, CancellationToken cancellationToken = default)
    {
        await _context.EnsurePrintAgentTablesAsync(cancellationToken);
        var agents = await _context.DnPrintAgents.Where(a => a.IsActive).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        foreach (var a in agents)
        {
            a.PendingCommand = command;
            a.LastCheckedAt = now;
            a.UpdatedAt = now;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static DnPrintAgentStatusDto ToStatus(DnPrintAgent agent, DateTime nowUtc)
    {
        var seconds = (int)Math.Max(0, (nowUtc - agent.LastHeartbeatAt).TotalSeconds);
        return new DnPrintAgentStatusDto
        {
            StationCode = agent.StationCode,
            MachineName = agent.MachineName,
            PrinterName = agent.PrinterName,
            IpAddress = agent.IpAddress,
            LastHeartbeatAt = agent.LastHeartbeatAt,
            SecondsSinceHeartbeat = seconds,
            IsOnline = seconds <= IDnPrintAgentService.OfflineAfterSeconds,
            PendingCommand = agent.PendingCommand == RemoteClientCommand.None ? null : agent.PendingCommand.ToString(),
            LastCheckedAt = agent.LastCheckedAt,
        };
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var t = value.Trim();
        return t.Length <= max ? t : t[..max];
    }
}
