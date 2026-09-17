package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.*;

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
        try (Connection planningConnection = DriverManager.getConnection("jdbc:h2:mem:migration_approval_plan;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner planner = new DBSchemaMigrationRunner(new H2Dialect(), migrations);
            List<DBSchemaMigrationPlan> planned = planner.planPending(planningConnection);
            if (planned.size() != 2) throw new AssertionError("Expected two planned migrations");
            if (planned.get(0).diff().isEmpty() || planned.get(0).planHash().length() != 64)
                throw new AssertionError("Expected non-empty first plan with SHA-256 hash");
            if (planned.get(0).sourceHash() == null || planned.get(0).sourceHash().length() != 64)
                throw new AssertionError("Expected source metadata SHA-256 hash");

            DBSchemaMigrationApproval approval = DBSchemaMigrationApproval.fromPlan(planned.get(0));
            json = approval.toJson();
            if (!json.contains("\"migrationId\":\"V001\"")) throw new AssertionError("Approval JSON must contain migration ID");
            if (!json.contains("\"description\":\"create store\"")) throw new AssertionError("Approval JSON must contain migration description");
            if (!json.contains("\"includeDrops\":false")) throw new AssertionError("Approval JSON must contain includeDrops");
            if (!json.contains("\"planFormat\":1")) throw new AssertionError("Approval JSON must contain plan format");
            if (!json.contains("\"planHash\":\"" + approval.planHash() + "\"")) throw new AssertionError("Approval JSON must contain plan hash");
            if (!json.contains("\"sourceHash\":\"" + approval.sourceHash() + "\"")) throw new AssertionError("Approval JSON must contain source hash");
            if (!json.contains("\"changes\"")) throw new AssertionError("Approval JSON must contain executable changes");

            DBSchemaMigrationApproval restored = DBSchemaMigrationApproval.fromJson(json);
            if (!restored.migrationId().equals(approval.migrationId())) throw new AssertionError("Restored approval must retain migration ID");
            if (!restored.description().equals(approval.description())) throw new AssertionError("Restored approval must retain migration description");
            if (restored.includeDrops() != approval.includeDrops()) throw new AssertionError("Restored approval must retain includeDrops");
            if (restored.planFormat() != approval.planFormat()) throw new AssertionError("Restored approval must retain plan format");
            if (!restored.planHash().equals(approval.planHash())) throw new AssertionError("Restored approval hash must match original");
            if (!restored.sourceHash().equals(approval.sourceHash())) throw new AssertionError("Restored source hash must match original");
            if (!restored.diff().toJson().equals(approval.diff().toJson())) throw new AssertionError("Restored changes must match original");
            try {
                DBSchemaMigrationApproval.fromJson(json.replace(approval.planHash(), "0000000000000000000000000000000000000000000000000000000000000000"));
                throw new AssertionError("Tampered approval hash should be rejected");
            } catch (IllegalArgumentException expected) { }
            try {
                DBSchemaMigrationApproval.fromJson(json.replace("\"planFormat\":1", "\"planFormat\":999"));
                throw new AssertionError("Unknown plan format should be rejected");
            } catch (IllegalArgumentException expected) { }
            try {
                DBSchemaMigrationApproval.fromJson(json.replace(",\"includeDrops\":false", ""));
                throw new AssertionError("Approval JSON without includeDrops must be rejected");
            } catch (IllegalArgumentException expected) { }
            if (planner.history().list(planningConnection).size() != 0) throw new AssertionError("Planning must not create history entries");
        }

        // Simulate approval JSON being stored/transferred and later consumed by another runner.
        try (Connection applicationConnection = DriverManager.getConnection("jdbc:h2:mem:migration_approval_apply;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner approver = new DBSchemaMigrationRunner(new H2Dialect(), migrations);
            DBSchemaMigrationApproval restored = DBSchemaMigrationApproval.fromJson(json);
            SchemaDiff approved = approver.applyApproval(applicationConnection, restored);
            SchemaMigrationHistory.Entry firstEntry = approver.history().find(applicationConnection, "V001");
            if (firstEntry == null || firstEntry.status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Approved migration should be APPLIED");
            if (!migrations.get(0).definitionHash().equalsIgnoreCase(firstEntry.definitionHash()))
                throw new AssertionError("Applied migration must persist its definition hash");
            if (!approved.toJson().equals(restored.diff().toJson())) throw new AssertionError("Approval must apply the exact deserialized changes");
            try (var tables = applicationConnection.getMetaData().getTables(null, null, "STORE", null)) {
                if (!tables.next()) throw new AssertionError("Approved migration should create STORE table");
            }
            try {
                approver.applyJson(applicationConnection, json);
                throw new AssertionError("An already applied approval must not be applied twice");
            } catch (SchemaMigrationException expected) { }

            // V002 is still pending: a declaration mismatch must be rejected before execution.
            DBSchemaMigrationApproval v2Approval = DBSchemaMigrationApproval.fromPlan(approver.planPending(applicationConnection).get(0));
            DBSchemaMigrationApproval mismatchedDescription = new DBSchemaMigrationApproval(
                    v2Approval.migrationId(), "wrong description", v2Approval.includeDrops(), v2Approval.planFormat(),
                    v2Approval.diff(), v2Approval.planHash(), v2Approval.sourceHash());
            try {
                approver.applyApproval(applicationConnection, mismatchedDescription);
                throw new AssertionError("Approval with mismatched migration description should be rejected");
            } catch (SchemaMigrationException expected) { }

            if (approver.migrate(applicationConnection).size() != 1) throw new AssertionError("Expected remaining migration to be applied");
            if (!approver.pending(applicationConnection).isEmpty()) throw new AssertionError("Expected no pending migrations");
            if (!approver.planPending(applicationConnection).isEmpty()) throw new AssertionError("Expected no pending plans");
            if (approver.migrate(applicationConnection).size() != 0) throw new AssertionError("Migration run should be idempotent");
            if (approver.history().list(applicationConnection).size() != 2) throw new AssertionError("Expected two history entries");
        }

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_retry;DB_CLOSE_DELAY=-1")) {
            DBMetaData original = new DBMetaData().add(new TableMetaData("STORE").addColumn(new ColumnMetaData("ID").type("BIGINT")));
            DBMetaData changed = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT"))
                    .addColumn(new ColumnMetaData("NAME").type("VARCHAR(100)")));
            DBSchemaMigration migration = new DBSchemaMigration("V001", "retry me", original);
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), migration);
            SchemaDiff originalPlan = runner.migrator().plan(connection, original);
            runner.history().ensureTable(connection);
            runner.history().start(connection, migration.id(), originalPlan.planHash(), migration.definitionHash());
            runner.history().markFailed(connection, migration.id(), "simulated failure");
            try {
                new DBSchemaMigrationRunner(new DBSchemaMigrator(new H2Dialect()),
                        List.of(new DBSchemaMigration("V001", "retry me", changed))).retry(connection, "V001");
                throw new AssertionError("Changed failed migration must be rejected");
            } catch (SchemaMigrationException expected) { }
            SchemaDiff retried = runner.retry(connection, "V001");
            if (retried.isEmpty()) throw new AssertionError("Retry should apply the failed migration");
            if (runner.history().find(connection, "V001").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Retry should mark migration APPLIED");
            try { runner.retry(connection, "V001"); throw new AssertionError("Retry of APPLIED migration should fail"); }
            catch (SchemaMigrationException expected) { }
        }

        DBMetaData duplicateDesired = new DBMetaData().add(new TableMetaData("DUPLICATE"));
        try {
            new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                    new DBSchemaMigration("V001", "one", duplicateDesired),
                    new DBSchemaMigration("v001", "duplicate", duplicateDesired)));
            throw new AssertionError("Duplicate migration IDs should fail case-insensitively");
        } catch (IllegalArgumentException expected) { }

        H2Dialect h2 = new H2Dialect();
        DBDialect nonTransactional = new DBDialect() {
            @Override public String name() { return "H2-NONTRANSACTIONAL-TEST"; }
            @Override public boolean supportsTransactionalDdl() { return false; }
            @Override public String columnDefinition(ColumnMetaData column) { return h2.columnDefinition(column); }
        };
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_nontransactional_default;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigration migration = new DBSchemaMigration("V001", "non transactional default", duplicateDesired);
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(nonTransactional, migration);
            if (runner.migrate(connection).size() != 1) throw new AssertionError("Default runner mode should allow non-transactional DDL dialect");
            if (runner.history().find(connection, "V001").status() != SchemaMigrationHistory.Status.APPLIED)
                throw new AssertionError("Non-transactional default migration should be APPLIED");
            try {
                runner.migrate(connection, true);
                throw new AssertionError("Explicit transactional mode should reject unsupported DDL dialect");
            } catch (SchemaMigrationException expected) { }
        }

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_duplicate_history;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigration migration = new DBSchemaMigration("V001", "one", duplicateDesired);
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), migration);
            runner.history().ensureTable(connection);
            runner.history().start(connection, "V001", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            runner.history().markApplied(connection, "V001");
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO QPX_SCHEMA_MIGRATION (MIGRATION_ID, PLAN_HASH, STATUS, CREATED_AT, COMPLETED_AT, ERROR_MESSAGE) VALUES ('v001', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'APPLIED', 2, 2, NULL)");
            }
            try {
                runner.validate(connection);
                throw new AssertionError("Case-insensitive duplicate history IDs should be rejected");
            } catch (SchemaMigrationException expected) { }
        }

        System.out.println("DBSchemaMigrationRunnerTest: OK");
    }
}
