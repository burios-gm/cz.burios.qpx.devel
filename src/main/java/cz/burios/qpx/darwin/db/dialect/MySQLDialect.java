package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

import cz.burios.qpx.darwin.db.metadata.ColumnGeneration;
import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.ColumnType;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** MySQL dialect: JDBC catalog is the database namespace. */
public class MySQLDialect implements DBDialect {
    @Override public String name() { return "mysql"; }
    @Override public String tableName(TableMetaData table) {
        if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name);
        return quote(table.name);
    }
    @Override public void loadTableOptions(Connection connection, String catalog, String schema, TableMetaData table) throws SQLException {
        if (catalog == null || catalog.isBlank() || table.name == null || table.name.isBlank()) return;
        String sql = "SELECT ENGINE, TABLE_COLLATION, TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, catalog); ps.setString(2, table.name);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return;
                String engine = rs.getString("ENGINE");
                String collation = rs.getString("TABLE_COLLATION");
                String comment = rs.getString("TABLE_COMMENT");
                if (engine != null) table.actualParam("ENGINE", engine);
                if (collation != null) {
                    int separator = collation.indexOf('_');
                    String charset = separator > 0 ? collation.substring(0, separator) : null;
                    if (charset != null && !charset.isBlank()) table.actualParam("DEFAULT CHARSET", charset);
                    table.actualParam("COLLATE", collation);
                }
                if (comment != null && !comment.isBlank()) table.actualParam("COMMENT", "'" + comment.replace("'", "''") + "'");
            }
        }
    }
    @Override public void loadColumnOptions(Connection connection, String catalog, String schema, String tableName, ColumnMetaData column) throws SQLException {
        if (catalog == null || catalog.isBlank() || tableName == null || column.name == null) return;
        String sql = "SELECT EXTRA, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, catalog); ps.setString(2, tableName); ps.setString(3, column.name);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return;
                String collation = rs.getString("COLLATION_NAME");
                if (collation != null && !collation.isBlank()) column.collation(collation);
                String extra = rs.getString("EXTRA");
                if (extra == null) return;
                String normalized = extra.toLowerCase(java.util.Locale.ROOT);
                boolean onUpdate = normalized.contains("on update current_timestamp");
                boolean currentDefault = column.defaultValue != null && column.defaultValue.toLowerCase(java.util.Locale.ROOT).contains("current_timestamp");
                if (onUpdate) column.generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
                else if (currentDefault) column.generation(ColumnGeneration.INSERT_TIMESTAMP);
            }
        }
    }
    @Override public ColumnType logicalType(ColumnMetaData c) {
        String nativeType = c.jdbcTypeName != null ? c.jdbcTypeName : c.type;
        if (nativeType != null) {
            String t = nativeType.toUpperCase(java.util.Locale.ROOT);
            if (t.startsWith("VARCHAR") || t.startsWith("CHAR")) return ColumnType.STRING;
            if (t.startsWith("TEXT") || t.startsWith("TINYTEXT") || t.startsWith("MEDIUMTEXT") || t.startsWith("LONGTEXT")) return ColumnType.TEXT;
            if (t.startsWith("TINYINT(1)")) return ColumnType.BOOLEAN;
            if (t.startsWith("TINYINT") || t.startsWith("SMALLINT") || t.startsWith("MEDIUMINT") || t.startsWith("INT")) return ColumnType.INTEGER;
            if (t.startsWith("BIGINT")) return ColumnType.LONG;
            if (t.startsWith("DECIMAL") || t.startsWith("NUMERIC")) return ColumnType.DECIMAL;
            if (t.startsWith("DOUBLE") || t.startsWith("FLOAT")) return ColumnType.DOUBLE;
            if (t.startsWith("DATETIME")) return ColumnType.DATETIME;
            if (t.startsWith("TIMESTAMP")) return ColumnType.TIMESTAMP;
            if (t.startsWith("DATE")) return ColumnType.DATE;
            if (t.startsWith("TIME")) return ColumnType.TIME;
            if (t.contains("BINARY") || t.startsWith("BLOB")) return ColumnType.BINARY;
        }
        return switch (c.jdbcType) {
            case Types.BOOLEAN, Types.BIT -> ColumnType.BOOLEAN;
            case Types.BIGINT -> ColumnType.LONG;
            case Types.INTEGER, Types.SMALLINT, Types.TINYINT -> ColumnType.INTEGER;
            case Types.DECIMAL, Types.NUMERIC -> ColumnType.DECIMAL;
            case Types.DOUBLE, Types.FLOAT -> ColumnType.DOUBLE;
            case Types.DATE -> ColumnType.DATE;
            case Types.TIMESTAMP -> ColumnType.TIMESTAMP;
            case Types.TIME -> ColumnType.TIME;
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> ColumnType.BINARY;
            case Types.LONGVARCHAR -> ColumnType.TEXT;
            default -> ColumnType.STRING;
        };
    }
    @Override public String columnDefinition(ColumnMetaData c) {
        StringBuilder sql = new StringBuilder(columnName(c.name)).append(' ').append(type(c));
        if (c.autoIncrement) sql.append(" AUTO_INCREMENT");
        if (!c.nullable) sql.append(" NOT NULL");
        String generation = columnGeneration(c);
        if (!generation.isBlank()) sql.append(' ').append(generation);
        else if (c.defaultValue != null) sql.append(" DEFAULT ").append(c.defaultValue);
        if (c.collation != null && !c.collation.isBlank() && isCharacterType(c)) sql.append(" COLLATE ").append(c.collation);
        return sql.toString();
    }
    @Override public String columnGeneration(ColumnMetaData c) {
        return switch (c.generation == null ? ColumnGeneration.NONE : c.generation) {
            case NONE -> "";
            case INSERT_TIMESTAMP -> "DEFAULT CURRENT_TIMESTAMP";
            case INSERT_UPDATE_TIMESTAMP -> "DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP";
        };
    }
    @Override public String alterColumn(TableMetaData table, ColumnMetaData column) {
        return "ALTER TABLE " + tableName(table) + " MODIFY COLUMN " + columnDefinition(column);
    }
    @Override public String alterTableOptions(TableMetaData table) {
        if (table.params.isEmpty()) return "";
        StringBuilder sql = new StringBuilder("ALTER TABLE ").append(tableName(table));
        for (var entry : table.params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank()) throw new IllegalArgumentException("Table option name must not be blank");
            if (entry.getValue() == null) continue;
            sql.append(' ').append(entry.getKey()).append('=').append(entry.getValue());
        }
        return sql.toString();
    }
    private boolean isCharacterType(ColumnMetaData c) {
        return c.logicalType == ColumnType.STRING || c.logicalType == ColumnType.TEXT
                || c.jdbcType == Types.CHAR || c.jdbcType == Types.VARCHAR || c.jdbcType == Types.LONGVARCHAR;
    }
    private String type(ColumnMetaData c) {
        if (c.logicalType != null) return switch (c.logicalType) {
            case STRING -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR(255)";
            case TEXT -> "TEXT";
            case BOOLEAN -> "BOOLEAN";
            case INTEGER -> "INT";
            case LONG -> "BIGINT";
            case DECIMAL -> c.precision > 0 ? "DECIMAL(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "DECIMAL";
            case DOUBLE -> "DOUBLE";
            case DATE -> "DATE";
            case TIME -> "TIME";
            case DATETIME -> "DATETIME";
            case TIMESTAMP -> "TIMESTAMP";
            case BINARY -> c.length > 0 ? "VARBINARY(" + c.length + ")" : "BLOB";
        };
        if (c.type != null && !c.type.isBlank()) {
            String t = c.type.trim();
            if (t.matches("[A-Za-z][A-Za-z0-9_]*(\\s*\\(\\s*[0-9]+(?:\\s*,\\s*[0-9]+)?\\s*\\))?")) return t;
        }
        return switch (c.jdbcType) {
            case Types.BIGINT -> "BIGINT"; case Types.INTEGER -> "INT"; case Types.SMALLINT -> "SMALLINT"; case Types.TINYINT -> "TINYINT";
            case Types.DECIMAL, Types.NUMERIC -> c.precision > 0 ? "DECIMAL(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "DECIMAL";
            case Types.DOUBLE -> "DOUBLE"; case Types.FLOAT -> "FLOAT"; case Types.BOOLEAN, Types.BIT -> "BOOLEAN";
            case Types.DATE -> "DATE"; case Types.TIMESTAMP -> "TIMESTAMP"; case Types.TIME -> "TIME";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> c.length > 0 ? "VARBINARY(" + c.length + ")" : "BLOB";
            case Types.CHAR -> c.length > 0 ? "CHAR(" + c.length + ")" : "CHAR";
            case Types.VARCHAR -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR(255)";
            case Types.LONGVARCHAR -> "TEXT"; default -> "TEXT";
        };
    }
}
