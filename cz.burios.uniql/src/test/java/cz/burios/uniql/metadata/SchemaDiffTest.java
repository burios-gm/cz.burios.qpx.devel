package cz.burios.uniql.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import cz.burios.uniql.dialect.H2Dialect;

class SchemaDiffTest {

    @Test
    void createsCompositePrimaryKeyInColumnOrder() {
        DBMetaData actual = new DBMetaData();
        DBMetaData desired = new DBMetaData();
        TableMetaData table = new TableMetaData("orders");
        table.addColumn(new ColumnMetaData("tenant_code").string(20).nullable(false).primaryKey(true));
        table.addColumn(new ColumnMetaData("order_no").string(20).nullable(false).primaryKey(true));
        table.addColumn(new ColumnMetaData("description").string(100));
        desired.add(table);

        SchemaDiff diff = SchemaDiff.compare(actual, desired);

        assertFalse(diff.isEmpty());
        assertEquals(SchemaChange.Type.CREATE_TABLE, diff.changes().get(0).type());
        assertEquals(List.of(
                "CREATE TABLE \"orders\" (\"tenant_code\" VARCHAR(20) NOT NULL, \"order_no\" VARCHAR(20) NOT NULL, \"description\" VARCHAR(100), PRIMARY KEY (\"tenant_code\", \"order_no\"))"
        ), diff.toSQL(new H2Dialect()));
    }

    @Test
    void detectsChangedUniqueIndexDefinition() {
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

        assertEquals(2, diff.size());
        assertEquals(SchemaChange.Type.DROP_INDEX, diff.changes().get(0).type());
        assertEquals(SchemaChange.Type.CREATE_INDEX, diff.changes().get(1).type());
        assertTrue(diff.toSQL(new H2Dialect()).contains("CREATE UNIQUE INDEX \"uk_orders\" ON \"orders\" (\"tenant_code\", \"order_no\")"));
    }
}
