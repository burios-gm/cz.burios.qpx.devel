package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable regression test for stale approval protection. */
public final class DBSchemaMigrationSourceHashTest {
    public static void main(String[] args) throws Exception {
        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("STORE")
                        .addColumn(new ColumnMetaData("ID").longType().primaryKey(true)));
        DBSchemaMigration migration = new DBSchemaMigration("V001", "create store", desired);

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_source_hash;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), migration);
            DBSchemaMigrationPlan plan = runner.planPending(connection).get(0);
            DBSchemaMigrationApproval approval = plan.approval();
            String json = approval.toJson();
            if (!json.contains("\"sourceHash\"")) throw new AssertionError("Approval JSON must contain sourceHash");
            if (!approval.sourceHash().equals(DBMetaData.load(connection).fingerprint()))
                throw new AssertionError("Plan sourceHash must match the metadata snapshot used for planning");

            try (var statement = connection.createStatement()) {
                statement.executeUpdate("CREATE TABLE OTHER (ID BIGINT)");
            }
            try {
                runner.applyJson(connection, json);
                throw new AssertionError("Approval must be rejected after source metadata changes");
            } catch (SchemaMigrationException expected) {
                if (!expected.getMessage().contains("source metadata has changed"))
                    throw new AssertionError("Unexpected stale approval error: " + expected.getMessage());
            }

            try (var statement = connection.createStatement()) {
                statement.executeUpdate("DROP TABLE OTHER");
            }
            runner.applyJson(connection, json);
            if (runner.history().find(connection, "V001").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Approval should apply after the source metadata is restored");
        }

        // Verify that source metadata changes involving columns and indexes also invalidate an approval.
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_source_hash_objects;DB_CLOSE_DELAY=-1")) {
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("CREATE TABLE STORE (ID BIGINT NOT NULL)");
            }

            DBMetaData desiredObjects = new DBMetaData()
                    .add(new TableMetaData("STORE")
                            .addColumn(new ColumnMetaData("ID").longType().primaryKey(false))
                            .addColumn(new ColumnMetaData("NAME").string(100))
                            .addIndex(new IndexMetaData("IDX_STORE_NAME").column("NAME")));
            DBSchemaMigration migrationObjects = new DBSchemaMigration("V002", "add store name", desiredObjects);
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), migrationObjects);
            DBSchemaMigrationApproval approval = runner.planPending(connection).get(0).approval();

            try (var statement = connection.createStatement()) {
                statement.executeUpdate("ALTER TABLE STORE ADD COLUMN EXTERNAL_FLAG BOOLEAN");
            }
            try {
                runner.applyApproval(connection, approval);
                throw new AssertionError("Approval must be rejected after a column metadata change");
            } catch (SchemaMigrationException expected) {
                if (!expected.getMessage().contains("source metadata has changed"))
                    throw new AssertionError("Unexpected column-change error: " + expected.getMessage());
            }
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("ALTER TABLE STORE DROP COLUMN EXTERNAL_FLAG");
                statement.executeUpdate("CREATE INDEX IDX_EXTERNAL ON STORE(ID)");
            }
            try {
                runner.applyApproval(connection, approval);
                throw new AssertionError("Approval must be rejected after an index metadata change");
            } catch (SchemaMigrationException expected) {
                if (!expected.getMessage().contains("source metadata has changed"))
                    throw new AssertionError("Unexpected index-change error: " + expected.getMessage());
            }
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("DROP INDEX IDX_EXTERNAL");
            }
            runner.applyApproval(connection, approval);
            if (runner.history().find(connection, "V002").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Approval should apply after column/index metadata is restored");
        }

        System.out.println("DBSchemaMigrationSourceHashTest: OK");
    }
}
