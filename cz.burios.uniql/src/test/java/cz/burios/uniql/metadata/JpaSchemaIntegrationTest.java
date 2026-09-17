package cz.burios.uniql.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;
import cz.burios.uniql.dialect.H2Dialect;

/** Executable integration test for JPA metadata -> H2 schema -> JDBC metadata. */
public class JpaSchemaIntegrationTest {

    private static final String JDBC_URL = "jdbc:h2:mem:uniql_metadata;DB_CLOSE_DELAY=-1";

    public static void main(String[] args) throws Exception {
        new JpaSchemaIntegrationTest().run();
        System.out.println("JpaSchemaIntegrationTest: OK");
    }

    public void run() throws Exception {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("uniql-test");
        try {
            DBMetaData desired = new JpaMetaDataReader().read(emf);
            check(!desired.tables.isEmpty(), "JPA metadata must contain tables");

            try (Connection connection = DriverManager.getConnection(JDBC_URL, "sa", "")) {
                H2Dialect dialect = new H2Dialect();
                DBSchemaManager manager = new DBSchemaManager(dialect);

                SchemaDiff initial = SchemaDiff.compare(new DBMetaData(), desired);
                check(!initial.isEmpty(), "initial migration must not be empty");
                initial.apply(connection, manager);

                DBMetaData actual = DBMetaData.load(connection);
                SchemaDiff verification = SchemaDiff.compare(actual, desired);
                check(verification.isEmpty(), "schema differs after migration: " + verification.toSQL(dialect));

                SchemaDiff repeat = SchemaDiff.compare(actual, desired);
                check(repeat.isEmpty(), "second comparison must be idempotent: " + repeat.toSQL(dialect));

                TableMetaData embedded = requireTable(actual, "qpx_embedded_id");
                check(countPrimaryKeys(embedded) == 2, "embedded id must have two primary-key columns");
                check("tenant_code".equals(firstPrimaryKey(embedded).name), "embedded id primary-key order must start with tenant_code");

                TableMetaData idClass = requireTable(actual, "qpx_id_class");
                check(countPrimaryKeys(idClass) == 2, "id-class must have two primary-key columns");

                TableMetaData indexed = requireTable(actual, "qpx_jpa_index");
                check(indexed.indexes.stream().anyMatch(i -> "ix_qpx_code".equalsIgnoreCase(i.name)
                        && !i.unique && i.columns.equals(java.util.List.of("code"))), "ordinary JPA index must be readable");
                check(indexed.indexes.stream().anyMatch(i -> "uk_qpx_external".equalsIgnoreCase(i.name)
                        && i.unique && i.columns.equals(java.util.List.of("external_code"))), "named unique constraint must be readable");
                check(indexed.indexes.stream().anyMatch(i -> i.unique
                        && i.columns.equals(java.util.List.of("external_code"))), "column unique index must be readable");
            }
        } finally {
            emf.close();
        }
    }

    private static TableMetaData requireTable(DBMetaData metadata, String name) {
        TableMetaData table = metadata.table(name);
        check(table != null, "missing table: " + name);
        return table;
    }

    private static long countPrimaryKeys(TableMetaData table) {
        return table.columns.stream().filter(column -> column.primaryKey).count();
    }

    private static ColumnMetaData firstPrimaryKey(TableMetaData table) {
        return table.columns.stream().filter(column -> column.primaryKey).findFirst()
                .orElseThrow(() -> new AssertionError("missing primary-key column in " + table.name));
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
