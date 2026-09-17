package cz.burios.qpx.darwin.db.metadata;

/** Immutable dry-run result for one declared schema migration. */
public record DBSchemaMigrationPlan(DBSchemaMigration migration, SchemaDiff diff, String planHash, String sourceHash) {
    public DBSchemaMigrationPlan {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        if (planHash == null || !planHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
        if (!planHash.equalsIgnoreCase(diff.planHash()))
            throw new IllegalArgumentException("planHash does not match diff");
        if (sourceHash == null || !sourceHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("sourceHash must be a SHA-256 hex string");
    }

    /** Creates a plan from a migration, diff and source metadata fingerprint. */
    public static DBSchemaMigrationPlan from(DBSchemaMigration migration, SchemaDiff diff, String sourceHash) {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        return new DBSchemaMigrationPlan(migration, diff, diff.planHash(), sourceHash);
    }

    /** Creates a plan from a migration and diff when the source fingerprint is unavailable. */
    public static DBSchemaMigrationPlan from(DBSchemaMigration migration, SchemaDiff diff) {
        throw new IllegalArgumentException("sourceHash is required for a migration plan");
    }

    public int planFormat() { return SchemaDiff.PLAN_FORMAT; }

    /** Converts this dry-run result into the standalone approval artifact. */
    public DBSchemaMigrationApproval approval() {
        return DBSchemaMigrationApproval.fromPlan(this);
    }
}
