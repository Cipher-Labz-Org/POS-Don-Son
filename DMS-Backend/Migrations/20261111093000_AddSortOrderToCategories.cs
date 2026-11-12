using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DMS_Backend.Migrations;

/// <summary>
/// Category sort order for POS tabs. Idempotent SQL — safe if column already exists.
/// </summary>
[Migration("20261111093000_AddSortOrderToCategories")]
public partial class AddSortOrderToCategories : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DO $EF$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'categories'
                      AND column_name = 'SortOrder'
                ) THEN
                    ALTER TABLE categories ADD COLUMN "SortOrder" integer NOT NULL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = current_schema()
                      AND indexname = 'ix_categories_sort_order'
                ) THEN
                    CREATE INDEX ix_categories_sort_order ON categories ("SortOrder");
                END IF;
            END $EF$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS ix_categories_sort_order;
            ALTER TABLE categories DROP COLUMN IF EXISTS "SortOrder";
            """);
    }
}
