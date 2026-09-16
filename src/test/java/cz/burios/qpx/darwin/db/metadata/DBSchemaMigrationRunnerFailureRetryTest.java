package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable regression test for runner-managed transactional failure and retry. */
public final class DBSchemaMigrationRunnerFailureRetryTest {
    public static void main(String[] args) throws Exception {
        H2Dialect delegate = new H2Dialect();
        DBDialect failingDialect = new DBDialect() {
            private int columnDefinitions;

            @Override public String name() { return "h2-runner-transactional-failure"; }

            @Override public String columnDefinition(ColumnMetaData column) {
                columnDefinitions++;
                if (columnDefinitions == 2)
                    throw new IllegalStateException("simulated runner transactional DDL failure");
                return delegate.columnDefinition(column);
            }

            @Override public String tableName(TableMetaData table) { return delegate.tableName(table); }
            @Override public String quote(String name) { return delegate.quote(name); }
            @Override public ColumnType logicalType(ColumnMetaData column) { return delegate.logicalType(column); }
        };

        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("RUNNER_FIRST")
                        .addColumn(new ColumnMetaData("ID").longType().nullable(false)))
                .add(new TableMetaData("RUNNER_SECOND")
                        .addColumn(new ColumnMetaData("ID").longType().nullable(false)));
        DBSchemaMigration migration = new DBSchemaMigration("V-RUNNER", "runner failure", desired);

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_runner_failure_retry;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(failingDialect, migration);

            try {
                runner.migrate(connection, true);
                throw new AssertionError("Transactional runner migration must fail");
            } catch (IllegalStateException expected) {
                if (!expected.getMessage().contains("simulated runner transactional DDL failure"))
                    throw new AssertionError("Unexpected migration failure: " + expected.getMessage());
            }

            SchemaMigrationHistory.Entry failed = runner.history().find(connection, migration.id());
            if (failed == null || failed.status() != SchemaMigrationHistory.Status.FAILED)
                throw new AssertionError("Runner must persist FAILED status: " + failed);
            if (failed.errorMessage() == null || !failed.errorMessage().contains("simulated runner transactional DDL failure"))
                throw new AssertionError("Runner must persist the failure message: " + failed);
            if (!migration.definitionHash().equalsIgnoreCase(failed.definitionHash()))
                throw new AssertionError("Runner must persist definition hash on failure");
            if (DBMetaData.load(connection).table("RUNNER_FIRST") != null)
                throw new AssertionError("Transactional runner failure must roll back RUNNER_FIRST");
            if (DBMetaData.load(connection).table("RUNNER_SECOND") != null)
                throw new AssertionError("RUNNER_SECOND must not exist after failure");
            if (!connection.getAutoCommit())
                throw new AssertionError("Runner must restore auto-commit after failure");

            // A retry must use the same declaration but may rebuild its current executable plan.
            DBSchemaMigrationRunner retryRunner = new DBSchemaMigrationRunner(
                    new DBSchemaMigrator(new H2Dialect()), migration);
            SchemaDiff retried = retryRunner.retry(connection, migration.id(), true);
            if (retried.size() != 2)
                throw new AssertionError("Retry after transactional rollback must contain both changes");

            SchemaMigrationHistory.Entry applied = retryRunner.history().find(connection, migration.id());
            if (applied == null || applied.status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Successful retry must be APPLIED: " + applied);
            if (!applied.planHash().equalsIgnoreCase(retried.planHash()))
                throw new AssertionError("Successful retry must persist the retry plan hash");
            if (applied.errorMessage() != null)
                throw new AssertionError("Successful retry must clear the error message");
            if (DBMetaData.load(connection).table("RUNNER_FIRST") == null
                    || DBMetaData.load(connection).table("RUNNER_SECOND") == null)
                throw new AssertionError("Successful retry must create both tables");
        }

        System.out.println("DBSchemaMigrationRunnerFailureRetryTest: OK");
    }
}
