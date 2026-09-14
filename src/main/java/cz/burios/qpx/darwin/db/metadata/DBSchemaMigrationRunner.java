package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

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
            if (!ids.add(migration.id().toLowerCase(java.util.Locale.ROOT))) throw new IllegalArgumentException("duplicate migration ID: " + migration.id());
        }
        this.migrator = migrator; this.migrations = Collections.unmodifiableList(copy);
    }
    public DBSchemaMigrationRunner(DBDialect dialect, DBSchemaMigration... migrations) { this(dialect, List.of(migrations)); }
    public DBSchemaMigrator migrator() { return migrator; }
    public SchemaMigrationHistory history() { return migrator.history(); }
    public List<DBSchemaMigration> migrations() { return migrations; }

    public List<DBSchemaMigration> pending(Connection connection) throws SQLException {
        requireConnection(connection); history().ensureTable(connection); List<SchemaMigrationHistory.Entry> entries = history().list(connection);
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
        List<DBSchemaMigrationPlan> result = new ArrayList<>();
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = findEntry(entries, migration.id());
            if (entry != null && entry.status() == SchemaMigrationHistory.Status.APPLIED) continue;
            SchemaDiff diff = migrator.plan(connection, migration.desired(), migration.includeDrops());
            result.add(new DBSchemaMigrationPlan(migration, diff, diff.planHash()));
        }
        return Collections.unmodifiableList(result);
    }

    /** Validates that persisted history represents a contiguous migration sequence. */
    public void validate(Connection connection) throws SQLException {
        requireConnection(connection); history().ensureTable(connection); validateEntries(history().list(connection), null);
    }

    /** Applies every pending migration in declaration order; FAILED migrations are never retried implicitly. */
    public List<SchemaDiff> migrate(Connection connection) throws SQLException {
        requireConnection(connection); validate(connection); List<SchemaDiff> applied = new ArrayList<>();
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = history().find(connection, migration.id());
            if (entry != null && entry.status() == SchemaMigrationHistory.Status.APPLIED) continue;
            applied.add(migrator.migrateRecorded(connection, migration.desired(), migration.id(), migration.includeDrops(), true));
        }
        return Collections.unmodifiableList(applied);
    }

    /** Explicitly retries one FAILED migration after validating its position in the declared sequence. */
    public SchemaDiff retry(Connection connection, String migrationId) throws SQLException {
        requireConnection(connection);
        DBSchemaMigration migration = findMigration(migrations, migrationId);
        if (migration == null) throw new SchemaMigrationException("Migration is not declared: " + migrationId);
        history().ensureTable(connection);
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        validateEntries(entries, migrationId);
        SchemaMigrationHistory.Entry entry = findEntry(entries, migrationId);
        if (entry == null) throw new SchemaMigrationException("Migration has no persisted FAILED entry: " + migrationId);
        if (entry.status() != SchemaMigrationHistory.Status.FAILED) throw new SchemaMigrationException("Only FAILED migration can be retried: " + migrationId + " (status=" + entry.status() + ")");
        SchemaDiff current = migrator.plan(connection, migration.desired(), migration.includeDrops());
        if (!entry.planHash().equalsIgnoreCase(current.planHash())) throw new SchemaMigrationException("Migration plan hash changed: " + migrationId + " (stored=" + entry.planHash() + ", current=" + current.planHash() + ")");
        return migrator.retryRecorded(connection, migration.desired(), migration.id(), migration.includeDrops(), true);
    }

    private void validateEntries(List<SchemaMigrationHistory.Entry> entries, String retryId) throws SQLException {
        boolean previousPending = false;
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = findEntry(entries, migration.id());
            if (entry == null) { previousPending = true; continue; }
            boolean allowedFailed = retryId != null && migration.id().equals(retryId) && entry.status() == SchemaMigrationHistory.Status.FAILED;
            if (entry.status() == SchemaMigrationHistory.Status.RUNNING) throw new SchemaMigrationException("Migration is still RUNNING: " + migration.id());
            if (entry.status() == SchemaMigrationHistory.Status.FAILED && !allowedFailed) throw new SchemaMigrationException("Migration has FAILED: " + migration.id() + (entry.errorMessage() == null ? "" : " - " + entry.errorMessage()));
            if (previousPending && entry.status() == SchemaMigrationHistory.Status.APPLIED) throw new SchemaMigrationException("Migration history has a gap before: " + migration.id());
            if (entry.status() == SchemaMigrationHistory.Status.FAILED) previousPending = true;
        }
        for (SchemaMigrationHistory.Entry entry : entries) if (findMigration(migrations, entry.migrationId()) == null)
            throw new SchemaMigrationException("Migration history contains undeclared migration: " + entry.migrationId());
    }

    private static SchemaMigrationHistory.Entry findEntry(List<SchemaMigrationHistory.Entry> entries, String id) { for (SchemaMigrationHistory.Entry entry : entries) if (entry.migrationId().equals(id)) return entry; return null; }
    private static DBSchemaMigration findMigration(List<DBSchemaMigration> migrations, String id) { for (DBSchemaMigration migration : migrations) if (migration.id().equals(id)) return migration; return null; }
    private static void requireConnection(Connection connection) { if (connection == null) throw new IllegalArgumentException("connection must not be null"); }
}
