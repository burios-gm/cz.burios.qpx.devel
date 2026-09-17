package cz.burios.uniql.metadata;

import java.util.List;

import cz.burios.uniql.dialect.H2Dialect;

/** Executable tests for schema migration planning. */
public class SchemaDiffTest {

    public static void main(String[] args) {
        SchemaDiffTest test = new SchemaDiffTest();
        test.createsCompositePrimaryKeyInColumnOrder();
        test.detectsChangedUniqueIndexDefinition();
        System.out.println("SchemaDiffTest: OK");
    }

    public void createsCompositePrimaryKeyInColumnOrder() {
        DBMetaData actual = new DBMetaData();
        DBMetaData desired = new DBMetaData();
        TableMetaData table = new TableMetaData("orders");
        table.addColumn(new ColumnMetaData("tenant_code").string(20).nullable(false).primaryKey(true));
        table.addColumn(new ColumnMetaData("order_no").string(20).nullable(false).primaryKey(true));
        table.addColumn(new ColumnMetaData("description").string(100));
        desired.add(table);

        SchemaDiff diff = SchemaDiff.compare(actual, desired);
        check(!diff.isEmpty(), "composite primary-key migration must not be empty");
        check(diff.changes().get(0).type() == SchemaChange.Type.CREATE_TABLE, "first change must create the table");
        check(diff.toSQL(new H2Dialect()).equals(List.of(
                "CREATE TABLE \"orders\" (\"tenant_code\" VARCHAR(20) NOT NULL, \"order_no\" VARCHAR(20) NOT NULL, \"description\" VARCHAR(100), PRIMARY KEY (\"tenant_code\", \"order_no\"))"
        )), "composite primary-key SQL has unexpected column order or syntax");
    }

    public void detectsChangedUniqueIndexDefinition() {
        DBMetaData actual = new DBMetaData();
        DBMetaData desired = new DBMetaData();
        TableMetaData actualTable = new TableMetaData("orders");
        actualTable.addColumn(new ColumnMetaData("tenant_code"));
        actualTable.addColumn(new ColumnMetaData("order_no"));
        actualTable.addIndex(new IndexMetaData("uk_orders").column("tenant_code"));
        actual.add(actualTable);

        TableMetaData desiredTable = new TableMetaData("orders");
        desiredTable.addColumn(new ColumnMetaData("tenant_code"));
        desiredTable.addColumn(new ColumnMetaData("order_no"));
        desiredTable.addIndex(new IndexMetaData("uk_orders").unique(true).column("tenant_code").column("order_no"));
        desired.add(desiredTable);

        SchemaDiff diff = SchemaDiff.compare(actual, desired);
        check(diff.size() == 2, "changed index must produce DROP + CREATE");
        check(diff.changes().get(0).type() == SchemaChange.Type.DROP_INDEX, "first index change must drop old index");
        check(diff.changes().get(1).type() == SchemaChange.Type.CREATE_INDEX, "second index change must create new index");
        check(diff.toSQL(new H2Dialect()).contains("CREATE UNIQUE INDEX \"uk_orders\" ON \"orders\" (\"tenant_code\", \"order_no\")"), "unique index SQL is wrong");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
