package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;

/** Dialect factory. New database families can be added without changing schema management. */
public final class DBDialects {
    private DBDialects() {}

    public static DBDialect forConnection(Connection connection) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        String product = connection.getMetaData().getDatabaseProductName();
        if (product != null && product.toLowerCase().contains("mysql")) return new MySQLDialect();
        throw new IllegalArgumentException("No SQL dialect registered for database: " + product);
    }
}
