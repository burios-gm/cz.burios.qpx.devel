package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.uniql.dialect.H2Dialect;

/** Verifies that dry-run planning follows the successive declared migration states. */
public class DBSchemaMigrationRunnerSequentialPlanningTest {

    public static void main(String[] args) throws Exception {
        new DBSchemaMigrationRunnerSequentialPlanningTest().plansPendingMigrationsSequentially();
        System.out.println("DBSchemaMigrationRunnerSequentialPlanningTest: OK");
    }

    public void plansPendingMigrationsSequentially() throws Exception {
        String url = "jdbc:h2:mem:uniql_runner_sequential_planning;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            DBMetaData v1 = metadata("store", false);
            DBMetaData v2 = metadata("store", true);

            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                    new DBSchemaMigration("V001", "create store", v1),
                    new DBSchemaMigration("V002", "add store name", v2)));

            List<DBSchemaMigrationPlan> plans = runner.planPending(connection);
            check(plans.size() == 2, "two pending migrations must produce two plans");

            SchemaDiff first = plans.get(0).diff();
            check(first.size() == 1, "V001 must create exactly one table");
            check(first.changes().get(0).type() == SchemaChange.Type.CREATE_TABLE,
                    "V001 must create the table");

            SchemaDiff second = plans.get(1).diff();
            check(second.size() == 1, "V002 must contain only the change after V001");
            check(second.changes().get(0).type() == SchemaChange.Type.ADD_COLUMN,
                    "V002 must add only the new column");
            check("name".equals(second.changes().get(0).column().name),
                    "V002 must add the name column");

            check(plans.get(1).sourceHash().equalsIgnoreCase(v1.fingerprint()),
                    "V002 source hash must represent the state produced by V001");
            check(!plans.get(1).sourceHash().equalsIgnoreCase(DBMetaData.load(connection).fingerprint()),
                    "V002 source hash must not represent the original empty database");
            check(runner.history().list(connection).isEmpty(),
                    "planning must not modify migration history");
        }
    }

    private static DBMetaData metadata(String tableName, boolean withName) {
        DBMetaData metadata = new DBMetaData();
        TableMetaData table = new TableMetaData(tableName);
        table.addColumn(new ColumnMetaData("id").longType().nullable(false).primaryKey(true));
        if (withName) table.addColumn(new ColumnMetaData("name").string(100).nullable(false));
        metadata.add(table);
        return metadata;
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
