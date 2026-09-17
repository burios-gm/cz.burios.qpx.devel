package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

import org.junit.jupiter.api.Test;

class JpaMetaDataReaderTest {

    @Test
    void readsStringIdAsPrimaryKeyWithoutAutoIncrement() {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData metadata = new JpaMetaDataReader().read(emf);
            TableMetaData table = metadata.table("qpx_string_id");

            assertNotNull(table);
            ColumnMetaData id = table.columns.stream()
                    .filter(column -> "id".equals(column.name))
                    .findFirst()
                    .orElseThrow();

            assertTrue(id.primaryKey);
            assertFalse(id.autoIncrement);
            assertEquals(ColumnType.STRING, id.logicalType);
            assertEquals(20, id.length);
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

        public StringIdEntity() {}

        public StringIdEntity(String id) {
            this.id = id;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }
}
