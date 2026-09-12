package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;

/** Executable schema-manager test; no JUnit required. */
public class QLSchemaManagerTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_manager;DB_CLOSE_DELAY=-1")) {
            DBSchemaManager manager = new DBSchemaManager(new MySQLDialect());
            TableMetaData table = new TableMetaData("DYN_STORE");
            table.addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false).primaryKey(true).autoIncrement(true));
            table.addColumn(new ColumnMetaData("NAME").type("VARCHAR(120)").nullable(false));
            table.addColumn(new ColumnMetaData("PRICE").type("DECIMAL(12,2)"));

            manager.createTable(connection, table);
            manager.addColumn(connection, table, new ColumnMetaData("ACTIVE").type("BOOLEAN").nullable(false).defaultValue("TRUE"));

            DBMetaData metadata = DBMetaData.load(connection);
            TableMetaData loaded = metadata.table("DYN_STORE");
            if (loaded == null) throw new AssertionError("DYN_STORE was not discovered");
            if (loaded.column("NAME") == null || loaded.column("ACTIVE") == null) throw new AssertionError("Columns missing");
            if (!loaded.column("ID").primaryKey) throw new AssertionError("Primary key missing");

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
