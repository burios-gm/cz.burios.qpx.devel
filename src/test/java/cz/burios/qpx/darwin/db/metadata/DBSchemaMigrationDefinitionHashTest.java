package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DriverManager;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.*;

/** Executable regression test for migration-definition integrity after APPLIED. */
public final class DBSchemaMigrationDefinitionHashTest {
    public static void main(String[] args) throws Exception {
        DBMetaData desired = new DBMetaData()
                .add(new TableMetaData("STORE")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT")));
        DBSchemaMigration declared = new DBSchemaMigration("V001", "create store", desired);
        String hash = declared.definitionHash();
        if (hash.length() != 64) throw new AssertionError("Definition hash must be SHA-256 hex");
        if (!hash.equals(declared.definitionHash())) throw new AssertionError("Definition hash must be deterministic");

        DBMetaData changedDesired = new DBMetaData()
                .add(new TableMetaData("STORE")
                        .addColumn(new ColumnMetaData("ID").type("BIGINT"))
                        .addColumn(new ColumnMetaData("NAME").type("VARCHAR(100)")));
        DBSchemaMigration changed = new DBSchemaMigration("V001", "create store", changedDesired);
        if (hash.equals(changed.definitionHash())) throw new AssertionError("Changed desired schema must change definition hash");

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:migration_definition_hash;DB_CLOSE_DELAY=-1")) {
            DBSchemaMigrationRunner runner = new DBSchemaMigrationRunner(new H2Dialect(), declared);
            if (runner.migrate(connection).size() != 1) throw new AssertionError("Initial migration should be applied");
            SchemaMigrationHistory.Entry entry = runner.history().find(connection, "V001");
            if (!hash.equalsIgnoreCase(entry.definitionHash())) throw new AssertionError("History must store the migration definition hash");

            DBSchemaMigrationRunner changedRunner = new DBSchemaMigrationRunner(new H2Dialect(), changed);
            try {
                changedRunner.migrate(connection);
                throw new AssertionError("Changed declaration must not be accepted for an APPLIED migration ID");
            } catch (SchemaMigrationException expected) { }

            if (runner.migrate(connection).size() != 0) throw new AssertionError("Unchanged APPLIED migration must remain idempotent");
        }

        System.out.println("DBSchemaMigrationDefinitionHashTest: OK");
    }
}
