package cz.burios.qpx.darwin.db.metadata;

/** Executable index schema-diff test; no JUnit required. */
public class QLSchemaIndexDiffTest {
    public static void main(String[] args) {
        DBMetaData actual = metadata(index("IX_STORE_NAME", false, "BTREE", "NAME", "ID"));

        DBMetaData desiredSame = metadata(index("IX_STORE_NAME", false, "BTREE", "NAME", "ID"));
        SchemaDiff same = SchemaDiff.compare(actual, desiredSame);
        if (!same.isEmpty()) throw new AssertionError("Matching index should produce no changes: " + same);

        DBMetaData desiredChanged = metadata(index("IX_STORE_NAME", true, "HASH", "ID", "NAME"));
        SchemaDiff changed = SchemaDiff.compare(actual, desiredChanged);
        if (changed.size() != 2) throw new AssertionError("Index change should be DROP + CREATE: " + changed);
        if (changed.changes().get(0).type() != SchemaChange.Type.DROP_INDEX)
            throw new AssertionError("Expected DROP_INDEX first: " + changed);
        if (!"IX_STORE_NAME".equals(changed.changes().get(0).indexName()))
            throw new AssertionError("Unexpected dropped index: " + changed.changes().get(0).indexName());
        if (changed.changes().get(1).type() != SchemaChange.Type.CREATE_INDEX)
            throw new AssertionError("Expected CREATE_INDEX second: " + changed);
        IndexMetaData created = changed.changes().get(1).index();
        if (!created.unique || !"HASH".equals(created.method) || !created.columns.equals(java.util.List.of("ID", "NAME")))
            throw new AssertionError("Unexpected replacement index: " + created.name);

        DBMetaData desiredMissing = metadata();
        SchemaDiff missingWithoutDrops = SchemaDiff.compare(actual, desiredMissing);
        if (!missingWithoutDrops.isEmpty()) throw new AssertionError("Index must not be dropped without includeDrops: " + missingWithoutDrops);
        SchemaDiff missingWithDrops = SchemaDiff.compare(actual, desiredMissing, true);
        if (missingWithDrops.size() != 1 || missingWithDrops.changes().get(0).type() != SchemaChange.Type.DROP_INDEX)
            throw new AssertionError("Expected DROP_INDEX with includeDrops: " + missingWithDrops);

        System.out.println("QLSchemaIndexDiffTest: OK");
    }

    private static DBMetaData metadata(IndexMetaData... indexes) {
        DBMetaData metadata = new DBMetaData();
        TableMetaData table = new TableMetaData("STORE");
        for (IndexMetaData index : indexes) table.addIndex(index);
        metadata.add(table);
        return metadata;
    }

    private static IndexMetaData index(String name, boolean unique, String method, String... columns) {
        IndexMetaData index = new IndexMetaData(name).unique(unique).method(method);
        for (String column : columns) index.column(column);
        return index;
    }
}
