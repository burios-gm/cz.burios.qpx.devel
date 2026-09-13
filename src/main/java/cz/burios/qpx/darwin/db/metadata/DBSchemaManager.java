package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.MySQLDialect;

/** Runtime DDL facade. The dialect owns database-specific SQL details. */
public class DBSchemaManager {
    private final DBDialect dialect;

    public DBSchemaManager(DBDialect dialect) {
        if (dialect == null) throw new IllegalArgumentException("dialect must not be null");
        this.dialect = dialect;
    }
    public DBDialect dialect() { return dialect; }

    public void createTable(Connection connection, TableMetaData table) throws SQLException {
        require(table);
        StringBuilder sql = new StringBuilder("CREATE TABLE ").append(dialect.tableName(table)).append(" (");
        for (int i = 0; i < table.columns.size(); i++) {
            if (i > 0) sql.append(", ");
            sql.append(dialect.columnDefinition(table.columns.get(i)));
        }
        appendPrimaryKey(sql, table);
        sql.append(')').append(dialect.tableOptions(table));
        execute(connection, sql.toString());
        for (IndexMetaData index : table.indexes) createIndex(connection, table, index);
    }
    public void addColumn(Connection connection, TableMetaData table, ColumnMetaData column) throws SQLException {
        require(table);
        if (column == null || column.name == null || column.name.isBlank()) throw new IllegalArgumentException("column is required");
        execute(connection, "ALTER TABLE " + dialect.tableName(table) + " ADD COLUMN " + dialect.columnDefinition(column));
    }
    public void dropColumn(Connection connection, TableMetaData table, String column) throws SQLException {
        require(table); execute(connection, "ALTER TABLE " + dialect.tableName(table) + " DROP COLUMN " + dialect.columnName(column));
    }
    public void dropTable(Connection connection, TableMetaData table) throws SQLException {
        require(table); execute(connection, "DROP TABLE " + dialect.tableName(table));
    }
    public void alterColumn(Connection connection, TableMetaData table, ColumnMetaData column) throws SQLException {
        require(table);
        if (column == null || column.name == null || column.name.isBlank()) throw new IllegalArgumentException("column is required");
        execute(connection, dialect.alterColumn(table, column));
    }
    public void alterTableParams(Connection connection, TableMetaData table) throws SQLException {
        require(table); String sql = dialect.alterTableOptions(table); if (sql != null && !sql.isBlank()) execute(connection, sql);
    }
    public void createIndex(Connection connection, TableMetaData table, IndexMetaData index) throws SQLException {
        require(table);
        if (index == null || index.name == null || index.name.isBlank()) throw new IllegalArgumentException("index is required");
        if (index.columns.isEmpty()) throw new IllegalArgumentException("index must contain at least one column");
        StringBuilder sql = new StringBuilder("CREATE ");
        if (index.unique) sql.append("UNIQUE ");
        sql.append("INDEX ").append(dialect.quote(index.name)).append(" ON ").append(dialect.tableName(table));
        if (index.method != null && !index.method.isBlank() && dialect instanceof cz.burios.qpx.darwin.db.dialect.PostgreSQLDialect)
            sql.append(" USING ").append(index.method);
        sql.append(" (");
        for (int i = 0; i < index.columns.size(); i++) {
            if (i > 0) sql.append(", ");
            sql.append(dialect.columnName(index.columns.get(i)));
        }
        sql.append(')');
        if (index.method != null && !index.method.isBlank() && dialect instanceof MySQLDialect) sql.append(" USING ").append(index.method);
        execute(connection, sql.toString());
    }
    public void dropIndex(Connection connection, TableMetaData table, String indexName) throws SQLException {
        require(table);
        if (indexName == null || indexName.isBlank()) throw new IllegalArgumentException("index name is required");
        String sql = "DROP INDEX " + dialect.quote(indexName);
        if (dialect instanceof MySQLDialect) sql += " ON " + dialect.tableName(table);
        execute(connection, sql);
    }
    private void appendPrimaryKey(StringBuilder sql, TableMetaData table) {
        boolean first = true;
        for (ColumnMetaData c : table.columns) {
            if (!c.primaryKey) continue;
            if (first) { sql.append(", PRIMARY KEY ("); first = false; } else sql.append(", ");
            sql.append(dialect.columnName(c.name));
        }
        if (!first) sql.append(')');
    }
    private void execute(Connection connection, String sql) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        try (Statement statement = connection.createStatement()) { statement.executeUpdate(sql); }
    }
    private static void require(TableMetaData table) {
        if (table == null || table.name == null || table.name.isBlank()) throw new IllegalArgumentException("table is required");
    }
}
