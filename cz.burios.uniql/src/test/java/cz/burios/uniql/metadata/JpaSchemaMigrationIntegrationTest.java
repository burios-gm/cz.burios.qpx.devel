package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import org.junit.jupiter.api.Test;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

import cz.burios.uniql.dialect.H2Dialect;

/** Verifies the complete JPA -> desired metadata -> DDL -> JDBC metadata round trip. */
class JpaSchemaMigrationIntegrationTest {

    private static final String JDBC_URL = "jdbc:h2:mem:uniql_metadata;DB_CLOSE_DELAY=-1";

    @Test
    void migratesJpaMetadataToH2AndReadsEquivalentMetadataBack() throws Exception {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData desired = new JpaMetaDataReader().read(emf);
            H2Dialect dialect = new H2Dialect();
            DBSchemaManager manager = new DBSchemaManager(dialect);

            try (Connection connection = DriverManager.getConnection(JDBC_URL, "sa", "")) {
                DBMetaData before = DBMetaData.load(connection);
                SchemaDiff initial = SchemaDiff.compare(before, desired);

                assertFalse(initial.isEmpty(), "the empty H2 schema must require migration");
                initial.apply(connection, manager);

                DBMetaData actual = DBMetaData.load(connection);
                SchemaDiff remaining = SchemaDiff.compare(actual, desired);

                assertTrue(remaining.isEmpty(), () -> "metadata still differs after migration: " + remaining.toSQL(dialect));
                assertCompositePrimaryKey(actual, "qpx_embedded_id", List.of("tenant_code", "order_no"));
                assertCompositePrimaryKey(actual, "qpx_id_class", List.of("tenant_code", "order_no"));
                assertTrue(hasIndex(actual, "qpx_jpa_index", "ix_qpx_code"));
                assertTrue(hasIndex(actual, "qpx_jpa_index", "uk_qpx_external"));
            }
        } finally {
            emf.close();
        }
    }

    private static void assertCompositePrimaryKey(DBMetaData metadata, String tableName, List<String> columns) {
        TableMetaData table = metadata.table(tableName);
        assertTrue(table != null, () -> "missing table: " + tableName);
        List<String> actual = table.columns.stream()
                .filter(column -> column.primaryKey)
                .map(column -> column.name)
                .toList();
        assertTrue(actual.equals(columns), () -> "unexpected primary key for " + tableName + ": " + actual);
    }

    private static boolean hasIndex(DBMetaData metadata, String tableName, String indexName) {
        TableMetaData table = metadata.table(tableName);
        if (table == null) return false;
        return table.indexes.stream().anyMatch(index -> index.name.equalsIgnoreCase(indexName));
    }
}
