package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.SQLException;

/** Dialect factory. New database families can be added without changing schema management. */
public final class DBDialects {
    private DBDialects() {}

    public static DBDialect forConnection(Connection connection) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        String product = connection.getMetaData().getDatabaseProductName();
        String normalized = product == null ? "" : product.toLowerCase();
        if (normalized.contains("mysql")) return new MySQLDialect();
        if (normalized.contains("postgresql")) return new PostgreSQLDialect();
        throw new IllegalArgumentException("No SQL dialect registered for database: " + product);
    }
}
