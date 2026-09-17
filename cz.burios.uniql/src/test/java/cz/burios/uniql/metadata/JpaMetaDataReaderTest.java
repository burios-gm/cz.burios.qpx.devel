package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

import org.junit.jupiter.api.Test;

class JpaMetaDataReaderTest {

    @Test
    void readsStringIdAsPrimaryKeyWithoutAutoIncrement() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData metadata = new JpaMetaDataReader().read(emf);
            TableMetaData table = metadata.table("qpx_string_id");

            assertNotNull(table);
            ColumnMetaData id = table.columns.stream().filter(column -> "id".equals(column.name)).findFirst().orElseThrow();
            assertTrue(id.primaryKey);
            assertFalse(id.autoIncrement);
            assertEquals(ColumnType.STRING, id.logicalType);
            assertEquals(20, id.length);
        } finally {
            emf.close();
        }
    }

    @Test
    void readsJPAIndexesAndUniqueConstraints() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData metadata = new JpaMetaDataReader().read(emf);
            TableMetaData table = metadata.table("qpx_jpa_index");

            assertNotNull(table);
            assertTrue(table.indexes.stream().anyMatch(i -> "ix_qpx_code".equals(i.name) && !i.unique && i.columns.equals(java.util.List.of("code"))));
            assertTrue(table.indexes.stream().anyMatch(i -> "uk_qpx_external".equals(i.name) && i.unique && i.columns.equals(java.util.List.of("external_code"))));
            assertTrue(table.indexes.stream().anyMatch(i -> "qpx_jpa_index_uk_name_city".equals(i.name) && i.unique && i.columns.equals(java.util.List.of("name", "city"))));

            ColumnMetaData external = table.column("external_code");
            assertNotNull(external);
            assertTrue(external.unique);
        } finally {
            emf.close();
        }
    }

    @Test
    void readsEmbeddedIdAsCompositePrimaryKey() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData metadata = new JpaMetaDataReader().read(emf);
            TableMetaData table = metadata.table("qpx_embedded_id");

            assertNotNull(table);
            assertEquals(2, table.columns.stream().filter(c -> c.primaryKey).count());

            ColumnMetaData tenant = table.column("tenant_code");
            assertNotNull(tenant);
            assertTrue(tenant.primaryKey);
            assertFalse(tenant.autoIncrement);
            assertEquals(ColumnType.STRING, tenant.logicalType);
            assertEquals(20, tenant.length);

            ColumnMetaData number = table.column("order_no");
            assertNotNull(number);
            assertTrue(number.primaryKey);
            assertFalse(number.autoIncrement);
            assertEquals(ColumnType.STRING, number.logicalType);
            assertEquals(20, number.length);
        } finally {
            emf.close();
        }
    }

    @Test
    void readsIdClassAsCompositePrimaryKey() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData metadata = new JpaMetaDataReader().read(emf);
            TableMetaData table = metadata.table("qpx_id_class");

            assertNotNull(table);
            assertEquals(2, table.columns.stream().filter(c -> c.primaryKey).count());
            for (String name : java.util.List.of("tenant_code", "order_no")) {
                ColumnMetaData column = table.column(name);
                assertNotNull(column);
                assertTrue(column.primaryKey);
                assertFalse(column.autoIncrement);
                assertEquals(ColumnType.STRING, column.logicalType);
                assertEquals(20, column.length);
            }
        } finally {
            emf.close();
        }
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
            uniqueConstraints = @UniqueConstraint(name = "uk_qpx_external", columnNames = {"external_code"}))
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

        public IdClassKey(String tenant, String number) {
            this.tenant = tenant;
            this.number = number;
        }
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
