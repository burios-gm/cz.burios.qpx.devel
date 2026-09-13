package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable integration test for the schema migration facade; no JUnit required. */
public class DBSchemaMigratorTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_migrator;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrator migrator = new DBSchemaMigrator(new H2Dialect());

            DBMetaData desired = desiredSchema();
            SchemaDiff plan = migrator.plan(connection, desired);
            if (plan.size() != 1 || plan.changes().get(0).type() != SchemaChange.Type.CREATE_TABLE)
                throw new AssertionError("Expected CREATE_TABLE plan: " + plan);
            List<String> createSql = plan.toSQL(new H2Dialect());
            if (createSql.size() != 2 || !createSql.get(0).startsWith("CREATE TABLE") || !createSql.get(1).contains("IX_STORE_NAME"))
                throw new AssertionError("Expected table and index SQL: " + createSql);

            SchemaDiff applied = migrator.migrate(connection, desired);
            if (applied.size() != 1 || applied.changes().get(0).type() != SchemaChange.Type.CREATE_TABLE)
                throw new AssertionError("Unexpected applied plan: " + applied);

            if (!migrator.plan(connection, desired).isEmpty())
                throw new AssertionError("Schema should be synchronized after migration");

            DBMetaData changed = desiredSchema();
            changed.table("STORE").addColumn(new ColumnMetaData("ACTIVE").type("BOOLEAN").nullable(false).defaultValue("TRUE"));
            SchemaDiff alterPlan = migrator.plan(connection, changed);
            if (alterPlan.size() != 1 || alterPlan.changes().get(0).type() != SchemaChange.Type.ADD_COLUMN)
                throw new AssertionError("Expected ADD_COLUMN plan: " + alterPlan);
            migrator.migrate(connection, changed);
            if (DBMetaData.load(connection).table("STORE").column("ACTIVE") == null)
                throw new AssertionError("ACTIVE was not migrated");

            DBMetaData dropColumnAndIndex = desiredSchema();
            dropColumnAndIndex.table("STORE").indexes.clear();
            SchemaDiff dropIndexPlan = migrator.plan(connection, dropColumnAndIndex, true);
            int dropIndex = -1;
            int dropColumn = -1;
            for (int i = 0; i < dropIndexPlan.changes().size(); i++) {
                SchemaChange.Type type = dropIndexPlan.changes().get(i).type();
                if (type == SchemaChange.Type.DROP_INDEX) dropIndex = i;
                if (type == SchemaChange.Type.DROP_COLUMN) dropColumn = i;
            }
            if (dropIndex < 0 || dropColumn < 0 || dropIndex >= dropColumn)
                throw new AssertionError("Index must be dropped before its column: " + dropIndexPlan);

            DBMetaData destructive = new DBMetaData();
            SchemaDiff safePlan = migrator.plan(connection, destructive);
            if (!safePlan.isEmpty())
                throw new AssertionError("Safe migration must not plan drops: " + safePlan);
            SchemaDiff dropPlan = migrator.plan(connection, destructive, true);
            if (dropPlan.size() != 1 || dropPlan.changes().get(0).type() != SchemaChange.Type.DROP_TABLE)
                throw new AssertionError("Expected DROP_TABLE only with includeDrops=true: " + dropPlan);
            migrator.migrate(connection, destructive, true);
            if (DBMetaData.load(connection).table("STORE") != null)
                throw new AssertionError("STORE was not dropped");

            expectInvalidIndexDependency();
        }
        System.out.println("DBSchemaMigratorTest: OK");
    }

    private static DBMetaData desiredSchema() {
        TableMetaData table = new TableMetaData("STORE")
                .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false).primaryKey(true).autoIncrement(true))
                .addColumn(new ColumnMetaData("NAME").type("VARCHAR(120)").nullable(false));
        table.addIndex(new IndexMetaData("IX_STORE_NAME").column("NAME"));
        return new DBMetaData().add(table);
    }

    private static void expectInvalidIndexDependency() {
        TableMetaData table = new TableMetaData("BROKEN").addColumn(new ColumnMetaData("ID").type("BIGINT"));
        table.addIndex(new IndexMetaData("IX_BROKEN_NAME").column("NAME"));
        try {
            SchemaDiff.compare(new DBMetaData(), new DBMetaData().add(table));
            throw new AssertionError("Missing index column should be rejected");
        } catch (IllegalArgumentException expected) {
            if (!expected.getMessage().contains("missing column")) throw expected;
        }
    }
}
