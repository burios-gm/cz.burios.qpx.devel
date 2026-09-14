package cz.burios.qpx.darwin.db.metadata;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Executable test for schema migration approval serialization, versioning and tamper rejection. */
public final class DBSchemaMigrationApprovalTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        TableMetaData table = new TableMetaData("STORE")
                .param("ENGINE", "InnoDB")
                .addColumn(new ColumnMetaData("ID").longType().primaryKey());
        SchemaDiff diff = SchemaDiff.fromChanges(List.of(SchemaChange.createTable(table)));
        // includeDrops defaults to false; using the 3-argument constructor keeps this test
        // compatible with the original migration API as well.
        DBSchemaMigration migration = new DBSchemaMigration("2026-001", "Create STORE", new DBMetaData());
        DBSchemaMigrationPlan plan = new DBSchemaMigrationPlan(migration, diff, diff.planHash());

        DBSchemaMigrationApproval approval = plan.approval();
        if (approval.planFormat() != SchemaDiff.PLAN_FORMAT)
            throw new AssertionError("Approval must preserve plan format");
        if (!approval.planHash().equals(plan.planHash()))
            throw new AssertionError("Approval must preserve plan hash");

        String json = approval.toJson();
        DBSchemaMigrationApproval restored = DBSchemaMigrationApproval.fromJson(json);
        if (!restored.equals(approval))
            throw new AssertionError("Approval JSON round trip must preserve the approval artifact");

        ObjectNode modifiedChanges = (ObjectNode) JSON.readTree(json);
        ObjectNode firstChange = (ObjectNode) modifiedChanges.withArray("changes").get(0);
        firstChange.with("table").put("label", "tampered");
        expectRejected(() -> DBSchemaMigrationApproval.fromJson(modifiedChanges.toString()),
                "modified changes with original hash");

        ObjectNode modifiedHash = (ObjectNode) JSON.readTree(json);
        modifiedHash.put("planHash", "0000000000000000000000000000000000000000000000000000000000000000");
        expectRejected(() -> DBSchemaMigrationApproval.fromJson(modifiedHash.toString()),
                "modified plan hash");

        ObjectNode modifiedFormat = (ObjectNode) JSON.readTree(json);
        modifiedFormat.put("planFormat", SchemaDiff.PLAN_FORMAT + 1);
        expectRejected(() -> DBSchemaMigrationApproval.fromJson(modifiedFormat.toString()),
                "unknown plan format");

        expectRejected(() -> new DBSchemaMigrationApproval(
                approval.migrationId(), approval.description(), approval.includeDrops(),
                approval.planFormat() + 1, approval.diff(), approval.planHash()),
                "unknown plan format in constructor");

        System.out.println("DBSchemaMigrationApprovalTest: OK");
    }

    private static void expectRejected(ThrowingRunnable action, String description) throws Exception {
        try {
            action.run();
            throw new AssertionError("Expected rejection: " + description);
        } catch (IllegalArgumentException expected) {
            // expected
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
