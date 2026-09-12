package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
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
        String sql = "SELECT ENGINE, TABLE_COLLATION, TABLE_COMMENT "
                + "FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, catalog);
            ps.setString(2, table.name);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return;
                String engine = rs.getString("ENGINE");
                String collation = rs.getString("TABLE_COLLATION");
                String comment = rs.getString("TABLE_COMMENT");
                if (engine != null) table.param("ENGINE", engine);
                if (collation != null) {
                    int separator = collation.indexOf('_');
                    String charset = separator > 0 ? collation.substring(0, separator) : null;
                    if (charset != null && !charset.isBlank()) table.param("DEFAULT CHARSET", charset);
                    table.param("COLLATE", collation);
                }
                if (comment != null && !comment.isBlank()) table.param("COMMENT", "'" + comment.replace("'", "''") + "'");
            }
        }
    }
    @Override public String columnDefinition(ColumnMetaData c) {
        StringBuilder sql = new StringBuilder(columnName(c.name)).append(' ').append(type(c));
        if (c.autoIncrement) sql.append(" AUTO_INCREMENT");
        if (!c.nullable) sql.append(" NOT NULL");
        if (c.defaultValue != null) sql.append(" DEFAULT ").append(c.defaultValue);
        return sql.toString();
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
    private String type(ColumnMetaData c) {
        if (c.type != null && !c.type.isBlank()) {
            String t = c.type.trim();
            if (t.matches("[A-Za-z][A-Za-z0-9_]*(\\s*\\(\\s*[0-9]+(?:\\s*,\\s*[0-9]+)?\\s*\\))?")) return t;
        }
        return switch (c.jdbcType) {
            case java.sql.Types.BIGINT -> "BIGINT";
            case java.sql.Types.INTEGER -> "INT";
            case java.sql.Types.SMALLINT -> "SMALLINT";
            case java.sql.Types.TINYINT -> "TINYINT";
            case java.sql.Types.DECIMAL, java.sql.Types.NUMERIC -> c.precision > 0 ? "DECIMAL(" + c.precision + "," + Math.max(c.scale, 0) + ")" : "DECIMAL";
            case java.sql.Types.DOUBLE -> "DOUBLE";
            case java.sql.Types.FLOAT -> "FLOAT";
            case java.sql.Types.BOOLEAN, java.sql.Types.BIT -> "BOOLEAN";
            case java.sql.Types.DATE -> "DATE";
            case java.sql.Types.TIMESTAMP -> "TIMESTAMP";
            case java.sql.Types.TIME -> "TIME";
            case java.sql.Types.BINARY, java.sql.Types.VARBINARY, java.sql.Types.LONGVARBINARY -> c.length > 0 ? "VARBINARY(" + c.length + ")" : "BLOB";
            case java.sql.Types.CHAR -> c.length > 0 ? "CHAR(" + c.length + ")" : "CHAR";
            case java.sql.Types.VARCHAR -> c.length > 0 ? "VARCHAR(" + c.length + ")" : "VARCHAR(255)";
            case java.sql.Types.LONGVARCHAR -> "TEXT";
            default -> "TEXT";
        };
    }
}
