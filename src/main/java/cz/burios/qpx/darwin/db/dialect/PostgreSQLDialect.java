package cz.burios.qpx.darwin.db.dialect;

import java.sql.Types;
import java.util.Locale;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** PostgreSQL dialect: JDBC schema is the SQL namespace; catalog is the database. */
public class PostgreSQLDialect implements DBDialect {
    @Override public String name() { return "postgresql"; }

    @Override public String tableName(TableMetaData table) {
        if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name);
        return quote(table.name);
    }

    @Override public String quote(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*"))
            throw new IllegalArgumentException("Invalid SQL identifier: " + name);
        return "\"" + name + "\"";
    }

    @Override public String tableOptions(TableMetaData table) {
        if (table.params.isEmpty()) return "";
        StringBuilder sql = new StringBuilder();
        for (var entry : table.params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank())
                throw new IllegalArgumentException("Table option name must not be blank");
            if (entry.getValue() == null) continue;
            if (sql.length() > 0) sql.append(' ');
            String key = entry.getKey().trim().toUpperCase(Locale.ROOT);
            if ("TABLESPACE".equals(key)) sql.append("TABLESPACE ").append(entry.getValue());
            else if ("WITH".equals(key)) sql.append("WITH ").append(entry.getValue());
            else sql.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return sql.length() == 0 ? "" : " " + sql;
    }

    @Override public String columnDefinition(ColumnMetaData c) {
        StringBuilder sql = new StringBuilder(columnName(c.name)).append(' ').append(type(c));
        if (!c.nullable) sql.append(" NOT NULL");
        if (c.defaultValue != null) sql.append(" DEFAULT ").append(c.defaultValue);
        return sql.toString();
    }

    private String type(ColumnMetaData c) {
        if (c.type != null && !c.type.isBlank()) return c.type.trim();
        if (c.autoIncrement) {
            if (c.jdbcType == Types.BIGINT) return "BIGSERIAL";
            if (c.jdbcType == Types.INTEGER) return "SERIAL";
            if (c.jdbcType == Types.SMALLINT) return "SMALLSERIAL";
        }
        return switch (c.jdbcType) {
            case Types.BIGINT -> "BIGINT";
            case Types.INTEGER -> "INTEGER";
            case Types.SMALLINT -> "SMALLINT";
            case Types.TINYINT -> "SMALLINT";
            case Types.DECIMAL, Types.NUMERIC -> c.precision > 0 ? "NUMERIC(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "NUMERIC";
            case Types.DOUBLE -> "DOUBLE PRECISION";
            case Types.FLOAT -> "REAL";
            case Types.BOOLEAN, Types.BIT -> "BOOLEAN";
            case Types.DATE -> "DATE";
            case Types.TIMESTAMP -> "TIMESTAMP";
            case Types.TIME -> "TIME";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> "BYTEA";
            case Types.CHAR -> c.length > 0 ? "CHAR(" + c.length + ")" : "CHAR";
            case Types.VARCHAR -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR";
            case Types.LONGVARCHAR -> "TEXT";
            default -> "TEXT";
        };
    }
}
