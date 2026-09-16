package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable regression test for transactional DDL rollback on H2. */
public final class DBSchemaMigratorTransactionalFailureTest {
    public static void main(String[] args) throws Exception {
        H2Dialect delegate = new H2Dialect();
        DBDialect failingDialect = new DBDialect() {
            private int columnDefinitions;

            @Override public String name() { return "h2-transactional-failure"; }

            @Override public String columnDefinition(ColumnMetaData column) {
                columnDefinitions++;
                if (columnDefinitions == 2)
                    throw new IllegalStateException("simulated transactional DDL failure");
                return delegate.columnDefinition(column);
            }

            @Override public String tableName(TableMetaData table) { return delegate.tableName(table); }
            @Override public String quote(String name) { return delegate.quote(name); }
            @Override public ColumnType logicalType(ColumnMetaData column) { return delegate.logicalType(column); }
        };

        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("TX_FIRST")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false)))
                .add(new TableMetaData("TX_SECOND")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false)));

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_transactional_failure;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrator migrator = new DBSchemaMigrator(failingDialect);
            try {
                migrator.migrateTransactional(connection, desired);
                throw new AssertionError("Transactional migration must fail");
            } catch (IllegalStateException expected) {
                if (!expected.getMessage().contains("simulated transactional DDL failure"))
                    throw new AssertionError("Unexpected migration failure: " + expected.getMessage());
            }

            if (!connection.getAutoCommit())
                throw new AssertionError("Transactional migration must restore auto-commit");
            if (DBMetaData.load(connection).table("TX_FIRST") != null)
                throw new AssertionError("Transactional DDL rollback must remove TX_FIRST");
            if (DBMetaData.load(connection).table("TX_SECOND") != null)
                throw new AssertionError("TX_SECOND must not exist after failed migration");
        }

        System.out.println("DBSchemaMigratorTransactionalFailureTest: OK");
    }
}
