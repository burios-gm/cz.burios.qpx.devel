package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.ColumnType;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** Database-specific SQL and JDBC metadata conventions. */
public interface DBDialect {
    String name();
    default String catalog(Connection connection) throws SQLException { return connection.getCatalog(); }
    default String schema(Connection connection) throws SQLException { return connection.getSchema(); }
    default void loadTableOptions(Connection connection, String catalog, String schema, TableMetaData table) throws SQLException {}
    default void loadColumnOptions(Connection connection, String catalog, String schema, String tableName, ColumnMetaData column) throws SQLException {}

    /** Maps a discovered native/JDBC type to the database-independent logical type. */
    default ColumnType logicalType(ColumnMetaData column) {
        if (column == null) return null;
        return switch (column.jdbcType) {
            case java.sql.Types.BOOLEAN, java.sql.Types.BIT -> ColumnType.BOOLEAN;
            case java.sql.Types.BIGINT -> ColumnType.LONG;
            case java.sql.Types.INTEGER, java.sql.Types.SMALLINT, java.sql.Types.TINYINT -> ColumnType.INTEGER;
            case java.sql.Types.DECIMAL, java.sql.Types.NUMERIC -> ColumnType.DECIMAL;
            case java.sql.Types.DOUBLE, java.sql.Types.FLOAT -> ColumnType.DOUBLE;
            case java.sql.Types.DATE -> ColumnType.DATE;
            case java.sql.Types.TIMESTAMP -> ColumnType.TIMESTAMP;
            case java.sql.Types.TIME -> ColumnType.TIME;
            case java.sql.Types.BINARY, java.sql.Types.VARBINARY, java.sql.Types.LONGVARBINARY -> ColumnType.BINARY;
            case java.sql.Types.LONGVARCHAR -> ColumnType.TEXT;
            default -> ColumnType.STRING;
        };
    }

    default String tableName(TableMetaData table) {
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name);
        return quote(table.name);
    }
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
    default String alterTableOptions(TableMetaData table) {
        throw new UnsupportedOperationException("Table option alteration is not supported by dialect: " + name());
    }
    default String columnName(String name) { return quote(name); }
    default String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "`" + name + "`";
    }
    default String columnGeneration(ColumnMetaData column) { return ""; }
    String columnDefinition(ColumnMetaData column);
}
