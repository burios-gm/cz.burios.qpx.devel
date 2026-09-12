package cz.burios.qpx.darwin.db.dialect;

import java.sql.Types;
import java.util.Locale;

import cz.burios.qpx.darwin.db.metadata.ColumnGeneration;
import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.ColumnType;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** PostgreSQL dialect: JDBC schema is the SQL namespace; catalog is the database. */
public class PostgreSQLDialect implements DBDialect {
    @Override public String name() { return "postgresql"; }
    @Override public String tableName(TableMetaData table) {
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        return quote(table.name);
    }
    @Override public String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "\"" + name + "\"";
    }
    @Override public String tableOptions(TableMetaData table) {
        if (table.params.isEmpty()) return "";
        StringBuilder sql = new StringBuilder();
        for (var entry : table.params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank()) throw new IllegalArgumentException("Table option name must not be blank");
            if (entry.getValue() == null) continue;
            if (sql.length() > 0) sql.append(' ');
            String key = entry.getKey().trim().toUpperCase(Locale.ROOT);
            if ("TABLESPACE".equals(key)) sql.append("TABLESPACE ").append(entry.getValue());
            else if ("WITH".equals(key)) sql.append("WITH ").append(entry.getValue());
            else sql.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return sql.length() == 0 ? "" : " " + sql;
    }
    @Override public ColumnType logicalType(ColumnMetaData c) {
        String nativeType = c.jdbcTypeName != null ? c.jdbcTypeName : c.type;
        if (nativeType != null) {
            String t = nativeType.toUpperCase(Locale.ROOT);
            if (t.contains("CHAR") || t.startsWith("VARCHAR")) return ColumnType.STRING;
            if (t.equals("TEXT")) return ColumnType.TEXT;
            if (t.equals("BOOL") || t.equals("BOOLEAN")) return ColumnType.BOOLEAN;
            if (t.equals("BIGINT") || t.equals("BIGSERIAL")) return ColumnType.LONG;
            if (t.equals("INT") || t.equals("INTEGER") || t.equals("SERIAL") || t.equals("SMALLINT") || t.equals("SMALLSERIAL")) return ColumnType.INTEGER;
            if (t.startsWith("NUMERIC") || t.startsWith("DECIMAL")) return ColumnType.DECIMAL;
            if (t.contains("DOUBLE") || t.equals("REAL")) return ColumnType.DOUBLE;
            if (t.startsWith("TIMESTAMP")) return ColumnType.TIMESTAMP;
            if (t.startsWith("TIME")) return ColumnType.TIME;
            if (t.startsWith("DATE")) return ColumnType.DATE;
            if (t.equals("BYTEA")) return ColumnType.BINARY;
        }
        return DBDialect.super.logicalType(c);
    }
    @Override public String columnDefinition(ColumnMetaData c) {
        StringBuilder sql = new StringBuilder(columnName(c.name)).append(' ').append(type(c));
        if (!c.nullable) sql.append(" NOT NULL");
        String generation = columnGeneration(c);
        if (!generation.isBlank()) sql.append(' ').append(generation);
        else if (c.defaultValue != null) sql.append(" DEFAULT ").append(c.defaultValue);
        return sql.toString();
    }
    @Override public String columnGeneration(ColumnMetaData c) {
        return switch (c.generation == null ? ColumnGeneration.NONE : c.generation) {
            case NONE -> "";
            case INSERT_TIMESTAMP -> "DEFAULT CURRENT_TIMESTAMP";
            case INSERT_UPDATE_TIMESTAMP -> throw new UnsupportedOperationException(
                    "PostgreSQL does not support MySQL-style ON UPDATE CURRENT_TIMESTAMP; use a trigger or application lifecycle handling");
        };
    }
    @Override public String alterColumn(TableMetaData table, ColumnMetaData column) {
        StringBuilder sql = new StringBuilder("ALTER TABLE ").append(tableName(table))
                .append(" ALTER COLUMN ").append(columnName(column.name));
        sql.append(" TYPE ").append(type(column));
        if (column.nullable) sql.append(", ALTER COLUMN ").append(columnName(column.name)).append(" DROP NOT NULL");
        else sql.append(", ALTER COLUMN ").append(columnName(column.name)).append(" SET NOT NULL");
        if (column.generation == ColumnGeneration.INSERT_UPDATE_TIMESTAMP)
            throw new UnsupportedOperationException("PostgreSQL does not support MySQL-style ON UPDATE CURRENT_TIMESTAMP; use a trigger or application lifecycle handling");
        if (column.defaultValue != null || column.generation == ColumnGeneration.INSERT_TIMESTAMP) {
            sql.append(", ALTER COLUMN ").append(columnName(column.name)).append(" SET DEFAULT ");
            sql.append(column.generation == ColumnGeneration.INSERT_TIMESTAMP ? "CURRENT_TIMESTAMP" : column.defaultValue);
        } else {
            sql.append(", ALTER COLUMN ").append(columnName(column.name)).append(" DROP DEFAULT");
        }
        return sql.toString();
    }
    private String type(ColumnMetaData c) {
        if (c.logicalType != null) return switch (c.logicalType) {
            case STRING -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR(255)";
            case TEXT -> "TEXT";
            case BOOLEAN -> "BOOLEAN";
            case INTEGER -> c.autoIncrement ? "SERIAL" : "INTEGER";
            case LONG -> c.autoIncrement ? "BIGSERIAL" : "BIGINT";
            case DECIMAL -> c.precision > 0 ? "NUMERIC(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "NUMERIC";
            case DOUBLE -> "DOUBLE PRECISION";
            case DATE -> "DATE";
            case TIME -> "TIME";
            case DATETIME, TIMESTAMP -> "TIMESTAMP";
            case BINARY -> "BYTEA";
        };
        if (c.type != null && !c.type.isBlank()) return c.type.trim();
        if (c.autoIncrement) {
            if (c.jdbcType == Types.BIGINT) return "BIGSERIAL";
            if (c.jdbcType == Types.INTEGER) return "SERIAL";
            if (c.jdbcType == Types.SMALLINT) return "SMALLSERIAL";
        }
        return switch (c.jdbcType) {
            case Types.BIGINT -> "BIGINT"; case Types.INTEGER -> "INTEGER"; case Types.SMALLINT, Types.TINYINT -> "SMALLINT";
            case Types.DECIMAL, Types.NUMERIC -> c.precision > 0 ? "NUMERIC(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "NUMERIC";
            case Types.DOUBLE -> "DOUBLE PRECISION"; case Types.FLOAT -> "REAL"; case Types.BOOLEAN, Types.BIT -> "BOOLEAN";
            case Types.DATE -> "DATE"; case Types.TIMESTAMP -> "TIMESTAMP"; case Types.TIME -> "TIME";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> "BYTEA";
            case Types.CHAR -> c.length > 0 ? "CHAR(" + c.length + ")" : "CHAR"; case Types.VARCHAR -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR";
            case Types.LONGVARCHAR -> "TEXT"; default -> "TEXT";
        };
    }
}
