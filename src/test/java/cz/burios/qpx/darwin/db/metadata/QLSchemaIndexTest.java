package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable index/schema migration test; no JUnit required. */
public class QLSchemaIndexTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_index;DB_CLOSE_DELAY=-1")) {
            DBSchemaManager manager = new DBSchemaManager(new H2Dialect());
            TableMetaData initial = new TableMetaData("IDX_TEST");
            initial.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true));
            initial.addColumn(new ColumnMetaData("CODE").string(80));
            initial.addColumn(new ColumnMetaData("NAME").string(120));
            manager.createTable(connection, initial);

            IndexMetaData codeIndex = new IndexMetaData("IDX_TEST_CODE").unique(true).column("CODE");
            manager.createIndex(connection, initial, codeIndex);
            DBMetaData actual = DBMetaData.load(connection);
            TableMetaData loaded = actual.table("IDX_TEST");
            if (loaded == null || loaded.index("IDX_TEST_CODE") == null) throw new AssertionError("Index was not discovered");

            TableMetaData desiredTable = new TableMetaData("IDX_TEST");
            desiredTable.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true));
            desiredTable.addColumn(new ColumnMetaData("CODE").string(80));
            desiredTable.addColumn(new ColumnMetaData("NAME").string(120));
            desiredTable.addIndex(new IndexMetaData("IDX_TEST_NAME").column("NAME"));
            DBMetaData desired = new DBMetaData().add(desiredTable);

            SchemaDiff diff = SchemaDiff.compare(actual, desired, true);
            if (diff.size() != 2) throw new AssertionError("Expected drop/create index, got: " + diff);
            diff.apply(connection, manager);

            DBMetaData migrated = DBMetaData.load(connection);
            TableMetaData migratedTable = migrated.table("IDX_TEST");
            if (migratedTable.index("IDX_TEST_CODE") != null) throw new AssertionError("Old index still exists");
            if (migratedTable.index("IDX_TEST_NAME") == null) throw new AssertionError("New index missing");
            if (!SchemaDiff.compare(migrated, desired, true).isEmpty()) throw new AssertionError("Index migration is not idempotent");

            manager.dropIndex(connection, migratedTable, "IDX_TEST_NAME");
            manager.dropTable(connection, migratedTable);
        }
        System.out.println("QLSchemaIndexTest: OK");
    }
}
