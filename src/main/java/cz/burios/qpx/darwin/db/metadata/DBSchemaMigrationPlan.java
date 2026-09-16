package cz.burios.qpx.darwin.db.metadata;

/** Immutable dry-run result for one declared schema migration. */
public record DBSchemaMigrationPlan(DBSchemaMigration migration, SchemaDiff diff, String planHash) {
    public DBSchemaMigrationPlan {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        if (planHash == null || !planHash.matches("[0-9a-fA-F]{64}"))
            throw new IllegalArgumentException("planHash must be a SHA-256 hex string");
        if (!planHash.equalsIgnoreCase(diff.planHash()))
            throw new IllegalArgumentException("planHash does not match diff");
    }

    /** Creates a plan from a migration and derives the hash from the immutable diff. */
    public static DBSchemaMigrationPlan from(DBSchemaMigration migration, SchemaDiff diff) {
        if (migration == null) throw new IllegalArgumentException("migration must not be null");
        if (diff == null) throw new IllegalArgumentException("diff must not be null");
        return new DBSchemaMigrationPlan(migration, diff, diff.planHash());
    }

    public int planFormat() { return SchemaDiff.PLAN_FORMAT; }

    /** Converts this dry-run result into the standalone approval artifact. */
    public DBSchemaMigrationApproval approval() {
        return DBSchemaMigrationApproval.fromPlan(this);
    }
}
