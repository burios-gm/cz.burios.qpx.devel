package cz.burios.qpx.darwin.db.metadata;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import cz.burios.qpx.darwin.db.model.DynamicRecord;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;

/** Executable integration test for metadata-driven CRUD of runtime tables. */
public final class QLDynamicRecordTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:h2:mem:qpx_dynamic;DB_CLOSE_DELAY=-1")) {
            c.createStatement().execute("CREATE TABLE customer (ID INT PRIMARY KEY, NAME VARCHAR(100) NOT NULL, BALANCE DECIMAL(12,2))");
            TableMetaData table = DBMetaData.load(c).table("CUSTOMER");
            if (table == null) table = DBMetaData.load(c).table("customer");
            if (table == null) throw new AssertionError("customer metadata not found");

            DynamicRecord r = new DynamicRecord(table);
            r.put("ID", 1); r.put("NAME", "Alice"); r.put("BALANCE", new BigDecimal("25.50"));
            assertEquals(1, insert(c, r));

            r.put("NAME", "Bob");
            assertEquals(1, update(c, r));
            BasicCheck(c, "Bob");

            assertEquals(1, delete(c, r));
            if (select("ID").from("customer").one(c, DynamicRecord.class) != null) throw new AssertionError("record was not deleted");
            System.out.println("QLDynamicRecordTest: OK");
        }
    }

    private static void BasicCheck(Connection c, String expected) throws Exception {
        DynamicRecord loaded = select("ID", "NAME", "BALANCE").from("customer").where(col("ID").eq(1)).one(c, DynamicRecord.class);
        assertEquals(expected, loaded.getString("NAME"));
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) throw new AssertionError("Expected: " + expected + " but was: " + actual);
    }
}
