package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

import cz.burios.qpx.darwin.db.model.BasicRecord;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Executable integration test for mapping SELECT rows to BasicRecord POJOs. */
public final class QLRowMapperTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:qlrowmapper;DB_CLOSE_DELAY=-1")) {
            createSchema(connection);
            insertData(connection);
            mapsAnnotatedPojo(connection);
            mapsBasicRecord(connection);
        }
        System.out.println("QLRowMapperTest: OK");
    }

    private static void createSchema(Connection connection) throws Exception {
        connection.createStatement().executeUpdate("CREATE TABLE store (ID INT PRIMARY KEY, STORE_NAME VARCHAR(100), ACTIVE BOOLEAN, PRICE DECIMAL(12,2), BIRTH_DATE DATE, CREATED_AT TIMESTAMP)");
    }

    private static void insertData(Connection connection) throws Exception {
        var ps = connection.prepareStatement("INSERT INTO store (ID, STORE_NAME, ACTIVE, PRICE, BIRTH_DATE, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?)");
        ps.setInt(1, 7); ps.setString(2, "Prague"); ps.setBoolean(3, true); ps.setBigDecimal(4, new BigDecimal("123.45"));
        ps.setObject(5, LocalDate.of(2026, 9, 11)); ps.setObject(6, LocalDateTime.of(2026, 9, 11, 14, 30));
        ps.executeUpdate(); ps.close();
    }

    private static void mapsAnnotatedPojo(Connection connection) throws Exception {
        List<StoreRecord> rows = select(col("ID"), col("STORE_NAME"), col("ACTIVE"), col("PRICE"), col("BIRTH_DATE"), col("CREATED_AT"))
                .from("store").where(col("ID").eq(7)).list(connection, StoreRecord.class);
        assert rows.size() == 1;
        StoreRecord row = rows.get(0);
        assert row.id == 7; assert "Prague".equals(row.name); assert row.active;
        assert new BigDecimal("123.45").compareTo(row.price) == 0;
        assert LocalDate.of(2026, 9, 11).equals(row.birthDate);
        assert LocalDateTime.of(2026, 9, 11, 14, 30).equals(row.createdAt);
        assert "Prague".equals(row.getString("STORE_NAME"));
    }

    private static void mapsBasicRecord(Connection connection) throws Exception {
        List<BasicRecord> rows = select("ID", "STORE_NAME", "ACTIVE").from("store").list(connection);
        assert rows.size() == 1;
        BasicRecord row = rows.get(0);
        assert Integer.valueOf(7).equals(row.get("ID")); assert "Prague".equals(row.getString("STORE_NAME")); assert Boolean.TRUE.equals(row.getBoolean("ACTIVE"));
    }

    @Entity @Table(name = "store")
    public static class StoreRecord extends BasicRecord {
        @Column(name = "ID") public int id;
        @Column(name = "STORE_NAME") public String name;
        @Column(name = "ACTIVE") public boolean active;
        @Column(name = "PRICE") public BigDecimal price;
        @Column(name = "BIRTH_DATE") public LocalDate birthDate;
        @Column(name = "CREATED_AT") public LocalDateTime createdAt;
    }
}
