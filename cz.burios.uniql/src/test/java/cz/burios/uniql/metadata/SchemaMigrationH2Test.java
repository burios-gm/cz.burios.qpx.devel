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
        test.createsJPAIndexedTableFromEmptyDatabase();
        test.altersExistingColumnTypeNullabilityAndDefault();
        System.out.println("SchemaMigrationH2Test: OK");
    }

    /** Verifies the complete JPA -> desired metadata -> DDL -> JDBC round trip for a new table. */
    public void createsJPAIndexedTableFromEmptyDatabase() throws Exception {
        String url = "jdbc:h2:mem:uniql_schema_migration_create;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
            try {
                TableMetaData desiredTable = new JpaMetaDataReader().read(emf).table("qpx_jpa_index");
                check(desiredTable != null, "JPA desired metadata must contain qpx_jpa_index");
                DBMetaData desired = new DBMetaData().add(desiredTable);

                DBMetaData actual = DBMetaData.load(connection);
                check(actual.table("qpx_jpa_index") == null, "test database must start without qpx_jpa_index");

                SchemaDiff diff = SchemaDiff.compare(actual, desired);
                check(!diff.isEmpty(), "missing JPA table must produce a migration");
                check(diff.changes().get(0).type() == SchemaChange.Type.CREATE_TABLE,
                        "new table migration must start with CREATE TABLE");
                long createIndexes = diff.changes().stream()
                        .filter(change -> change.type() == SchemaChange.Type.CREATE_INDEX)
                        .count();
                check(createIndexes == desiredTable.indexes.size(),
                        "all JPA secondary indexes must be explicit migration changes");

                diff.apply(connection, new DBSchemaManager(new H2Dialect()));

                DBMetaData migrated = DBMetaData.load(connection);
                check(migrated.table("qpx_jpa_index") != null, "JPA table must exist after migration");
                SchemaDiff verification = SchemaDiff.compare(migrated, desired);
                check(verification.isEmpty(),
                        "JPA-created table must match its JDBC metadata after migration: " + verification);
            } finally {
                emf.close();
            }
        }
    }

    /** Verifies that H2 ALTER COLUMN applies type, nullability and default changes. */
    public void altersExistingColumnTypeNullabilityAndDefault() throws Exception {
        String url = "jdbc:h2:mem:uniql_schema_migration_alter;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate(
                        "CREATE TABLE qpx_alter (id BIGINT NOT NULL, name VARCHAR(50) DEFAULT 'old')");
            }

            TableMetaData desiredTable = new TableMetaData("qpx_alter");
            desiredTable.addColumn(new ColumnMetaData("id").longType().nullable(false));
            desiredTable.addColumn(new ColumnMetaData("name").string(100).nullable(false).defaultValue("'new'"));
            DBMetaData desired = new DBMetaData().add(desiredTable);

            DBMetaData actual = DBMetaData.load(connection);
            SchemaDiff diff = SchemaDiff.compare(actual, desired);
            check(diff.size() == 1, "column definition change must produce one ALTER_COLUMN change");
            check(diff.changes().get(0).type() == SchemaChange.Type.ALTER_COLUMN,
                    "changed column must produce ALTER_COLUMN");

            List<String> sql = diff.toSQL(new H2Dialect());
            check(sql.size() == 1 && sql.get(0).contains("ALTER TABLE \"QPX_ALTER\" ALTER COLUMN \"NAME\""),
                    "H2 ALTER_COLUMN must render as one logical migration change: " + sql);
            check(sql.get(0).contains("VARCHAR(100)"),
                    "H2 ALTER_COLUMN must contain the desired type: " + sql);

            diff.apply(connection, new DBSchemaManager(new H2Dialect()));

            TableMetaData migrated = DBMetaData.load(connection).table("qpx_alter");
            ColumnMetaData name = migrated.columns.stream()
                    .filter(column -> column.name.equalsIgnoreCase("name"))
                    .findFirst().orElseThrow();
            check(name.length == 100, "name column must be widened to VARCHAR(100)");
            check(!name.nullable, "name column must become NOT NULL");
            check("'new'".equals(name.defaultValue), "name column default must become 'new': " + name.defaultValue);

            SchemaDiff verification = SchemaDiff.compare(DBMetaData.load(connection), desired);
            check(verification.isEmpty(), "ALTER_COLUMN migration must leave an empty verification diff: " + verification);
        }
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
