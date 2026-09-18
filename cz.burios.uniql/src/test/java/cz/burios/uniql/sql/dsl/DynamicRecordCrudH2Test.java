package cz.burios.uniql.sql.dsl;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import cz.burios.uniql.metadata.DBMetaData;
import cz.burios.uniql.metadata.TableMetaData;
import cz.burios.uniql.model.DynamicRecord;

/** End-to-end H2 test for runtime metadata-backed SELECT/UPDATE of dynamic records. */
public class DynamicRecordCrudH2Test {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:mem:uniql_dynamic_crud;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            try (Statement s = connection.createStatement()) {
                s.execute("CREATE TABLE qpx_dynamic (tenant VARCHAR(20) NOT NULL, code VARCHAR(20) NOT NULL, name VARCHAR(100), PRIMARY KEY (tenant, code))");
                s.execute("INSERT INTO qpx_dynamic(tenant, code, name) VALUES ('cz','001','Alice')");
            }

            DBMetaData db = DBMetaData.load(connection);
            TableMetaData table = db.table("qpx_dynamic");
            check(table != null, "table metadata must be loaded");
            check(table.primaryKeys().size() == 2, "composite primary key must be discovered");

            List<DynamicRecord> rows = DSL.select(table)
                    .column("tenant").column("code").column("name")
                    .where(DSL.col("tenant").eq("cz"))
                    .list(connection, table);
            check(rows.size() == 1, "SELECT must return one dynamic row");
            check("Alice".equals(rows.get(0).get("name")), "SELECT must map the dynamic row");

            DynamicRecord record = rows.get(0);
            record.put("name", "Bob");
            check(DSL.update(connection, record) == 1, "UPDATE must use all composite PK columns");

            DynamicRecord updated = DSL.select(table)
                    .where(DSL.col("tenant").eq("cz"))
                    .one(connection, table);
            check(updated != null && "Bob".equals(updated.get("name")), "UPDATE result must be visible");

            record.put("name", "Alice");
            check(DSL.update(connection, record) == 1, "second UPDATE must succeed");
            check(DSL.delete(connection, record) == 1, "DELETE must use all composite PK columns");

            DBMetaData after = DBMetaData.load(connection);
            check(after.table("qpx_dynamic") != null, "table must still exist after DELETE");
            System.out.println("DynamicRecordCrudH2Test: OK");
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
