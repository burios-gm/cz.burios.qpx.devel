package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable integration test for ordered, persistent schema migration execution. */
public final class DBSchemaMigrationRunnerTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_runner;DB_CLOSE_DELAY=-1")) {
            DBMetaData v1 = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT")));
            DBMetaData v2 = new DBMetaData()
                    .add(new TableMetaData("STORE").addColumn(new ColumnMetaData("ID").type("BIGINT")))
                    .add(new TableMetaData("PRODUCT").addColumn(new ColumnMetaData("ID").type("BIGINT")));
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                    new DBSchemaMigration("V001", "create store", v1), new DBSchemaMigration("V002", "create product", v2)));
            if (runner.pending(connection).size() != 2) throw new AssertionError("Expected two pending migrations");
            List<DBSchemaMigrationPlan> planned = runner.planPending(connection);
            if (planned.size() != 2) throw new AssertionError("Expected two planned migrations");
            if (planned.get(0).migration() != runner.migrations().get(0)) throw new AssertionError("Plan must retain migration declaration");
            if (planned.get(0).diff().isEmpty() || planned.get(0).planHash().length() != 64)
                throw new AssertionError("Expected non-empty first plan with SHA-256 hash");
            if (runner.history().list(connection).size() != 0) throw new AssertionError("Planning must not create history entries");
            if (runner.migrate(connection).size() != 2) throw new AssertionError("Expected two applied migrations");
            if (!runner.pending(connection).isEmpty()) throw new AssertionError("Expected no pending migrations");
            if (!runner.planPending(connection).isEmpty()) throw new AssertionError("Expected no pending plans");
            if (runner.migrate(connection).size() != 0) throw new AssertionError("Migration run should be idempotent");
            if (runner.history().list(connection).size() != 2) throw new AssertionError("Expected two history entries");
            try {
                new DBSchemaMigrationRunner(new H2Dialect(), List.of(new DBSchemaMigration("V001", "one", v1),
                        new DBSchemaMigration("v001", "duplicate", v2)));
                throw new AssertionError("Duplicate migration IDs should fail case-insensitively");
            } catch (IllegalArgumentException expected) { }
        }

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_retry;DB_CLOSE_DELAY=-1")) {
            DBMetaData original = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT")));
            DBMetaData changed = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT"))
                    .addColumn(new ColumnMetaData("NAME").type("VARCHAR(100)")));
            DBSchemaMigration migration = new DBSchemaMigration("V001", "retry me", original);
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), migration);
            SchemaDiff originalPlan = runner.migrator().plan(connection, original);
            runner.history().ensureTable(connection);
            runner.history().start(connection, migration.id(), originalPlan.planHash());
            runner.history().markFailed(connection, migration.id(), "simulated failure");
            try {
                new DBSchemaMigrationRunner(new DBSchemaMigrator(new H2Dialect()), List.of(
                        new DBSchemaMigration("V001", "changed", changed))).retry(connection, "V001");
                throw new AssertionError("Changed failed migration must be rejected");
            } catch (SchemaMigrationException expected) { }
            SchemaDiff retried = runner.retry(connection, "V001");
            if (retried.isEmpty()) throw new AssertionError("Retry should apply the failed migration");
            if (runner.history().find(connection, "V001").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Retry should mark migration APPLIED");
            try {
                runner.retry(connection, "V001");
                throw new AssertionError("Retry of APPLIED migration should fail");
            } catch (SchemaMigrationException expected) { }
        }
        System.out.println("DBSchemaMigrationRunnerTest: OK");
    }
}
