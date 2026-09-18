package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.uniql.dialect.H2Dialect;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

/** Executable end-to-end test for migrating an H2 schema directly from JPA metadata. */
public class SchemaMigrationJpaH2Test {

    public static void main(String[] args) throws Exception {
        new SchemaMigrationJpaH2Test().migratesSchemaDirectlyFromJpa();
        System.out.println("SchemaMigrationJpaH2Test: OK");
    }

    public void migratesSchemaDirectlyFromJpa() throws Exception {
        String url = "jdbc:h2:mem:uniql_jpa_direct_migration;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
            try {
                DBSchemaMigrator migrator = new DBSchemaMigrator(new H2Dialect());
                SchemaDiff diff = migrator.migrate(connection, emf);

                check(!diff.isEmpty(), "JPA metadata must produce a schema migration");
                DBMetaData actual = DBMetaData.load(connection);
                DBMetaData desired = new JpaMetaDataReader().read(emf);

                check(actual.table("qpx_string_id") != null, "qpx_string_id must be created");
                check(actual.table("qpx_jpa_index") != null, "qpx_jpa_index must be created");
                check(actual.table("qpx_embedded_id") != null, "qpx_embedded_id must be created");
                check(actual.table("qpx_id_class") != null, "qpx_id_class must be created");

                SchemaDiff verification = SchemaDiff.compare(actual, desired);
                check(verification.isEmpty(), "JPA migration must leave an empty verification diff: " + verification);
            } finally {
                emf.close();
            }
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
