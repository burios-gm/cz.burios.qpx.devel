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
        new SchemaMigrationJpaH2Test().updatesExistingSchemaFromJpaDesiredMetadata();
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

    /** Verifies a second migration against the desired state produced by the JPA reader. */
    public void updatesExistingSchemaFromJpaDesiredMetadata() throws Exception {
        String url = "jdbc:h2:mem:uniql_jpa_update_migration;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
            try {
                JpaMetaDataReader reader = new JpaMetaDataReader();
                DBMetaData desiredV1 = reader.read(emf);
                DBSchemaMigrator migrator = new DBSchemaMigrator(new H2Dialect());

                SchemaDiff first = migrator.migrate(connection, desiredV1);
                check(!first.isEmpty(), "initial JPA migration must create the schema");

                TableMetaData table = desiredV1.table("qpx_string_id");
                check(table != null, "qpx_string_id must exist in JPA metadata");
                ColumnMetaData migratedColumn = new ColumnMetaData("migration_marker")
                        .string(64).nullable(true);
                table.addColumn(migratedColumn);

                SchemaDiff second = migrator.migrate(connection, desiredV1);
                check(!second.isEmpty(), "changed JPA desired metadata must produce a second migration");
                check(second.changes().stream().anyMatch(change ->
                        change.type() == SchemaChange.Type.ADD_COLUMN
                        && change.column() != null
                        && "migration_marker".equalsIgnoreCase(change.column().name)),
                        "second JPA migration must add the changed column");

                DBMetaData actual = DBMetaData.load(connection);
                check(actual.table("qpx_string_id").column("migration_marker") != null,
                        "migration_marker must exist after the second migration");
                check(SchemaDiff.compare(actual, desiredV1).isEmpty(),
                        "second JPA migration must leave an empty verification diff");
            } finally {
                emf.close();
            }
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
