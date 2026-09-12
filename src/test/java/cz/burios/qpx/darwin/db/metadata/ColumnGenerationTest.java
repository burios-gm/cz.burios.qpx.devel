package cz.burios.qpx.darwin.db.metadata;

import cz.burios.qpx.darwin.db.dialect.MySQLDialect;

/** Executable smoke test for portable timestamp generation metadata. */
public class ColumnGenerationTest {
    public static void main(String[] args) {
        MySQLDialect dialect = new MySQLDialect();

        ColumnMetaData created = new ColumnMetaData("CREATED_AT")
                .type("DATETIME")
                .nullable(false)
                .generation(ColumnGeneration.INSERT_TIMESTAMP);
        assertEquals("DEFAULT CURRENT_TIMESTAMP", dialect.columnGeneration(created));
        assertEquals("`CREATED_AT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", dialect.columnDefinition(created));

        ColumnMetaData updated = new ColumnMetaData("UPDATED_AT")
                .type("DATETIME")
                .nullable(false)
                .generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
        assertEquals("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", dialect.columnGeneration(updated));
        assertEquals("`UPDATED_AT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", dialect.columnDefinition(updated));

        TableMetaData actualTable = new TableMetaData("numeral_table");
        actualTable.addColumn(new ColumnMetaData("UPDATED_AT")
                .type("DATETIME")
                .nullable(false)
                .generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP));
        TableMetaData desiredTable = new TableMetaData("numeral_table");
        desiredTable.addColumn(new ColumnMetaData("UPDATED_AT")
                .type("DATETIME")
                .nullable(false)
                .generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP));
        DBMetaData actual = new DBMetaData().add(actualTable);
        DBMetaData desired = new DBMetaData().add(desiredTable);
        if (!SchemaDiff.compare(actual, desired).isEmpty()) throw new AssertionError("Matching generation must not produce a schema change");

        desiredTable.column("UPDATED_AT").generation(ColumnGeneration.INSERT_TIMESTAMP);
        if (SchemaDiff.compare(actual, desired).size() != 1) throw new AssertionError("Generation mismatch must produce an ALTER_COLUMN change");

        System.out.println("ColumnGenerationTest: OK");
    }

    private static void assertEquals(String expected, String actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected [" + expected + "] but got [" + actual + "]");
    }
}
