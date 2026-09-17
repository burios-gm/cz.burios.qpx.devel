package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;

import org.junit.jupiter.api.Test;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;
import cz.burios.uniql.dialect.H2Dialect;

class JpaSchemaIntegrationTest {

    private static final String JDBC_URL = "jdbc:h2:mem:uniql_metadata;DB_CLOSE_DELAY=-1";

    @Test
    void migratesJpaMetadataToH2AndReadsBackEquivalentMetadata() throws Exception {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData desired = new JpaMetaDataReader().read(emf);

            try (Connection connection = DriverManager.getConnection(JDBC_URL, "sa", "")) {
                H2Dialect dialect = new H2Dialect();
                DBSchemaManager manager = new DBSchemaManager(dialect);

                SchemaDiff initial = SchemaDiff.compare(new DBMetaData(), desired);
                assertFalse(initial.isEmpty());
                initial.apply(connection, manager);

                DBMetaData actual = DBMetaData.load(connection);
                SchemaDiff verification = SchemaDiff.compare(actual, desired);

                assertTrue(verification.isEmpty(), () -> "Unexpected schema differences: " + verification.toSQL(dialect));

                TableMetaData embedded = actual.table("qpx_embedded_id");
                assertTrue(embedded != null);
                assertEquals(2, embedded.columns.stream().filter(column -> column.primaryKey).count());
                assertEquals("tenant_code", embedded.columns.stream().filter(column -> column.primaryKey).findFirst().orElseThrow().name);

                TableMetaData idClass = actual.table("qpx_id_class");
                assertTrue(idClass != null);
                assertEquals(2, idClass.columns.stream().filter(column -> column.primaryKey).count());
            }
        } finally {
            emf.close();
        }
    }
}
