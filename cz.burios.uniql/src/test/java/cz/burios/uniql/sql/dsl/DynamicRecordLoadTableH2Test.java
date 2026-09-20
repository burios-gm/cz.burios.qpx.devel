package cz.burios.uniql.sql.dsl;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

import cz.burios.uniql.metadata.DBMetaData;
import cz.burios.uniql.metadata.TableMetaData;
import cz.burios.uniql.model.DynamicRecord;

/**
 * End-to-end H2 test proving that one runtime table can be used only from
 * physical JDBC metadata, without a predefined Java record/table model.
 */
public class DynamicRecordLoadTableH2Test {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:mem:uniql_dynamic_load_table;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            try (Statement s = connection.createStatement()) {
                s.execute("CREATE TABLE qpx_runtime (tenant VARCHAR(20) NOT NULL, code VARCHAR(20) NOT NULL, name VARCHAR(100), amount DECIMAL(12,2), PRIMARY KEY (tenant, code))");
            }

            // Deliberately do not call DBMetaData.load(): the table contract is
            // obtained directly from the physical table at runtime.
            TableMetaData table = DBMetaData.loadTable(connection, "qpx_runtime");
            check(table != null, "runtime table metadata must be loaded");
            check("qpx_runtime".equalsIgnoreCase(table.name), "physical table name must be preserved");
            check(table.columns.size() == 4, "all physical columns must be discovered");
            check(table.primaryKeys().size() == 2, "composite primary key must be discovered");
            check(table.column("TENANT") != null, "column lookup must be case-insensitive");
            check(table.column("amount") != null, "column metadata must contain AMOUNT");

            DynamicRecord record = new DynamicRecord(table);
            record.put("TENANT", "cz");
            record.put("CODE", "001");
            record.put("NAME", "Alice");
            record.put("AMOUNT", new java.math.BigDecimal("25.50"));

            check(DSL.insert(connection, record) == 1, "metadata-driven INSERT must succeed");

            DynamicRecord loaded = DSL.select(table)
                    .where(DSL.col("tenant").eq("cz"))
                    .and(DSL.col("code").eq("001"))
                    .one(connection, table);
            check(loaded != null, "metadata-driven SELECT must return the row");
            check("Alice".equals(loaded.get("name")), "SELECT must map values using table metadata");

            loaded.put("name", "Bob");
            loaded.put("amount", new java.math.BigDecimal("30.00"));
            check(DSL.update(connection, loaded) == 1, "metadata-driven UPDATE must use the composite PK");

            DynamicRecord updated = DSL.select(table)
                    .where(DSL.col("tenant").eq("cz"))
                    .and(DSL.col("code").eq("001"))
                    .one(connection, table);
            check(updated != null, "updated row must be loadable");
            check("Bob".equals(updated.get("NAME")), "updated name must be visible");
            check(new java.math.BigDecimal("30.00").compareTo((java.math.BigDecimal) updated.get("amount")) == 0,
                    "updated amount must be visible");

            check(DSL.delete(connection, updated) == 1, "metadata-driven DELETE must use the composite PK");
            check(DSL.select(table).where(DSL.col("tenant").eq("cz")).list(connection, table).isEmpty(),
                    "deleted row must no longer be returned");

            DBMetaData cached = DBMetaData.load(connection);
            check(cached.table("qpx_runtime") != null, "database metadata must contain the runtime table");
            check(cached.reloadTable(connection, "qpx_runtime") != null, "reloadTable must refresh existing metadata");
            check(cached.table("qpx_runtime").column("amount") != null, "reloaded metadata must contain AMOUNT");

            try (Statement s = connection.createStatement()) {
                s.execute("ALTER TABLE qpx_runtime ADD COLUMN note VARCHAR(64)");
            }
            TableMetaData refreshed = cached.reloadTable(connection, "qpx_runtime");
            check(refreshed != null && refreshed.column("note") != null,
                    "reloadTable must expose columns added after the initial snapshot");

            try (Statement s = connection.createStatement()) {
                s.execute("DROP TABLE qpx_runtime");
            }
            check(cached.reloadTable(connection, "qpx_runtime") == null, "reloadTable must remove dropped tables");
            check(cached.table("qpx_runtime") == null, "dropped table must be removed from metadata");

            System.out.println("DynamicRecordLoadTableH2Test: OK");
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
