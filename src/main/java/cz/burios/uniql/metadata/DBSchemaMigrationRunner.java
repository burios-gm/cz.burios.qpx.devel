package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import cz.burios.uniql.dialect.DBDialect;

/** Executes an ordered application migration sequence backed by persistent history. */
public final class DBSchemaMigrationRunner {
    private final DBSchemaMigrator migrator;
    private final List<DBSchemaMigration> migrations;

    public DBSchemaMigrationRunner(DBDialect dialect, List<DBSchemaMigration> migrations) { this(new DBSchemaMigrator(dialect), migrations); }
    public DBSchemaMigrationRunner(DBSchemaMigrator migrator, List<DBSchemaMigration> migrations) {
        if (migrator == null) throw new IllegalArgumentException("migrator must not be null");
        if (migrations == null) throw new IllegalArgumentException("migrations must not be null");
        List<DBSchemaMigration> copy = new ArrayList<>(migrations); Set<String> ids = new HashSet<>();
        for (DBSchemaMigration migration : copy) {
            if (migration == null) throw new IllegalArgumentException("migration must not be null");
            if (!ids.add(normalizeId(migration.id()))) throw new IllegalArgumentException("duplicate migration ID: " + migration.id());
        }
        this.migrator = migrator; this.migrations = Collections.unmodifiableList(copy);
    }
    public DBSchemaMigrationRunner(DBDialect dialect, DBSchemaMigration... migrations) { this(dialect, List.of(migrations)); }
    public DBSchemaMigrator migrator() { return migrator; }
    public SchemaMigrationHistory history() { return migrator.history(); }
    public List<DBSchemaMigration> migrations() { return migrations; }

    public List<DBSchemaMigration> pending(Connection connection) throws SQLException {
        requireConnection(connection); history().ensureTable(connection); List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        validateEntries(entries, null);
        List<DBSchemaMigration> result = new ArrayList<>();
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = findEntry(entries, migration.id());
            if (entry == null || entry.status() != SchemaMigrationHistory.Status.APPLIED) result.add(migration);
        }
        return Collections.unmodifiableList(result);
    }

    /** Plans all pending migrations without changing the database or migration history. */
    public List<DBSchemaMigrationPlan> planPending(Connection connection) throws SQLException {
        requireConnection(connection);
        validate(connection);
        DBMetaData source = DBMetaData.load(connection);
        List<DBSchemaMigrationPlan> result = new ArrayList<>();
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = findEntry(entries, migration.id());
            if (entry != null && entry.status() == SchemaMigrationHistory.Status.APPLIED) continue;
            SchemaDiff diff = SchemaDiff.compare(source, migration.desired(), migration.includeDrops());
            result.add(DBSchemaMigrationPlan.from(migration, diff, source.fingerprint()));
        }
        return Collections.unmodifiableList(result);
    }

    /** Applies one previously approved plan exactly as it was produced, without replanning. */
    public SchemaDiff apply(Connection connection, DBSchemaMigrationPlan plan) throws SQLException {
        requireConnection(connection);
        if (plan == null) throw new IllegalArgumentException("plan must not be null");
        return applyApproval(connection, DBSchemaMigrationApproval.fromPlan(plan));
    }

    /** Applies one previously approved plan with an explicit transaction mode. */
    public SchemaDiff apply(Connection connection, DBSchemaMigrationPlan plan, boolean transactional) throws SQLException {
        requireConnection(connection);
        if (plan == null) throw new IllegalArgumentException("plan must not be null");
        return applyApproval(connection, DBSchemaMigrationApproval.fromPlan(plan), transactional);
    }

    /** Applies a standalone approval artifact without requiring desired metadata to be embedded in it. */
    public SchemaDiff applyApproval(Connection connection, DBSchemaMigrationApproval approval) throws SQLException {
        return applyApproval(connection, approval, defaultTransactional());
    }

    /** Applies a standalone approval artifact with an explicit transaction mode. */
    public SchemaDiff applyApproval(Connection connection, DBSchemaMigrationApproval approval, boolean transactional) throws SQLException {
        requireConnection(connection);
        if (approval == null) throw new IllegalArgumentException("approval must not be null");
        DBSchemaMigration migration = findMigration(migrations, approval.migrationId());
        if (migration == null) throw new SchemaMigrationException("Migration approval does not belong to this runner: " + approval.migrationId());
        if (!approval.description().equals(migration.description())) throw new SchemaMigrationException("Migration approval description does not match declared migration: " + migration.id());
        if (approval.includeDrops() != migration.includeDrops()) throw new SchemaMigrationException("Migration approval includeDrops does not match declared migration: " + migration.id());
        if (!approval.planHash().equalsIgnoreCase(approval.diff().planHash())) throw new SchemaMigrationException("Migration approval hash does not match its diff: " + migration.id());
        validate(connection);
        SchemaMigrationHistory.Entry existing = history().find(connection, migration.id());
        if (existing != null) throw new SchemaMigrationException("Migration is no longer pending: " + migration.id() + " (status=" + existing.status() + ")");
        String currentSourceHash = DBMetaData.load(connection).fingerprint();
        if (!approval.sourceHash().equalsIgnoreCase(currentSourceHash))
            throw new SchemaMigrationException("Migration approval source metadata has changed: " + migration.id()
                    + " (approved=" + approval.sourceHash() + ", current=" + currentSourceHash + ")");
        return migrator.applyRecorded(connection, approval.diff(), migration.id(), approval.planHash(), migration.definitionHash(), transactional);
    }

    /** Applies a previously approved JSON plan without rebuilding it from current metadata. */
    public SchemaDiff applyJson(Connection connection, String json) throws SQLException {
        return applyApproval(connection, DBSchemaMigrationApproval.fromJson(json));
    }

    /** Applies a previously approved JSON plan with an explicit transaction mode. */
    public SchemaDiff applyJson(Connection connection, String json, boolean transactional) throws SQLException {
        return applyApproval(connection, DBSchemaMigrationApproval.fromJson(json), transactional);
    }

    /** Validates that persisted history represents a contiguous migration sequence and unchanged declarations. */
    public void validate(Connection connection) throws SQLException {
        requireConnection(connection); history().ensureTable(connection); validateEntries(history().list(connection), null);
    }

    /** Applies every pending migration using the dialect's recommended transaction mode. */
    public List<SchemaDiff> migrate(Connection connection) throws SQLException {
        return migrate(connection, defaultTransactional());
    }

    /** Applies every pending migration in declaration order with an explicit transaction mode. */
    public List<SchemaDiff> migrate(Connection connection, boolean transactional) throws SQLException {
        requireConnection(connection); validate(connection); List<SchemaDiff> applied = new ArrayList<>();
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = history().find(connection, migration.id());
            if (entry != null && entry.status() == SchemaMigrationHistory.Status.APPLIED) continue;
            applied.add(migrator.migrateRecorded(connection, migration.desired(), migration.id(), migration.includeDrops(), transactional, migration.definitionHash()));
        }
        return Collections.unmodifiableList(applied);
    }

    /** Explicitly retries one FAILED migration after validating its position in the declared sequence. */
    public SchemaDiff retry(Connection connection, String migrationId) throws SQLException {
        return retry(connection, migrationId, defaultTransactional());
    }

    /** Explicitly retries one FAILED migration with an explicit transaction mode. */
    public SchemaDiff retry(Connection connection, String migrationId, boolean transactional) throws SQLException {
        requireConnection(connection);
        DBSchemaMigration migration = findMigration(migrations, migrationId);
        if (migration == null) throw new SchemaMigrationException("Migration is not declared: " + migrationId);
        history().ensureTable(connection);
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        validateEntries(entries, migrationId);
        SchemaMigrationHistory.Entry entry = findEntry(entries, migrationId);
        if (entry == null) throw new SchemaMigrationException("Migration has no persisted FAILED entry: " + migrationId);
        if (entry.status() != SchemaMigrationHistory.Status.FAILED) throw new SchemaMigrationException("Only FAILED migration can be retried: " + migrationId + " (status=" + entry.status() + ")");
        if (entry.definitionHash() == null || !entry.definitionHash().equalsIgnoreCase(migration.definitionHash()))
            throw new SchemaMigrationException("Migration definition changed after FAILED: " + migrationId);
        return migrator.retryRecorded(connection, migration.desired(), migration.id(), migration.includeDrops(), transactional, migration.definitionHash());
    }

    private boolean defaultTransactional() { return migrator.manager().dialect().supportsTransactionalDdl(); }

    private void validateEntries(List<SchemaMigrationHistory.Entry> entries, String retryId) throws SQLException {
        Set<String> seen = new HashSet<>();
        for (SchemaMigrationHistory.Entry entry : entries) {
            if (entry == null || entry.migrationId() == null) throw new SchemaMigrationException("Migration history contains invalid entry");
            if (!seen.add(normalizeId(entry.migrationId()))) throw new SchemaMigrationException("Migration history contains duplicate migration ID: " + entry.migrationId());
        }
        boolean previousPending = false;
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = findEntry(entries, migration.id());
            if (entry == null) { previousPending = true; continue; }
            boolean allowedFailed = retryId != null && migration.id().equalsIgnoreCase(retryId) && entry.status() == SchemaMigrationHistory.Status.FAILED;
            if (entry.status() == SchemaMigrationHistory.Status.RUNNING) throw new SchemaMigrationException("Migration is still RUNNING: " + migration.id());
            if (entry.status() == SchemaMigrationHistory.Status.FAILED && !allowedFailed) throw new SchemaMigrationException("Migration has FAILED: " + migration.id() + (entry.errorMessage() == null ? "" : " - " + entry.errorMessage()));
            if (entry.status() == SchemaMigrationHistory.Status.APPLIED) {
                if (entry.definitionHash() == null) throw new SchemaMigrationException("Applied migration has no definition hash: " + migration.id());
                if (!entry.definitionHash().equalsIgnoreCase(migration.definitionHash())) throw new SchemaMigrationException("Migration definition changed after APPLIED: " + migration.id());
            }
            if (previousPending && entry.status() == SchemaMigrationHistory.Status.APPLIED) throw new SchemaMigrationException("Migration history has a gap before: " + migration.id());
            if (entry.status() == SchemaMigrationHistory.Status.FAILED) previousPending = true;
        }
        for (SchemaMigrationHistory.Entry entry : entries) if (findMigration(migrations, entry.migrationId()) == null)
            throw new SchemaMigrationException("Migration history contains undeclared migration: " + entry.migrationId());
    }

    private static SchemaMigrationHistory.Entry findEntry(List<SchemaMigrationHistory.Entry> entries, String id) { for (SchemaMigrationHistory.Entry entry : entries) if (entry.migrationId().equalsIgnoreCase(id)) return entry; return null; }
    private static DBSchemaMigration findMigration(List<DBSchemaMigration> migrations, String id) { if (id == null) return null; for (DBSchemaMigration migration : migrations) if (migration.id().equalsIgnoreCase(id)) return migration; return null; }
    private static String normalizeId(String id) { return id.toLowerCase(Locale.ROOT); }
    private void requireConnection(Connection connection) { if (connection == null) throw new IllegalArgumentException("connection must not be null"); }
}
