package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Id;
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
}
