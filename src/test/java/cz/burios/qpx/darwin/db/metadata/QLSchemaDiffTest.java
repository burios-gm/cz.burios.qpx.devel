package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;

/** Executable schema-diff test; no JUnit required. */
public class QLSchemaDiffTest {
    public static void main(String[] args) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:schema_diff;DB_CLOSE_DELAY=-1")) {
            DBSchemaManager manager = new DBSchemaManager(new MySQLDialect());

            TableMetaData actualTable = new TableMetaData("DYN_STORE");
            actualTable.addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false).primaryKey(true).autoIncrement(true));
            actualTable.addColumn(new ColumnMetaData("NAME").type("VARCHAR(120)").nullable(false));
            manager.createTable(connection, actualTable);

            DBMetaData actual = DBMetaData.load(connection);
            DBMetaData desired = new DBMetaData(actual.databaseName);
            TableMetaData desiredTable = new TableMetaData("DYN_STORE");
            desiredTable.addColumn(new ColumnMetaData("ID").type("BIGINT").nullable(false).primaryKey(true).autoIncrement(true));
            desiredTable.addColumn(new ColumnMetaData("NAME").type("VARCHAR(120)").nullable(false));
            desiredTable.addColumn(new ColumnMetaData("ACTIVE").type("BOOLEAN").nullable(false).defaultValue("TRUE"));
            desired.add(desiredTable);

            SchemaDiff diff = SchemaDiff.compare(actual, desired);
            if (diff.size() != 1) throw new AssertionError("Expected one change, got: " + diff);
            if (diff.changes().get(0).type() != SchemaChange.Type.ADD_COLUMN)
                throw new AssertionError("Expected ADD_COLUMN: " + diff);

            diff.apply(connection, manager);
            if (DBMetaData.load(connection).table("DYN_STORE").column("ACTIVE") == null)
                throw new AssertionError("ACTIVE was not added");

            DBMetaData withExtra = DBMetaData.load(connection);
            SchemaDiff safeDiff = SchemaDiff.compare(withExtra, desired);
            if (!safeDiff.isEmpty()) throw new AssertionError("Schema should be synchronized: " + safeDiff);

            SchemaDiff destructiveDiff = SchemaDiff.compare(withExtra, new DBMetaData(actual.databaseName), true);
            if (destructiveDiff.size() != 1 || destructiveDiff.changes().get(0).type() != SchemaChange.Type.DROP_TABLE)
                throw new AssertionError("Expected DROP_TABLE: " + destructiveDiff);
        }
        System.out.println("QLSchemaDiffTest: OK");
    }
}
