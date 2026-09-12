package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** Database-specific SQL and JDBC metadata conventions. */
public interface DBDialect {
    String name();
    default String catalog(Connection connection) throws SQLException { return connection.getCatalog(); }
    default String schema(Connection connection) throws SQLException { return connection.getSchema(); }

    /** Renders a table name for DDL. Dialects own catalog/schema qualification. */
    default String tableName(TableMetaData table) {
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name);
        return quote(table.name);
    }

    /** Renders options following a CREATE TABLE definition. */
    default String tableOptions(TableMetaData table) {
        if (table.params.isEmpty()) return "";
        StringBuilder sql = new StringBuilder();
        for (var entry : table.params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank()) throw new IllegalArgumentException("Table option name must not be blank");
            if (entry.getValue() == null) continue;
            if (sql.length() > 0) sql.append(' ');
            sql.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return sql.length() == 0 ? "" : " " + sql;
    }

    /** Renders an ALTER TABLE statement for desired table options. */
    default String alterTableOptions(TableMetaData table) {
        throw new UnsupportedOperationException("Table option alteration is not supported by dialect: " + name());
    }

    default String columnName(String name) { return quote(name); }
    default String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "`" + name + "`";
    }
    String columnDefinition(ColumnMetaData column);
}
