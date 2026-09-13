package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

/**
 * Plans and applies metadata-driven database schema migrations.
 *
 * <p>The actual schema is read from the supplied JDBC connection before every
 * migration. Destructive changes are opt-in through {@code includeDrops}.</p>
 */
public final class DBSchemaMigrator {
    private final DBSchemaManager manager;

    public DBSchemaMigrator(DBDialect dialect) {
        this.manager = new DBSchemaManager(dialect);
    }

    public DBSchemaManager manager() {
        return manager;
    }

    /** Creates a migration plan without executing it. */
    public SchemaDiff plan(Connection connection, DBMetaData desired) throws SQLException {
        return plan(connection, desired, false);
    }

    /** Creates a migration plan; destructive changes are included only when requested. */
    public SchemaDiff plan(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        requireConnection(connection);
        if (desired == null) throw new IllegalArgumentException("desired metadata must not be null");
        DBMetaData actual = DBMetaData.load(connection);
        return SchemaDiff.compare(actual, desired, includeDrops);
    }

    /** Loads the current schema, computes a safe migration plan and applies it. */
    public SchemaDiff migrate(Connection connection, DBMetaData desired) throws SQLException {
        return migrate(connection, desired, false);
    }

    /**
     * Loads the current schema, computes a migration plan and applies it.
     * Destructive changes are applied only when {@code includeDrops} is true.
     * The returned diff is the plan that was executed.
     */
    public SchemaDiff migrate(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        requireConnection(connection);
        SchemaDiff diff = plan(connection, desired, includeDrops);
        diff.apply(connection, manager);
        return diff;
    }

    private static void requireConnection(Connection connection) {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
    }
}
