package cz.burios.uniql.metadata;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Index;
import jakarta.persistence.Persistence;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Executable tests for JPA-to-database metadata conversion. */
public class JpaMetaDataReaderTest {

    public static void main(String[] args) {
        JpaMetaDataReaderTest test = new JpaMetaDataReaderTest();
        test.readsStringIdAsPrimaryKeyWithoutAutoIncrement();
        test.readsJPAIndexesAndUniqueConstraints();
        test.readsEmbeddedIdAsCompositePrimaryKey();
        test.readsIdClassAsCompositePrimaryKey();
        System.out.println("JpaMetaDataReaderTest: OK");
    }

    public void readsStringIdAsPrimaryKeyWithoutAutoIncrement() {
        DBMetaData metadata = readMetadata();
        TableMetaData table = requireTable(metadata, "qpx_string_id");
        ColumnMetaData id = requireColumn(table, "id");
        check(id.primaryKey, "String id must be primary key");
        check(!id.autoIncrement, "String id must not be auto-increment");
        check(id.logicalType == ColumnType.STRING, "String id must have STRING logical type");
        check(id.length == 20, "String id length must be 20");
    }

    public void readsJPAIndexesAndUniqueConstraints() {
        DBMetaData metadata = readMetadata();
        TableMetaData table = requireTable(metadata, "qpx_jpa_index");
        check(table.indexes.stream().anyMatch(i -> "ix_qpx_code".equals(i.name) && !i.unique && i.columns.equals(java.util.List.of("code"))), "JPA index missing");
        check(table.indexes.stream().anyMatch(i -> "uk_qpx_external".equals(i.name) && i.unique && i.columns.equals(java.util.List.of("external_code"))), "named unique constraint missing");
        check(table.indexes.stream().anyMatch(i -> "qpx_jpa_index_uk_name_city".equals(i.name) && i.unique && i.columns.equals(java.util.List.of("name", "city"))), "composite unique constraint missing");
        check(requireColumn(table, "external_code").unique, "external_code must be marked unique");
    }

    public void readsEmbeddedIdAsCompositePrimaryKey() {
        DBMetaData metadata = readMetadata();
        TableMetaData table = requireTable(metadata, "qpx_embedded_id");
        check(countPrimaryKeys(table) == 2, "EmbeddedId must produce two primary-key columns");
        ColumnMetaData tenant = requireColumn(table, "tenant_code");
        check(tenant.primaryKey && !tenant.autoIncrement, "tenant_code primary-key flags are wrong");
        check(tenant.logicalType == ColumnType.STRING && tenant.length == 20, "tenant_code metadata is wrong");
        ColumnMetaData number = requireColumn(table, "order_no");
        check(number.primaryKey && !number.autoIncrement, "order_no primary-key flags are wrong");
        check(number.logicalType == ColumnType.STRING && number.length == 20, "order_no metadata is wrong");
    }

    public void readsIdClassAsCompositePrimaryKey() {
        DBMetaData metadata = readMetadata();
        TableMetaData table = requireTable(metadata, "qpx_id_class");
        check(countPrimaryKeys(table) == 2, "IdClass must produce two primary-key columns");
        for (String name : java.util.List.of("tenant_code", "order_no")) {
            ColumnMetaData column = requireColumn(table, name);
            check(column.primaryKey && !column.autoIncrement, name + " primary-key flags are wrong");
            check(column.logicalType == ColumnType.STRING && column.length == 20, name + " metadata is wrong");
        }
    }

    private DBMetaData readMetadata() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            return new JpaMetaDataReader().read(emf);
        } finally {
            emf.close();
        }
    }

    private static TableMetaData requireTable(DBMetaData metadata, String name) {
        TableMetaData table = metadata.table(name);
        check(table != null, "missing table: " + name);
        return table;
    }

    private static ColumnMetaData requireColumn(TableMetaData table, String name) {
        ColumnMetaData column = table.column(name);
        check(column != null, "missing column " + table.name + "." + name);
        return column;
    }

    private static long countPrimaryKeys(TableMetaData table) {
        return table.columns.stream().filter(c -> c.primaryKey).count();
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    @Entity(name = "StringIdEntity")
    @Table(name = "qpx_string_id")
    public static class StringIdEntity {
        @Id
        @Column(name = "id", length = 20, nullable = false)
        private String id;
    }

    @Entity(name = "JpaIndexEntity")
    @Table(name = "qpx_jpa_index",
            indexes = @Index(name = "ix_qpx_code", columnList = "code"),
            uniqueConstraints = {
                @UniqueConstraint(name = "uk_qpx_external", columnNames = {"external_code"}),
                @UniqueConstraint(columnNames = {"name", "city"})
            })
    public static class JpaIndexEntity {
        @Id
        @Column(name = "id", length = 20, nullable = false)
        private String id;
        @Column(name = "code", length = 40)
        private String code;
        @Column(name = "external_code", length = 40, unique = true)
        private String externalCode;
        @Column(name = "name", length = 100)
        private String name;
        @Column(name = "city", length = 100)
        private String city;
    }

    @Embeddable
    public static class OrderId {
        @Column(name = "tenant", length = 20, nullable = false)
        private String tenant;
        @Column(name = "number", length = 20, nullable = false)
        private String number;
    }

    @Entity(name = "EmbeddedIdEntity")
    @Table(name = "qpx_embedded_id")
    @AttributeOverride(name = "id.tenant", column = @Column(name = "tenant_code", length = 20, nullable = false))
    @AttributeOverride(name = "id.number", column = @Column(name = "order_no", length = 20, nullable = false))
    public static class EmbeddedIdEntity {
        @EmbeddedId
        private OrderId id;
    }

    public static class IdClassKey {
        private String tenant;
        private String number;
        public IdClassKey() {}
        public IdClassKey(String tenant, String number) { this.tenant = tenant; this.number = number; }
    }

    @Entity(name = "IdClassEntity")
    @Table(name = "qpx_id_class")
    @IdClass(IdClassKey.class)
    public static class IdClassEntity {
        @Id
        @Column(name = "tenant_code", length = 20, nullable = false)
        private String tenant;
        @Id
        @Column(name = "order_no", length = 20, nullable = false)
        private String number;
    }
}
