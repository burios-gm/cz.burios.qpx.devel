package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

/** Plans and applies metadata-driven database schema migrations. */
public final class DBSchemaMigrator {
    private final DBSchemaManager manager;
    private final SchemaMigrationHistory history = new SchemaMigrationHistory();

    public DBSchemaMigrator(DBDialect dialect) { this.manager = new DBSchemaManager(dialect); }
    public DBSchemaManager manager() { return manager; }
    public SchemaMigrationHistory history() { return history; }

    public SchemaDiff plan(Connection connection, DBMetaData desired) throws SQLException { return plan(connection, desired, false); }
    public SchemaDiff plan(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        requireConnection(connection);
        if (desired == null) throw new IllegalArgumentException("desired metadata must not be null");
        return SchemaDiff.compare(DBMetaData.load(connection), desired, includeDrops);
    }
    public SchemaDiff migrate(Connection connection, DBMetaData desired) throws SQLException { return migrate(connection, desired, false); }
    public SchemaDiff migrate(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException { return migrate(connection, desired, includeDrops, false); }

    public SchemaDiff migrate(Connection connection, DBMetaData desired, boolean includeDrops, boolean transactional) throws SQLException {
        requireConnection(connection);
        SchemaDiff diff = plan(connection, desired, includeDrops);
        if (!transactional || diff.isEmpty()) { diff.apply(connection, manager); return diff; }
        ensureTransactionalDdl();
        boolean originalAutoCommit = connection.getAutoCommit();
        if (!originalAutoCommit) throw new IllegalStateException("transactional migration requires auto-commit to be enabled");
        try {
            connection.setAutoCommit(false);
            try { diff.apply(connection, manager); connection.commit(); return diff; }
            catch (SQLException | RuntimeException failure) {
                try { connection.rollback(); } catch (SQLException rollbackFailure) { failure.addSuppressed(rollbackFailure); }
                throw failure;
            }
        } finally { connection.setAutoCommit(originalAutoCommit); }
    }

    public SchemaDiff migrateTransactional(Connection connection, DBMetaData desired) throws SQLException { return migrate(connection, desired, false, true); }
    public SchemaDiff migrateTransactional(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException { return migrate(connection, desired, includeDrops, true); }

    /** Applies a named migration once; an identical already-APPLIED migration is idempotent. */
    public SchemaDiff migrateRecorded(Connection connection, DBMetaData desired, String migrationId) throws SQLException {
        return migrateRecorded(connection, desired, migrationId, false, true);
    }

    public SchemaDiff migrateRecorded(Connection connection, DBMetaData desired, String migrationId,
            boolean includeDrops, boolean transactional) throws SQLException {
        requireConnection(connection);
        validateMigrationId(migrationId);
        if (transactional && !connection.getAutoCommit()) throw new IllegalStateException("recorded transactional migration requires auto-commit to be enabled");
        SchemaDiff diff = plan(connection, desired, includeDrops);
        history.ensureTable(connection);
        String planHash = diff.planHash();
        SchemaMigrationHistory.Entry existing = history.find(connection, migrationId);
        if (existing != null) {
            if (existing.status() == SchemaMigrationHistory.Status.APPLIED && existing.planHash().equalsIgnoreCase(planHash)) return diff;
            throw new SchemaMigrationException("Migration ID already exists: " + migrationId + " (status=" + existing.status() + ", planHash=" + existing.planHash() + ")");
        }
        if (transactional) ensureTransactionalDdl();
        history.start(connection, migrationId, planHash);
        return applyRecorded(connection, diff, migrationId, transactional);
    }

    /** Explicitly retries a FAILED migration; the persisted plan hash must still match. */
    public SchemaDiff retryRecorded(Connection connection, DBMetaData desired, String migrationId) throws SQLException {
        return retryRecorded(connection, desired, migrationId, false, true);
    }

    public SchemaDiff retryRecorded(Connection connection, DBMetaData desired, String migrationId,
            boolean includeDrops, boolean transactional) throws SQLException {
        requireConnection(connection);
        validateMigrationId(migrationId);
        if (transactional && !connection.getAutoCommit()) throw new IllegalStateException("recorded transactional migration requires auto-commit to be enabled");
        SchemaDiff diff = plan(connection, desired, includeDrops);
        history.ensureTable(connection);
        if (transactional) ensureTransactionalDdl();
        history.retry(connection, migrationId, diff.planHash());
        return applyRecorded(connection, diff, migrationId, transactional);
    }

    private SchemaDiff applyRecorded(Connection connection, SchemaDiff diff, String migrationId, boolean transactional) throws SQLException {
        if (!transactional) {
            try { diff.apply(connection, manager); history.markApplied(connection, migrationId); return diff; }
            catch (SQLException | RuntimeException failure) { markFailed(connection, migrationId, failure); throw failure; }
        }
        boolean originalAutoCommit = connection.getAutoCommit();
        try {
            connection.setAutoCommit(false);
            try { diff.apply(connection, manager); history.markApplied(connection, migrationId); connection.commit(); return diff; }
            catch (SQLException | RuntimeException failure) {
                try { connection.rollback(); } catch (SQLException rollbackFailure) { failure.addSuppressed(rollbackFailure); }
                try { connection.setAutoCommit(true); history.markFailed(connection, migrationId, failure.toString()); }
                catch (SQLException historyFailure) { failure.addSuppressed(historyFailure); }
                throw failure;
            }
        } finally { if (!connection.getAutoCommit()) connection.setAutoCommit(originalAutoCommit); }
    }

    private void ensureTransactionalDdl() throws SchemaMigrationException {
        if (!manager.dialect().supportsTransactionalDdl())
            throw new SchemaMigrationException("Transactional schema migration is not supported by dialect: " + manager.dialect().name());
    }
    private void markFailed(Connection connection, String migrationId, Throwable failure) {
        try { history.markFailed(connection, migrationId, failure.toString()); }
        catch (SQLException historyFailure) { failure.addSuppressed(historyFailure); }
    }
    private static void validateMigrationId(String migrationId) { if (migrationId == null || migrationId.isBlank() || migrationId.length() > 128) throw new IllegalArgumentException("migrationId must be 1..128 characters"); }
    private static void requireConnection(Connection connection) { if (connection == null) throw new IllegalArgumentException("connection must not be null"); }
}
