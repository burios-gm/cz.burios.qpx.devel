package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.*;

/** Executable regression test for FAILED migration retry after partial non-transactional DDL. */
public final class DBSchemaMigrationFailureRetryTest {
    public static void main(String[] args) throws Exception {
        H2Dialect delegate = new H2Dialect();
        DBDialect flakyDialect = new DBDialect() {
            private int columnDefinitions;

            @Override public String name() { return "h2-flaky-ddl"; }

            @Override public String columnDefinition(ColumnMetaData column) {
                columnDefinitions++;
                if (columnDefinitions == 2)
                    throw new IllegalStateException("simulated transient DDL failure");
                return delegate.columnDefinition(column);
            }

            @Override public String tableName(TableMetaData table) { return delegate.tableName(table); }
            @Override public String quote(String name) { return delegate.quote(name); }
            @Override public ColumnType logicalType(ColumnMetaData column) { return delegate.logicalType(column); }
        };

        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("RETRY_FIRST")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false)))
                .add(new TableMetaData("RETRY_SECOND")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false)));
        DBSchemaMigration migration = new DBSchemaMigration("V-RETRY", "transient ddl failure", desired);

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_failure_retry;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(flakyDialect, migration);

            SchemaDiff originalPlan = runner.migrator().plan(connection, desired);
            if (originalPlan.size() != 2) throw new AssertionError("Initial migration must contain two CREATE_TABLE changes");

            try {
                runner.migrate(connection, false);
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
            if (!failed.planHash().equals(originalPlan.planHash()))
                throw new AssertionError("Failed migration must persist the original plan hash");
            if (!migration.definitionHash().equalsIgnoreCase(failed.definitionHash()))
                throw new AssertionError("Failed migration must persist its definition hash");

            if (DBMetaData.load(connection).table("RETRY_FIRST") == null)
                throw new AssertionError("Non-transactional failure should preserve already executed DDL");
            if (DBMetaData.load(connection).table("RETRY_SECOND") != null)
                throw new AssertionError("Failed DDL must not create RETRY_SECOND");

            SchemaDiff retryPlan = runner.migrator().plan(connection, desired);
            if (retryPlan.size() != 1) throw new AssertionError("Retry plan must contain only the still-pending table");
            if (retryPlan.planHash().equals(originalPlan.planHash()))
                throw new AssertionError("Partial DDL must change the pending retry plan hash");

            SchemaDiff retried = runner.retry(connection, migration.id(), false);
            if (retried.isEmpty() || retried.size() != 1)
                throw new AssertionError("Retry must execute exactly the remaining migration change");

            SchemaMigrationHistory.Entry applied = runner.history().find(connection, migration.id());
            if (applied == null || applied.status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Successful retry must be marked APPLIED: " + applied);
            if (!applied.planHash().equalsIgnoreCase(retried.planHash()))
                throw new AssertionError("Successful retry must persist the current retry plan hash");
            if (applied.errorMessage() != null) throw new AssertionError("Successful retry must clear the error message");
            if (!connection.getAutoCommit()) throw new AssertionError("Retry must restore auto-commit");
            if (DBMetaData.load(connection).table("RETRY_FIRST") == null
                    || DBMetaData.load(connection).table("RETRY_SECOND") == null)
                throw new AssertionError("Successful retry must leave both desired tables present");

            try {
                runner.retry(connection, migration.id(), false);
                throw new AssertionError("Retry of an APPLIED migration must fail");
            } catch (SchemaMigrationException expected) { }
        }

        System.out.println("DBSchemaMigrationFailureRetryTest: OK");
    }
}
