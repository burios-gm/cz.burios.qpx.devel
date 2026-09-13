package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

/** Plans and applies metadata-driven database schema migrations. */
public final class DBSchemaMigrator {
    private final DBSchemaManager manager;

    public DBSchemaMigrator(DBDialect dialect) {
        this.manager = new DBSchemaManager(dialect);
    }

    public DBSchemaManager manager() { return manager; }

    /** Creates a migration plan without executing it. */
    public SchemaDiff plan(Connection connection, DBMetaData desired) throws SQLException {
        return plan(connection, desired, false);
    }

    /** Creates a migration plan; destructive changes are included only when requested. */
    public SchemaDiff plan(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        requireConnection(connection);
        if (desired == null) throw new IllegalArgumentException("desired metadata must not be null");
        return SchemaDiff.compare(DBMetaData.load(connection), desired, includeDrops);
    }

    /** Loads the current schema, computes a safe migration plan and applies it. */
    public SchemaDiff migrate(Connection connection, DBMetaData desired) throws SQLException {
        return migrate(connection, desired, false);
    }

    /** Loads the current schema, computes a migration plan and applies it. */
    public SchemaDiff migrate(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        return migrate(connection, desired, includeDrops, false);
    }

    /**
     * Applies the migration plan. Transactional mode requires JDBC auto-commit
     * to be enabled and restores it afterwards. Rollback is attempted when an
     * execution error occurs. Transactional DDL remains database-dependent.
     */
    public SchemaDiff migrate(Connection connection, DBMetaData desired, boolean includeDrops,
            boolean transactional) throws SQLException {
        requireConnection(connection);
        SchemaDiff diff = plan(connection, desired, includeDrops);
        if (!transactional || diff.isEmpty()) {
            diff.apply(connection, manager);
            return diff;
        }

        boolean originalAutoCommit = connection.getAutoCommit();
        if (!originalAutoCommit)
            throw new IllegalStateException("transactional migration requires auto-commit to be enabled");

        try {
            connection.setAutoCommit(false);
            try {
                diff.apply(connection, manager);
                connection.commit();
                return diff;
            } catch (SQLException | RuntimeException failure) {
                try {
                    connection.rollback();
                } catch (SQLException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
                throw failure;
            }
        } finally {
            connection.setAutoCommit(originalAutoCommit);
        }
    }

    /** Convenience method for a transactional migration without drops. */
    public SchemaDiff migrateTransactional(Connection connection, DBMetaData desired) throws SQLException {
        return migrate(connection, desired, false, true);
    }

    /** Convenience method for a transactional migration with explicit drops. */
    public SchemaDiff migrateTransactional(Connection connection, DBMetaData desired, boolean includeDrops) throws SQLException {
        return migrate(connection, desired, includeDrops, true);
    }

    private static void requireConnection(Connection connection) {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
    }
}
