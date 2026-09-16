package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable integration test for persistent migration history. */
public final class SchemaMigrationHistoryTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_history;DB_CLOSE_DELAY=-1")) {
            SchemaMigrationHistory history = new SchemaMigrationHistory();
            history.ensureTable(connection);
            history.ensureTable(connection);

            DBSchemaMigrator migrator = new DBSchemaMigrator(new H2Dialect());
            DBMetaData desired = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT")));
            SchemaDiff plan = migrator.plan(connection, desired);
            String hash = plan.planHash();
            if (hash.length() != 64) throw new AssertionError("Invalid plan hash: " + hash);

            history.start(connection, "V1", hash);
            if (history.find(connection, "V1").status() != SchemaMigrationHistory.Status.RUNNING)
                throw new AssertionError("Expected RUNNING history entry");
            history.markApplied(connection, "V1");
            if (history.find(connection, "V1").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Expected APPLIED history entry");

            try {
                history.start(connection, "v1", hash);
                throw new AssertionError("Case-insensitive duplicate migration ID should fail");
            } catch (SchemaMigrationException expected) { }

            SchemaMigrationHistory.Entry stored = history.find(connection, "v1");
            if (!"v1".equalsIgnoreCase(stored.migrationId()))
                throw new AssertionError("Migration lookup must remain case-insensitive: " + stored);

            history.start(connection, "V2", hash);
            history.markFailed(connection, "V2", "test failure");
            SchemaMigrationHistory.Entry failed = history.find(connection, "V2");
            if (failed.status() != SchemaMigrationHistory.Status.FAILED || !"test failure".equals(failed.errorMessage()))
                throw new AssertionError("Expected FAILED history entry: " + failed);
            if (history.list(connection).size() != 2) throw new AssertionError("Expected two history entries");
        }
        System.out.println("SchemaMigrationHistoryTest: OK");
    }
}
