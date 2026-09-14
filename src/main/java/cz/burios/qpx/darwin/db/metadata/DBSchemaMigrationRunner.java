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

    public DBSchemaMigrationRunner(DBDialect dialect, List<DBSchemaMigration> migrations) {
        this(new DBSchemaMigrator(dialect), migrations);
    }

    public DBSchemaMigrationRunner(DBSchemaMigrator migrator, List<DBSchemaMigration> migrations) {
        if (migrator == null) throw new IllegalArgumentException("migrator must not be null");
        if (migrations == null) throw new IllegalArgumentException("migrations must not be null");
        List<DBSchemaMigration> copy = new ArrayList<>(migrations);
        Set<String> ids = new HashSet<>();
        for (DBSchemaMigration migration : copy) {
            if (migration == null) throw new IllegalArgumentException("migration must not be null");
            if (!ids.add(migration.id().toLowerCase(java.util.Locale.ROOT))) {
                throw new IllegalArgumentException("duplicate migration ID: " + migration.id());
            }
        }
        this.migrator = migrator;
        this.migrations = Collections.unmodifiableList(copy);
    }

    public DBSchemaMigrationRunner(DBDialect dialect, DBSchemaMigration... migrations) {
        this(dialect, List.of(migrations));
    }

    public DBSchemaMigrator migrator() { return migrator; }
    public SchemaMigrationHistory history() { return migrator.history(); }
    public List<DBSchemaMigration> migrations() { return migrations; }

    /** Returns all migrations not yet marked APPLIED, preserving declaration order. */
    public List<DBSchemaMigration> pending(Connection connection) throws SQLException {
        requireConnection(connection);
        history().ensureTable(connection);
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        List<DBSchemaMigration> result = new ArrayList<>();
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = find(entries, migration.id());
            if (entry == null || entry.status() != SchemaMigrationHistory.Status.APPLIED) result.add(migration);
        }
        return Collections.unmodifiableList(result);
    }

    /** Validates that the persisted history represents a contiguous migration sequence. */
    public void validate(Connection connection) throws SQLException {
        requireConnection(connection);
        history().ensureTable(connection);
        List<SchemaMigrationHistory.Entry> entries = history().list(connection);
        boolean previousPending = false;
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = find(entries, migration.id());
            if (entry == null) {
                previousPending = true;
                continue;
            }
            if (entry.status() == SchemaMigrationHistory.Status.RUNNING) {
                throw new SchemaMigrationException("Migration is still RUNNING: " + migration.id());
            }
            if (entry.status() == SchemaMigrationHistory.Status.FAILED) {
                throw new SchemaMigrationException("Migration has FAILED: " + migration.id()
                        + (entry.errorMessage() == null ? "" : " - " + entry.errorMessage()));
            }
            if (previousPending) {
                throw new SchemaMigrationException("Migration history has a gap before: " + migration.id());
            }
        }
        // An applied history entry that is not part of the declared sequence is unsafe to ignore.
        for (SchemaMigrationHistory.Entry entry : entries) {
            if (find(migrations, entry.migrationId()) == null) {
                throw new SchemaMigrationException("Migration history contains undeclared migration: " + entry.migrationId());
            }
        }
    }

    /** Applies every pending migration in declaration order; each migration is transactional and recorded. */
    public List<SchemaDiff> migrate(Connection connection) throws SQLException {
        requireConnection(connection);
        validate(connection);
        List<SchemaDiff> applied = new ArrayList<>();
        for (DBSchemaMigration migration : migrations) {
            SchemaMigrationHistory.Entry entry = history().find(connection, migration.id());
            if (entry != null && entry.status() == SchemaMigrationHistory.Status.APPLIED) continue;
            applied.add(migrator.migrateRecorded(connection, migration.desired(), migration.id(),
                    migration.includeDrops(), true));
        }
        return Collections.unmodifiableList(applied);
    }

    private static SchemaMigrationHistory.Entry find(List<SchemaMigrationHistory.Entry> entries, String id) {
        for (SchemaMigrationHistory.Entry entry : entries) if (entry.migrationId().equals(id)) return entry;
        return null;
    }

    private static DBSchemaMigration find(List<DBSchemaMigration> migrations, String id) {
        for (DBSchemaMigration migration : migrations) if (migration.id().equals(id)) return migration;
        return null;
    }

    private static void requireConnection(Connection connection) {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
    }
}
