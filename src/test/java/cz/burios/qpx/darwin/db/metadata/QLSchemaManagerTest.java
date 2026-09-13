package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.H2Dialect;

/** Executable schema-manager test; no JUnit required. */
public class QLSchemaManagerTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_manager;DB_CLOSE_DELAY=-1")) {
            H2Dialect dialect = new H2Dialect();
            DBSchemaManager manager = new DBSchemaManager(dialect);

            TableMetaData initial = new TableMetaData("DYN_STORE");
            initial.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true));
            initial.addColumn(new ColumnMetaData("NAME").string(120).nullable(true));
            initial.addColumn(new ColumnMetaData("PRICE").decimal(12, 2));
            initial.addIndex(new IndexMetaData("IX_DYN_STORE_NAME").column("NAME"));
            manager.createTable(connection, initial);

            DBMetaData actual = DBMetaData.load(connection);
            TableMetaData loaded = actual.table("DYN_STORE");
            if (loaded == null) throw new AssertionError("DYN_STORE was not discovered");
            if (loaded.column("NAME") == null) throw new AssertionError("NAME column missing");
            if (!loaded.column("ID").primaryKey) throw new AssertionError("Primary key missing");
            if (loaded.column("ID").logicalType != ColumnType.LONG) throw new AssertionError("ID logical type: " + loaded.column("ID").logicalType);
            if (loaded.column("NAME").logicalType != ColumnType.STRING) throw new AssertionError("NAME logical type: " + loaded.column("NAME").logicalType);
            if (loaded.column("PRICE").logicalType != ColumnType.DECIMAL) throw new AssertionError("PRICE logical type: " + loaded.column("PRICE").logicalType);
            if (loaded.indexes.size() != 1 || !"IX_DYN_STORE_NAME".equalsIgnoreCase(loaded.indexes.get(0).name)) throw new AssertionError("Secondary index was not loaded: " + loaded.indexes);
            if (!loaded.indexes.get(0).columns.equals(java.util.List.of("NAME"))) throw new AssertionError("Index columns were not loaded: " + loaded.indexes.get(0).columns);

            TableMetaData desiredTable = new TableMetaData("DYN_STORE");
            desiredTable.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true));
            desiredTable.addColumn(new ColumnMetaData("NAME").string(80).nullable(false));
            desiredTable.addColumn(new ColumnMetaData("PRICE").decimal(14, 3));
            desiredTable.addColumn(new ColumnMetaData("ACTIVE").bool().nullable(false));
            desiredTable.addIndex(new IndexMetaData("IX_DYN_STORE_NAME").column("NAME"));
            DBMetaData desired = new DBMetaData().add(desiredTable);

            SchemaDiff diff = SchemaDiff.compare(actual, desired);
            if (diff.isEmpty()) throw new AssertionError("Expected schema changes");
            if (diff.size() != 3) throw new AssertionError("Expected 3 changes, got: " + diff);

            boolean nameAlter = false, priceAlter = false, activeAdd = false;
            for (SchemaChange change : diff.changes()) {
                if (change.type() == SchemaChange.Type.ALTER_COLUMN && "NAME".equalsIgnoreCase(change.column().name)) nameAlter = true;
                if (change.type() == SchemaChange.Type.ALTER_COLUMN && "PRICE".equalsIgnoreCase(change.column().name)) priceAlter = true;
                if (change.type() == SchemaChange.Type.ADD_COLUMN && "ACTIVE".equalsIgnoreCase(change.column().name)) activeAdd = true;
            }
            if (!nameAlter || !priceAlter || !activeAdd) throw new AssertionError("Unexpected diff: " + diff);

            diff.apply(connection, manager);
            DBMetaData migrated = DBMetaData.load(connection);
            TableMetaData migratedTable = migrated.table("DYN_STORE");
            if (migratedTable == null) throw new AssertionError("DYN_STORE disappeared after migration");
            ColumnMetaData name = migratedTable.column("NAME");
            if (name == null || name.logicalType != ColumnType.STRING || name.length != 80 || name.nullable) throw new AssertionError("NAME was not migrated correctly: " + describe(name));
            ColumnMetaData price = migratedTable.column("PRICE");
            if (price == null || price.logicalType != ColumnType.DECIMAL || price.precision != 14 || price.scale != 3) throw new AssertionError("PRICE was not migrated correctly: " + describe(price));
            ColumnMetaData active = migratedTable.column("ACTIVE");
            if (active == null || active.logicalType != ColumnType.BOOLEAN || active.nullable) throw new AssertionError("ACTIVE was not added correctly: " + describe(active));
            if (migratedTable.indexes.size() != 1 || !"IX_DYN_STORE_NAME".equalsIgnoreCase(migratedTable.indexes.get(0).name)) throw new AssertionError("Index disappeared after migration");

            SchemaDiff after = SchemaDiff.compare(migrated, desired);
            if (!after.isEmpty()) throw new AssertionError("Migration did not converge: " + after);
            manager.dropIndex(connection, migratedTable, "IX_DYN_STORE_NAME");
            if (!DBMetaData.load(connection).table("DYN_STORE").indexes.isEmpty()) throw new AssertionError("Index was not dropped");
            manager.dropColumn(connection, migratedTable, "ACTIVE");
            if (DBMetaData.load(connection).table("DYN_STORE").column("ACTIVE") != null) throw new AssertionError("ACTIVE was not dropped");
            manager.dropTable(connection, migratedTable);
            if (DBMetaData.load(connection).table("DYN_STORE") != null) throw new AssertionError("DYN_STORE was not dropped");
        }
        System.out.println("QLSchemaManagerTest: OK");
    }
    private static String describe(ColumnMetaData column) {
        if (column == null) return "null";
        return column.name + " type=" + column.logicalType + " length=" + column.length + " precision=" + column.precision + " scale=" + column.scale + " nullable=" + column.nullable;
    }
}
