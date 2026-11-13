using Microsoft.EntityFrameworkCore;

namespace DMS_Backend.Data;

/// <summary>
/// Developer Mode reads dn_print_agents and label_print_agents. Those queries 500
/// when the tables were never created (migration drift on live databases).
/// </summary>
public static class PrintAgentSchemaRepair
{
    private static int _ready;

    private const string EnsureSql =
        """
        DO $EF$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'dn_print_agents'
          ) THEN
            CREATE TABLE dn_print_agents (
              "Id" uuid NOT NULL,
              station_code character varying(50) NOT NULL,
              machine_name character varying(120) NULL,
              printer_name character varying(200) NULL,
              ip_address character varying(64) NULL,
              last_heartbeat_at timestamp with time zone NOT NULL,
              app_version character varying(40) NULL,
              pending_command integer NOT NULL DEFAULT 0,
              last_checked_at timestamp with time zone NULL,
              "IsActive" boolean NOT NULL DEFAULT true,
              "CreatedAt" timestamp with time zone NOT NULL,
              "UpdatedAt" timestamp with time zone NOT NULL,
              "CreatedById" uuid NULL,
              "UpdatedById" uuid NULL,
              CONSTRAINT "PK_dn_print_agents" PRIMARY KEY ("Id")
            );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'dn_print_agents' AND column_name = 'pending_command'
          ) THEN
            ALTER TABLE dn_print_agents ADD COLUMN pending_command integer NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'dn_print_agents' AND column_name = 'last_checked_at'
          ) THEN
            ALTER TABLE dn_print_agents ADD COLUMN last_checked_at timestamp with time zone NULL;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = current_schema() AND indexname = 'IX_dn_print_agents_station_code'
          ) THEN
            CREATE UNIQUE INDEX "IX_dn_print_agents_station_code" ON dn_print_agents (station_code);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'label_print_agents'
          ) THEN
            CREATE TABLE label_print_agents (
              "Id" uuid NOT NULL,
              station_code character varying(50) NOT NULL,
              machine_name character varying(120) NULL,
              printer_name character varying(200) NULL,
              ip_address character varying(64) NULL,
              last_heartbeat_at timestamp with time zone NOT NULL,
              app_version character varying(40) NULL,
              pending_command integer NOT NULL DEFAULT 0,
              last_checked_at timestamp with time zone NULL,
              "IsActive" boolean NOT NULL DEFAULT true,
              "CreatedAt" timestamp with time zone NOT NULL,
              "UpdatedAt" timestamp with time zone NOT NULL,
              "CreatedById" uuid NULL,
              "UpdatedById" uuid NULL,
              CONSTRAINT "PK_label_print_agents" PRIMARY KEY ("Id")
            );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'label_print_agents' AND column_name = 'pending_command'
          ) THEN
            ALTER TABLE label_print_agents ADD COLUMN pending_command integer NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'label_print_agents' AND column_name = 'last_checked_at'
          ) THEN
            ALTER TABLE label_print_agents ADD COLUMN last_checked_at timestamp with time zone NULL;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = current_schema() AND indexname = 'IX_label_print_agents_station_code'
          ) THEN
            CREATE UNIQUE INDEX "IX_label_print_agents_station_code" ON label_print_agents (station_code);
          END IF;
        END
        $EF$;
        """;

    public static async Task EnsurePrintAgentTablesAsync(
        this ApplicationDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (Volatile.Read(ref _ready) == 1)
            return;

        await db.Database.ExecuteSqlRawAsync(EnsureSql, cancellationToken);
        Volatile.Write(ref _ready, 1);
    }
}
