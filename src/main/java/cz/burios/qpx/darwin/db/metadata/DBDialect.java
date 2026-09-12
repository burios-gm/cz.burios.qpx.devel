package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;

/** Database-specific SQL/metadata conventions used by runtime schema management. */
public interface DBDialect {
    String name();

    /** Catalog/database name used by JDBC metadata, if applicable. */
    default String catalog(Connection connection) throws java.sql.SQLException {
        return connection.getCatalog();
    }

    /** Schema name used by JDBC metadata, if applicable. */
    default String schema(Connection connection) throws java.sql.SQLException {
        return connection.getSchema();
    }

    /** Renders a table name for DDL. */
    default String tableName(TableMetaData table) {
        if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name);
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        return quote(table.name);
    }

    default String columnName(String name) { return quote(name); }

    default String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*"))
            throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "`" + name + "`";
    }

    String columnDefinition(ColumnMetaData column);
}
