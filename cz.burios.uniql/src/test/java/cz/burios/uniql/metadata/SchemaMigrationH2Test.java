package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

import cz.burios.uniql.dialect.H2Dialect;

/** End-to-end H2 test for JDBC metadata -> diff -> DDL -> JDBC metadata. */
public class SchemaMigrationH2Test {

    public static void main(String[] args) throws Exception {
        SchemaMigrationH2Test test = new SchemaMigrationH2Test();
        test.migratesCompositePrimaryKeyFromActualJdbcMetadata();
        System.out.println("SchemaMigrationH2Test: OK");
    }

    public void migratesCompositePrimaryKeyFromActualJdbcMetadata() throws Exception {
        String url = "jdbc:h2:mem:uniql_schema_migration;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate(
                        "CREATE TABLE qpx_embedded_id (" +
                        "tenant_code VARCHAR(20) NOT NULL, " +
                        "order_no VARCHAR(20) NOT NULL, " +
                        "CONSTRAINT pk_qpx_embedded_id PRIMARY KEY (order_no, tenant_code))");
            }

            EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
            try {
                DBMetaData desiredAll = new JpaMetaDataReader().read(emf);
                TableMetaData desired = desiredAll.table("qpx_embedded_id");
                check(desired != null, "JPA desired metadata must contain qpx_embedded_id");

                DBMetaData desiredOnly = new DBMetaData().add(desired);
                DBMetaData actual = DBMetaData.load(connection);
                SchemaDiff diff = SchemaDiff.compare(actual, desiredOnly);

                check(diff.size() == 2, "reordered composite PK must produce DROP PRIMARY KEY + CREATE PRIMARY KEY");
                check(diff.changes().get(0).type() == SchemaChange.Type.DROP_PRIMARY_KEY,
                        "first migration step must drop the existing primary key");
                check(diff.changes().get(1).type() == SchemaChange.Type.CREATE_PRIMARY_KEY,
                        "second migration step must create the desired primary key");

                // The table and columns were created unquoted, so H2 stores them
                // in upper case. JPA metadata uses the lower-case logical names.
                // Migration SQL must nevertheless use the physical JDBC names.
                List<String> sql = diff.toSQL(new H2Dialect());
                check(sql.equals(List.of(
                        "ALTER TABLE \"PUBLIC\".\"QPX_EMBEDDED_ID\" DROP CONSTRAINT \"PK_QPX_EMBEDDED_ID\"",
                        "ALTER TABLE \"PUBLIC\".\"QPX_EMBEDDED_ID\" ADD PRIMARY KEY (\"TENANT_CODE\", \"ORDER_NO\")"
                )), "migration SQL must use physical H2 identifier casing: " + sql);

                diff.apply(connection, new DBSchemaManager(new H2Dialect()));

                DBMetaData migrated = DBMetaData.load(connection);
                TableMetaData migratedTable = migrated.table("qpx_embedded_id");
                check(migratedTable != null, "migrated table must exist");

                List<String> pkColumns = migratedTable.columns.stream()
                        .filter(c -> c.primaryKey)
                        .sorted(java.util.Comparator.comparingInt(c -> c.primaryKeyPosition))
                        .map(c -> c.name)
                        .toList();
                check(pkColumns.equals(List.of("tenant_code", "order_no")),
                        "migrated composite primary key has unexpected KEY_SEQ order: " + pkColumns);

                List<Short> pkPositions = migratedTable.columns.stream()
                        .filter(c -> c.primaryKey)
                        .map(c -> c.primaryKeyPosition)
                        .sorted()
                        .toList();
                check(pkPositions.equals(List.of((short) 1, (short) 2)),
                        "migrated composite primary key has unexpected KEY_SEQ values: " + pkPositions);

                SchemaDiff verification = SchemaDiff.compare(migrated, desiredOnly);
                check(verification.isEmpty(),
                        "schema must match JPA metadata after migration: " + verification);
            } finally {
                emf.close();
            }
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
