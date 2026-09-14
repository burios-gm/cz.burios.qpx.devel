package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable integration test for ordered, persistent schema migration execution. */
public final class DBSchemaMigrationRunnerTest {
    public static void main(String[] args) throws Exception {
        DBMetaData v1 = new DBMetaData().add(new TableMetaData("STORE")
                .addColumn(new ColumnMetaData("ID").type("BIGINT")));
        DBMetaData v2 = new DBMetaData()
                .add(new TableMetaData("STORE").addColumn(new ColumnMetaData("ID").type("BIGINT")))
                .add(new TableMetaData("PRODUCT").addColumn(new ColumnMetaData("ID").type("BIGINT")));
        List<DBSchemaMigration> migrations = List.of(
                new DBSchemaMigration("V001", "create store", v1),
                new DBSchemaMigration("V002", "create product", v2));

        String json;
        try (Connection planningConnection = DriverManager.getConnection(
                "jdbc:h2:mem:migration_approval_plan;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner planner = new DBSchemaMigrationRunner(new H2Dialect(), migrations);
            if (planner.pending(planningConnection).size() != 2) throw new AssertionError("Expected two pending migrations");
            List<DBSchemaMigrationPlan> planned = planner.planPending(planningConnection);
            if (planned.size() != 2) throw new AssertionError("Expected two planned migrations");
            if (planned.get(0).migration() != planner.migrations().get(0))
                throw new AssertionError("Plan must retain migration declaration");
            if (planned.get(0).diff().isEmpty() || planned.get(0).planHash().length() != 64)
                throw new AssertionError("Expected non-empty first plan with SHA-256 hash");

            json = planned.get(0).toJson();
            if (!json.contains("\"migrationId\":\"V001\""))
                throw new AssertionError("Plan JSON must contain migration ID");
            if (!json.contains("\"planHash\":\"" + planned.get(0).planHash() + "\""))
                throw new AssertionError("Plan JSON must contain plan hash");
            if (!json.contains("\"changes\""))
                throw new AssertionError("Plan JSON must contain executable changes");

            DBSchemaMigrationPlan restored = DBSchemaMigrationPlan.fromJson(json);
            if (!restored.migration().id().equals(planned.get(0).migration().id()))
                throw new AssertionError("Restored plan must retain migration ID");
            if (!restored.planHash().equals(planned.get(0).planHash()))
                throw new AssertionError("Restored plan hash must match original");
            if (!restored.diff().toJson().equals(planned.get(0).diff().toJson()))
                throw new AssertionError("Restored changes must match original");

            try {
                DBSchemaMigrationPlan.fromJson(json.replace(planned.get(0).planHash(),
                        "0000000000000000000000000000000000000000000000000000000000000000"));
                throw new AssertionError("Tampered plan hash should be rejected");
            } catch (IllegalArgumentException expected) { }
            if (planner.history().list(planningConnection).size() != 0)
                throw new AssertionError("Planning must not create history entries");
        }

        // Simulate approval JSON being stored/transferred and later consumed by another runner.
        try (Connection applicationConnection = DriverManager.getConnection(
                "jdbc:h2:mem:migration_approval_apply;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner approver = new DBSchemaMigrationRunner(new H2Dialect(), migrations);
            DBSchemaMigrationPlan restored = DBSchemaMigrationPlan.fromJson(json);
            SchemaDiff approved = approver.applyJson(applicationConnection, json);
            if (!approved.toJson().equals(restored.diff().toJson()))
                throw new AssertionError("JSON approval must apply the deserialized executable changes");
            if (approver.history().find(applicationConnection, "V001").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Approved plan should mark migration APPLIED");
            if (approver.pending(applicationConnection).size() != 1)
                throw new AssertionError("Expected one pending migration after applying first plan");

            if (applicationConnection.getMetaData().getTables(null, null, "STORE", null).next() == false)
                throw new AssertionError("Approved plan should create STORE table");

            try {
                approver.applyJson(applicationConnection, json);
                throw new AssertionError("An already applied plan must not be applied twice");
            } catch (SchemaMigrationException expected) { }

            if (approver.migrate(applicationConnection).size() != 1)
                throw new AssertionError("Expected remaining migration to be applied");
            if (!approver.pending(applicationConnection).isEmpty())
                throw new AssertionError("Expected no pending migrations");
            if (!approver.planPending(applicationConnection).isEmpty())
                throw new AssertionError("Expected no pending plans");
            if (approver.migrate(applicationConnection).size() != 0)
                throw new AssertionError("Migration run should be idempotent");
            if (approver.history().list(applicationConnection).size() != 2)
                throw new AssertionError("Expected two history entries");
        }

        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:migration_retry;DB_CLOSE_DELAY=-1")) {
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

        try {
            new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                    new DBSchemaMigration("V001", "one", v1),
                    new DBSchemaMigration("v001", "duplicate", v2)));
            throw new AssertionError("Duplicate migration IDs should fail case-insensitively");
        } catch (IllegalArgumentException expected) { }

        System.out.println("DBSchemaMigrationRunnerTest: OK");
    }
}
