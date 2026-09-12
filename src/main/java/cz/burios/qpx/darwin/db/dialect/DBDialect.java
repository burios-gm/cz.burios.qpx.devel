package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** Database-specific SQL and JDBC metadata conventions. */
public interface DBDialect {
    String name();

    /** Catalog/database name used by JDBC metadata, if applicable. */
    default String catalog(Connection connection) throws SQLException {
        return connection.getCatalog();
    }

    /** Schema name used by JDBC metadata, if applicable. */
    default String schema(Connection connection) throws SQLException {
        return connection.getSchema();
    }

    /** Renders a table name for DDL. Dialects own catalog/schema qualification. */
    default String tableName(TableMetaData table) {
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name);
        return quote(table.name);
    }

    /**
     * Renders options following a CREATE TABLE definition.
     * The default convention is KEY=VALUE for every metadata parameter.
     */
    default String tableOptions(TableMetaData table) {
        if (table.params.isEmpty()) return "";
        StringBuilder sql = new StringBuilder();
        for (var entry : table.params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank())
                throw new IllegalArgumentException("Table option name must not be blank");
            if (entry.getValue() == null) continue;
            if (sql.length() > 0) sql.append(' ');
            sql.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return sql.length() == 0 ? "" : " " + sql;
    }

    default String columnName(String name) { return quote(name); }

    /** Default identifier quoting. Dialects may override this. */
    default String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*"))
            throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "`" + name + "`";
    }

    String columnDefinition(ColumnMetaData column);
}
