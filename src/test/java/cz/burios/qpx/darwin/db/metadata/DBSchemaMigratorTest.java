package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

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
}
