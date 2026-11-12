using Microsoft.EntityFrameworkCore;

namespace DMS_Backend.Data;

/// <summary>
/// Missing <c>categories.SortOrder</c> causes EF 500s on GET /api/categories and GET /api/Products
/// (products join categories). Startup repair covers migration drift or orphan migration files.
/// </summary>
public static class CategorySchemaRepair
{
    private const string EnsureCategorySortOrderSql =
        """
        DO $EF$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'categories'
          ) THEN
            RETURN;
          END IF;

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
        """;

    public static Task EnsureCategoryColumnsAsync(
        this ApplicationDbContext db,
        CancellationToken cancellationToken = default)
        => db.Database.ExecuteSqlRawAsync(EnsureCategorySortOrderSql, cancellationToken);
}
