package cz.burios.qpx.darwin.db.metadata;

/** Immutable dry-run result for one declared schema migration. */
public record DBSchemaMigrationPlan(DBSchemaMigration migration, SchemaDiff diff, String planHash) {
    public DBSchemaMigrationPlan {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        if (planHash == null || !planHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
    }
}
