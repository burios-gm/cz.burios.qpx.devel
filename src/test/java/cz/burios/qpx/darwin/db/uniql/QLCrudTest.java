package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.LocalDate;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Executable CRUD integration test; intentionally uses main(), not JUnit. */
public final class QLCrudTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:h2:mem:qpx_crud;DB_CLOSE_DELAY=-1")) {
            c.createStatement().execute("CREATE TABLE store (STORE_ID INT PRIMARY KEY, STORE_NAME VARCHAR(100), ACTIVE BOOLEAN, PRICE DECIMAL(12,2), CREATED DATE)");

            StoreRecord record = new StoreRecord();
            record.put("STORE_ID", 1);
            record.put("STORE_NAME", "Prague");
            record.put("ACTIVE", true);
            record.put("PRICE", new BigDecimal("12.50"));
            record.put("CREATED", LocalDate.of(2026, 9, 11));

            assertEquals("store", QLRecordMetadata.table(StoreRecord.class));
            assertEquals("STORE_ID", QLRecordMetadata.idColumn(StoreRecord.class));

            assertEquals(1, insert(c, record));
            StoreRecord loaded = select(StoreRecord.class).columns("STORE_ID", "STORE_NAME", "ACTIVE", "PRICE", "CREATED")
                    .where(col("STORE_ID").eq(1)).one(c, StoreRecord.class);
            assertEquals("Prague", loaded.get("STORE_NAME"));
            assertEquals(1, loaded.storeId);
            assertEquals("Prague", loaded.storeName);

            record.put("STORE_NAME", "Brno");
            record.storeName = "Brno";
            assertEquals(1, update(c, record));
            loaded = select(StoreRecord.class).where(col("STORE_ID").eq(1)).one(c, StoreRecord.class);
            assertEquals("Brno", loaded.get("STORE_NAME"));
            assertEquals("Brno", loaded.storeName);

            assertEquals(1, delete(c, record));
            if (select(StoreRecord.class).where(col("STORE_ID").eq(1)).one(c, StoreRecord.class) != null) {
                throw new AssertionError("record was not deleted");
            }
        }
        System.out.println("QLCrudTest: OK");
    }

    @Entity
    @Table(name = "store")
    public static class StoreRecord extends BasicRecord {
        @Id
        @Column(name = "STORE_ID")
        public int storeId;

        @Column(name = "STORE_NAME")
        public String storeName;

        @Column(name = "ACTIVE")
        public boolean active;

        @Column(name = "PRICE")
        public BigDecimal price;

        @Column(name = "CREATED")
        public LocalDate created;
    }

    private static void assertEquals(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual)) {
            throw new AssertionError("Expected: " + expected + " but was: " + actual);
        }
    }
}
