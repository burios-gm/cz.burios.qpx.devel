package cz.burios.qpx.darwin.db.dialect;

import java.sql.Types;
import java.util.Locale;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.ColumnType;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** SQLite dialect. SQLite has no catalog/schema namespace in ordinary database files. */
public class SQLiteDialect implements DBDialect {
    @Override public String name() { return "sqlite"; }
    @Override public String catalog(java.sql.Connection connection) { return null; }
    @Override public String schema(java.sql.Connection connection) { return null; }

    @Override public String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "\"" + name + "\"";
    }

    @Override public String tableName(TableMetaData table) { return quote(table.name); }

    @Override public ColumnType logicalType(ColumnMetaData c) {
        String nativeType = c.jdbcTypeName != null ? c.jdbcTypeName : c.type;
        if (nativeType != null) {
            String t = nativeType.toUpperCase(Locale.ROOT);
            if (t.contains("CHAR") || t.contains("CLOB") || t.contains("TEXT")) return ColumnType.STRING;
            if (t.contains("INT")) return ColumnType.LONG;
            if (t.contains("REAL") || t.contains("FLOA") || t.contains("DOUB")) return ColumnType.DOUBLE;
            if (t.contains("NUMERIC") || t.contains("DECIMAL")) return ColumnType.DECIMAL;
            if (t.contains("BLOB")) return ColumnType.BINARY;
            if (t.contains("DATE") && t.contains("TIME")) return ColumnType.DATETIME;
            if (t.contains("DATE")) return ColumnType.DATE;
            if (t.contains("TIME")) return ColumnType.TIME;
            if (t.contains("BOOL")) return ColumnType.BOOLEAN;
        }
        return DBDialect.super.logicalType(c);
    }

    @Override public String columnDefinition(ColumnMetaData c) {
        StringBuilder sql = new StringBuilder(columnName(c.name)).append(' ').append(type(c));
        if (c.autoIncrement && c.primaryKey && c.logicalType == ColumnType.LONG) sql.append(" PRIMARY KEY AUTOINCREMENT");
        else if (c.primaryKey) sql.append(" PRIMARY KEY");
        if (!c.nullable) sql.append(" NOT NULL");
        if (c.defaultValue != null) sql.append(" DEFAULT ").append(c.defaultValue);
        return sql.toString();
    }

    /** SQLite has intentionally limited ALTER COLUMN support; use table rebuilds for general changes. */
    @Override public String alterColumn(TableMetaData table, ColumnMetaData column) {
        throw new UnsupportedOperationException("SQLite does not support general ALTER COLUMN; use a table rebuild");
    }

    private String type(ColumnMetaData c) {
        if (c.logicalType != null) return switch (c.logicalType) {
            case STRING -> "TEXT";
            case TEXT -> "TEXT";
            case BOOLEAN, INTEGER, LONG -> "INTEGER";
            case DECIMAL, DOUBLE -> "REAL";
            case DATE, TIME, DATETIME, TIMESTAMP -> "TEXT";
            case BINARY -> "BLOB";
        };
        if (c.type != null && !c.type.isBlank()) return c.type.trim();
        return switch (c.jdbcType) {
            case Types.BIGINT, Types.INTEGER, Types.SMALLINT, Types.TINYINT, Types.BOOLEAN, Types.BIT -> "INTEGER";
            case Types.DECIMAL, Types.NUMERIC, Types.DOUBLE, Types.FLOAT -> "REAL";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> "BLOB";
            default -> "TEXT";
        };
    }
}
