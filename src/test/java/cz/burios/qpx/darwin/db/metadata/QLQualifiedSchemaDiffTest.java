package cz.burios.qpx.darwin.db.metadata;

/** Executable test for database/schema-aware metadata identity. */
public class QLQualifiedSchemaDiffTest {
    public static void main(String[] args) {
        DBMetaData actual = new DBMetaData();
        actual.add(new TableMetaData("STORE").database("depo_cz").schema("dbo")
                .addColumn(new ColumnMetaData("ID").longType().nullable(false)));
        actual.add(new TableMetaData("STORE").database("depo_sk").schema("dbo")
                .addColumn(new ColumnMetaData("ID").longType().nullable(false)));

        if (actual.tables.size() != 2) throw new AssertionError("Qualified tables collided");
        if (actual.table("DEPO_CZ.DBO.STORE") == null) throw new AssertionError("Qualified lookup failed");
        if (actual.table("STORE") != null) throw new AssertionError("Ambiguous simple lookup must return null");

        DBMetaData desired = new DBMetaData();
        desired.add(new TableMetaData("STORE").database("depo_cz").schema("dbo")
                .addColumn(new ColumnMetaData("ID").longType().nullable(false)));
        desired.add(new TableMetaData("STORE").database("depo_sk").schema("dbo")
                .addColumn(new ColumnMetaData("ID").longType().nullable(false)));

        SchemaDiff diff = SchemaDiff.compare(actual, desired);
        if (!diff.isEmpty()) throw new AssertionError("Qualified metadata should converge: " + diff);
        System.out.println("QLQualifiedSchemaDiffTest: OK");
    }
}
