package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable regression test for RUNNING -> FAILED -> retry -> APPLIED migration flow. */
public final class DBSchemaMigrationFailureRetryTest {
    public static void main(String[] args) throws Exception {
        H2Dialect delegate = new H2Dialect();
        DBDialect flakyDialect = new DBDialect() {
            private boolean fail = true;

            @Override public String name() { return "h2-flaky-ddl"; }

            @Override public String columnDefinition(ColumnMetaData column) {
                if (fail) {
                    fail = false;
                    throw new IllegalStateException("simulated transient DDL failure");
                }
                return delegate.columnDefinition(column);
            }

            @Override public String tableName(TableMetaData table) { return delegate.tableName(table); }
            @Override public String quote(String name) { return delegate.quote(name); }
            @Override public ColumnType logicalType(ColumnMetaData column) { return delegate.logicalType(column); }
        };

        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("RETRY_TEST")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false)));
        DBSchemaMigration migration = new DBSchemaMigration("V-RETRY", "transient ddl failure", desired);

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_failure_retry;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(flakyDialect, migration);

            try {
                runner.migrate(connection);
                throw new AssertionError("The first migration attempt must fail");
            } catch (IllegalStateException expected) {
                if (!expected.getMessage().contains("simulated transient DDL failure"))
                    throw new AssertionError("Unexpected migration failure: " + expected.getMessage());
            }

            SchemaMigrationHistory.Entry failed = runner.history().find(connection, migration.id());
            if (failed == null) throw new AssertionError("Failed migration must have a history entry");
            if (failed.status() != SchemaMigrationHistory.Status.FAILED)
                throw new AssertionError("Failed migration must be marked FAILED: " + failed);
            if (failed.errorMessage() == null || !failed.errorMessage().contains("simulated transient DDL failure"))
                throw new AssertionError("Failure history must preserve the error message: " + failed);
            if (!failed.planHash().equals(runner.migrator().plan(connection, desired).planHash()))
                throw new AssertionError("Retry plan must initially match the persisted failed plan");
            if (!migration.definitionHash().equalsIgnoreCase(failed.definitionHash()))
                throw new AssertionError("Failed migration must persist its definition hash");
            if (DBMetaData.load(connection).table("RETRY_TEST") != null)
                throw new AssertionError("Failed DDL must not leave RETRY_TEST behind");

            SchemaDiff retried = runner.retry(connection, migration.id());
            if (retried.isEmpty()) throw new AssertionError("Retry must execute the pending migration");

            SchemaMigrationHistory.Entry applied = runner.history().find(connection, migration.id());
            if (applied == null || applied.status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Successful retry must be marked APPLIED: " + applied);
            if (applied.errorMessage() != null) throw new AssertionError("Successful retry must clear the error message");
            if (!connection.getAutoCommit()) throw new AssertionError("Retry must restore auto-commit");
            if (DBMetaData.load(connection).table("RETRY_TEST") == null)
                throw new AssertionError("Successful retry must create RETRY_TEST");

            try {
                runner.retry(connection, migration.id());
                throw new AssertionError("Retry of an APPLIED migration must fail");
            } catch (SchemaMigrationException expected) { }
        }

        System.out.println("DBSchemaMigrationFailureRetryTest: OK");
    }
}
