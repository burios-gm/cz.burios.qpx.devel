package cz.burios.qpx.darwin.db.metadata;

/** Executable test for the migration definition contract. */
public final class DBSchemaMigrationTest {
    public static void main(String[] args) {
        DBMetaData desired = new DBMetaData();
        DBSchemaMigration migration = new DBSchemaMigration("V001", "Create initial schema", desired);

        if (!migration.id().equals("V001")) throw new AssertionError("Migration ID mismatch");
        if (!migration.description().equals("Create initial schema")) throw new AssertionError("Description mismatch");
        if (migration.desired() != desired) throw new AssertionError("Desired metadata mismatch");
        if (migration.includeDrops()) throw new AssertionError("includeDrops must default to false");
        if (!migration.toString().equals("V001 - Create initial schema")) throw new AssertionError("toString mismatch");

        DBSchemaMigration same = new DBSchemaMigration("V001", "Create initial schema", desired, false);
        if (!migration.equals(same)) throw new AssertionError("Equivalent migrations must compare equal");
        if (migration.hashCode() != same.hashCode()) throw new AssertionError("Equivalent migrations must have equal hash codes");

        DBSchemaMigration drops = new DBSchemaMigration("V001", "Create initial schema", desired, true);
        if (!drops.includeDrops()) throw new AssertionError("includeDrops must be preserved");
        if (migration.equals(drops)) throw new AssertionError("includeDrops must participate in equality");

        DBSchemaMigration blankDescription = new DBSchemaMigration("V002", null, desired);
        if (!blankDescription.description().isEmpty()) throw new AssertionError("Null description must become empty");
        if (!blankDescription.toString().equals("V002")) throw new AssertionError("Blank description must be omitted from toString");

        expectRejected(() -> new DBSchemaMigration(null, "x", desired), "null ID");
        expectRejected(() -> new DBSchemaMigration("", "x", desired), "blank ID");
        expectRejected(() -> new DBSchemaMigration("x".repeat(129), "x", desired), "overlong ID");
        expectRejected(() -> new DBSchemaMigration("V003", "x", null), "null desired metadata");

        System.out.println("DBSchemaMigrationTest: OK");
    }

    private static void expectRejected(Runnable action, String description) {
        try {
            action.run();
            throw new AssertionError("Expected rejection: " + description);
        } catch (IllegalArgumentException expected) {
            // expected
        }
    }
}
