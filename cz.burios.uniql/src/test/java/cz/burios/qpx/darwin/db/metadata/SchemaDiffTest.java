package cz.burios.qpx.darwin.db.metadata;

import java.util.List;

import cz.burios.uniql.metadata.*;

/** Executable test for deterministic schema migration plan serialization and hashing. */
public final class SchemaDiffTest {
    public static void main(String[] args) {
        TableMetaData first = new TableMetaData("STORE")
                .param("COMMENT", "store")
                .param("ENGINE", "InnoDB")
                .addColumn(new ColumnMetaData("ID").type("BIGINT"));
        TableMetaData second = new TableMetaData("STORE")
                .param("ENGINE", "InnoDB")
                .param("COMMENT", "store")
                .addColumn(new ColumnMetaData("ID").type("BIGINT"));

        SchemaDiff firstDiff = SchemaDiff.fromChanges(List.of(SchemaChange.createTable(first)));
        SchemaDiff secondDiff = SchemaDiff.fromChanges(List.of(SchemaChange.createTable(second)));

        if (!firstDiff.toJson().equals(secondDiff.toJson()))
            throw new AssertionError("Canonical JSON must not depend on parameter insertion order");
        if (!firstDiff.planHash().equals(secondDiff.planHash()))
            throw new AssertionError("Canonical plan hash must not depend on parameter insertion order");
        if (firstDiff.planHash().length() != 64)
            throw new AssertionError("Plan hash must be SHA-256 hex");

        System.out.println("SchemaDiffTest: OK");
    }
}
