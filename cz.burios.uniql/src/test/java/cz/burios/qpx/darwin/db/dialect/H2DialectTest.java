package cz.burios.qpx.darwin.db.dialect;

import java.util.List;

import cz.burios.uniql.dialect.H2Dialect;
import cz.burios.uniql.metadata.ColumnMetaData;
import cz.burios.uniql.metadata.ColumnType;
import cz.burios.uniql.metadata.TableMetaData;

/** Executable H2 SQL-generation test; no live database required. */
public class H2DialectTest {
    public static void main(String[] args) {
        H2Dialect dialect = new H2Dialect();
        TableMetaData table = new TableMetaData("STORE").schema("PUBLIC");
        if (!"\"PUBLIC\".\"STORE\"".equals(dialect.tableName(table))) throw new AssertionError("Unexpected table name");

        ColumnMetaData name = new ColumnMetaData("NAME").string(80).nullable(false).defaultValue("''");
        if (!"\"NAME\" VARCHAR(80) NOT NULL DEFAULT ''".equals(dialect.columnDefinition(name)))
            throw new AssertionError("Unexpected column definition: " + dialect.columnDefinition(name));

        List<String> alter = dialect.alterColumnStatements(table, name);
        if (alter.size() != 3) throw new AssertionError("Expected three ALTER statements: " + alter);
        if (!"ALTER TABLE \"PUBLIC\".\"STORE\" ALTER COLUMN \"NAME\" VARCHAR(80)".equals(alter.get(0)))
            throw new AssertionError("Unexpected type ALTER: " + alter.get(0));
        if (!"ALTER TABLE \"PUBLIC\".\"STORE\" ALTER COLUMN \"NAME\" SET NOT NULL".equals(alter.get(1)))
            throw new AssertionError("Unexpected nullability ALTER: " + alter.get(1));
        if (!"ALTER TABLE \"PUBLIC\".\"STORE\" ALTER COLUMN \"NAME\" SET DEFAULT ''".equals(alter.get(2)))
            throw new AssertionError("Unexpected default ALTER: " + alter.get(2));

        ColumnMetaData active = new ColumnMetaData("ACTIVE");
        active.jdbcTypeName = "BOOLEAN";
        if (dialect.logicalType(active) != ColumnType.BOOLEAN) throw new AssertionError("BOOLEAN was not mapped");
        System.out.println("H2DialectTest: OK");
    }
}
