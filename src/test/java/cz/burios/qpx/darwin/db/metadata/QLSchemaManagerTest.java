package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;

/** Executable schema-manager test; no JUnit required. */
public class QLSchemaManagerTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_manager;DB_CLOSE_DELAY=-1")) {
            MySQLDialect dialect = new MySQLDialect();
            DBSchemaManager manager = new DBSchemaManager(dialect);
            TableMetaData table = new TableMetaData("DYN_STORE");
            table.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true));
            table.addColumn(new ColumnMetaData("NAME").string(120).nullable(false));
            table.addColumn(new ColumnMetaData("PRICE").decimal(12, 2));

            manager.createTable(connection, table);
            manager.addColumn(connection, table, new ColumnMetaData("ACTIVE").bool().nullable(false).defaultValue("TRUE"));

            DBMetaData metadata = DBMetaData.load(connection);
            TableMetaData loaded = metadata.table("DYN_STORE");
            if (loaded == null) throw new AssertionError("DYN_STORE was not discovered");
            if (loaded.column("NAME") == null || loaded.column("ACTIVE") == null) throw new AssertionError("Columns missing");
            if (!loaded.column("ID").primaryKey) throw new AssertionError("Primary key missing");
            if (loaded.column("ID").logicalType != ColumnType.LONG) throw new AssertionError("ID logical type: " + loaded.column("ID").logicalType);
            if (loaded.column("NAME").logicalType != ColumnType.STRING) throw new AssertionError("NAME logical type: " + loaded.column("NAME").logicalType);
            if (loaded.column("PRICE").logicalType != ColumnType.DECIMAL) throw new AssertionError("PRICE logical type: " + loaded.column("PRICE").logicalType);
            if (loaded.column("ACTIVE").logicalType != ColumnType.BOOLEAN) throw new AssertionError("ACTIVE logical type: " + loaded.column("ACTIVE").logicalType);

            TableMetaData desired = new TableMetaData("DYN_STORE");
            desired.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true));
            desired.addColumn(new ColumnMetaData("NAME").string(120).nullable(false));
            desired.addColumn(new ColumnMetaData("PRICE").decimal(12, 2));
            desired.addColumn(new ColumnMetaData("ACTIVE").bool().nullable(false).defaultValue("TRUE"));
            SchemaDiff diff = SchemaDiff.compare(metadata, new DBMetaData().add(desired));
            if (!diff.isEmpty()) throw new AssertionError("Unexpected schema diff: " + diff);

            manager.dropColumn(connection, table, "ACTIVE");
            if (DBMetaData.load(connection).table("DYN_STORE").column("ACTIVE") != null)
                throw new AssertionError("ACTIVE was not dropped");

            manager.dropTable(connection, table);
            if (DBMetaData.load(connection).table("DYN_STORE") != null)
                throw new AssertionError("DYN_STORE was not dropped");
        }
        System.out.println("QLSchemaManagerTest: OK");
    }
}
