package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable integration test for ordered, persistent schema migration execution. */
public final class DBSchemaMigrationRunnerTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_runner;DB_CLOSE_DELAY=-1")) {
            DBMetaData v1 = new DBMetaData().add(new TableMetaData("STORE")
                    .addColumn(new ColumnMetaData("ID").type("BIGINT")));
            DBMetaData v2 = new DBMetaData()
                    .add(new TableMetaData("STORE").addColumn(new ColumnMetaData("ID").type("BIGINT")))
                    .add(new TableMetaData("PRODUCT").addColumn(new ColumnMetaData("ID").type("BIGINT")));

            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                    new DBSchemaMigration("V001", "create store", v1),
                    new DBSchemaMigration("V002", "create product", v2)));

            if (runner.pending(connection).size() != 2) throw new AssertionError("Expected two pending migrations");
            List<SchemaDiff> applied = runner.migrate(connection);
            if (applied.size() != 2) throw new AssertionError("Expected two applied migrations");
            if (!runner.pending(connection).isEmpty()) throw new AssertionError("Expected no pending migrations");
            if (runner.migrate(connection).size() != 0) throw new AssertionError("Migration run should be idempotent");
            if (runner.history().list(connection).size() != 2) throw new AssertionError("Expected two history entries");

            try {
                new DBSchemaMigrationRunner(new H2Dialect(), List.of(
                        new DBSchemaMigration("V001", "one", v1),
                        new DBSchemaMigration("v001", "duplicate", v2)));
                throw new AssertionError("Duplicate migration IDs should fail case-insensitively");
            } catch (IllegalArgumentException expected) { }
        }
        System.out.println("DBSchemaMigrationRunnerTest: OK");
    }
}
