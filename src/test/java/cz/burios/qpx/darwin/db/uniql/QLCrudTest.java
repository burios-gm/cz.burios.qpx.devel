package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.LocalDate;

/** Executable CRUD integration test; intentionally uses main(), not JUnit. */
public final class QLCrudTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:h2:mem:qpx_crud;DB_CLOSE_DELAY=-1")) {
            c.createStatement().execute("CREATE TABLE store (ID INT PRIMARY KEY, NAME VARCHAR(100), ACTIVE BOOLEAN, PRICE DECIMAL(12,2), CREATED DATE)");

            StoreRecord record = new StoreRecord();
            record.put("ID", 1);
            record.put("NAME", "Prague");
            record.put("ACTIVE", true);
            record.put("PRICE", new BigDecimal("12.50"));
            record.put("CREATED", LocalDate.of(2026, 9, 11));

            assertEquals(1, insert(c, "store", record));
            assertEquals("Prague", select("NAME").from("store").where(col("ID").eq(1)).one(c, StoreRecord.class).get("NAME"));

            record.put("NAME", "Brno");
            assertEquals(1, update(c, "store", record, "ID"));
            assertEquals("Brno", select("NAME").from("store").where(col("ID").eq(1)).one(c, StoreRecord.class).get("NAME"));

            assertEquals(1, delete(c, "store", record, "ID"));
            if (select("ID").from("store").where(col("ID").eq(1)).one(c, StoreRecord.class) != null) {
                throw new AssertionError("record was not deleted");
            }
        }
        System.out.println("QLCrudTest: OK");
    }

    public static class StoreRecord extends BasicRecord {
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }
}
