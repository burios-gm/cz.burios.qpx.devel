package cz.burios.qpx.darwin.db.metadata;

import cz.burios.qpx.darwin.db.model.DynamicRecord;
import java.sql.Connection;
import java.sql.DriverManager;

/** Executable metadata integration test; intentionally uses main(), not JUnit. */
public final class QLMetaDataTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:h2:mem:qpx_metadata;DB_CLOSE_DELAY=-1")) {
            c.createStatement().execute("CREATE TABLE dynamic_store (ID INT PRIMARY KEY AUTO_INCREMENT, NAME VARCHAR(100) NOT NULL, PRICE DECIMAL(12,2), ACTIVE BOOLEAN)");

            DBMetaData db = DBMetaData.load(c);
            TableMetaData table = db.table("DYNAMIC_STORE");
            if (table == null) table = db.table("dynamic_store");
            if (table == null) throw new AssertionError("dynamic_store metadata not found");
            assertTrue(table.column("ID") != null, "ID column missing");
            assertTrue(table.column("ID").primaryKey, "ID is not primary key");
            assertTrue(table.column("ID").autoIncrement, "ID is not auto increment");
            assertTrue(!table.column("NAME").nullable, "NAME should be NOT NULL");
            assertTrue(table.column("PRICE").scale == 2, "PRICE scale should be 2");

            DynamicRecord record = new DynamicRecord(table);
            record.put("NAME", "Prague");
            if (record.getTableMetaData() != table) throw new AssertionError("DynamicRecord metadata not retained");

            System.out.println("QLMetaDataTest: OK");
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
