package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

/** Runtime DDL facade. All database-specific SQL is delegated to the dialect. */
public class DBSchemaManager {
    private final DBDialect dialect;
    public DBSchemaManager(DBDialect dialect) { if (dialect == null) throw new IllegalArgumentException("dialect must not be null"); this.dialect = dialect; }
    public DBDialect dialect() { return dialect; }

    public void createTable(Connection connection, TableMetaData table) throws SQLException {
        execute(connection, createTableSql(table));
        for (IndexMetaData index : table.indexes) createIndex(connection, table, index);
    }

    public void addColumn(Connection c, TableMetaData t, ColumnMetaData col) throws SQLException { require(t); require(col); execute(c, addColumnSql(t, col)); }
    public void dropColumn(Connection c, TableMetaData t, String col) throws SQLException { require(t); execute(c, dropColumnSql(t, col)); }
    public void dropTable(Connection c, TableMetaData t) throws SQLException { require(t); execute(c, dropTableSql(t)); }
    public void alterColumn(Connection c, TableMetaData t, ColumnMetaData col) throws SQLException {
        require(t); require(col);
        for (String sql : dialect.alterColumnStatements(t, col)) if (sql != null && !sql.isBlank()) execute(c, sql);
    }
    public void alterTableParams(Connection c, TableMetaData t) throws SQLException { require(t); String sql = dialect.alterTableOptions(t); if (sql != null && !sql.isBlank()) execute(c, sql); }
    public void createIndex(Connection c, TableMetaData t, IndexMetaData index) throws SQLException { require(t); execute(c, createIndexSql(t, index)); }
    public void dropIndex(Connection c, TableMetaData t, String name) throws SQLException { require(t); execute(c, dropIndexSql(t, name)); }

    /** Renders one change exactly as this manager would execute it. */
    public String sql(SchemaChange change) {
        if (change == null) throw new IllegalArgumentException("change must not be null");
        return switch (change.type()) {
            case CREATE_TABLE -> createTableSql(change.table());
            case DROP_TABLE -> dropTableSql(change.table());
            case ADD_COLUMN -> addColumnSql(change.table(), change.column());
            case ALTER_COLUMN -> joinAlterColumnSql(change.table(), change.column());
            case DROP_COLUMN -> dropColumnSql(change.table(), change.columnName());
            case ALTER_TABLE_PARAMS -> dialect.alterTableOptions(change.table());
            case CREATE_INDEX -> createIndexSql(change.table(), change.index());
            case DROP_INDEX -> dropIndexSql(change.table(), change.indexName());
        };
    }

    private String createTableSql(TableMetaData table) {
        require(table);
        StringBuilder sql = new StringBuilder("CREATE TABLE ").append(dialect.tableName(table)).append(" (");
        for (int i = 0; i < table.columns.size(); i++) { if (i > 0) sql.append(", "); sql.append(dialect.columnDefinition(table.columns.get(i))); }
        appendPrimaryKey(sql, table);
        return sql.append(')').append(dialect.tableOptions(table)).toString();
    }

    private String addColumnSql(TableMetaData table, ColumnMetaData column) { require(table); require(column); return "ALTER TABLE " + dialect.tableName(table) + " ADD COLUMN " + dialect.columnDefinition(column); }
    private String dropColumnSql(TableMetaData table, String column) { require(table); if (column == null || column.isBlank()) throw new IllegalArgumentException("column name is required"); return "ALTER TABLE " + dialect.tableName(table) + " DROP COLUMN " + dialect.columnName(column); }
    private String dropTableSql(TableMetaData table) { require(table); return "DROP TABLE " + dialect.tableName(table); }
    private String createIndexSql(TableMetaData table, IndexMetaData index) { require(table); if (index == null) throw new IllegalArgumentException("index is required"); return dialect.createIndex(table, index); }
    private String dropIndexSql(TableMetaData table, String name) { require(table); if (name == null || name.isBlank()) throw new IllegalArgumentException("index name is required"); return dialect.dropIndex(table, name); }

    private String joinAlterColumnSql(TableMetaData table, ColumnMetaData column) {
        require(table); require(column);
        StringBuilder result = new StringBuilder();
        for (String sql : dialect.alterColumnStatements(table, column)) {
            if (sql == null || sql.isBlank()) continue;
            if (result.length() > 0) result.append("; ");
            result.append(sql);
        }
        return result.toString();
    }

    private void appendPrimaryKey(StringBuilder sql, TableMetaData t) {
        boolean first = true;
        for (ColumnMetaData c : t.columns) if (c.primaryKey) {
            if (first) { sql.append(", PRIMARY KEY ("); first = false; } else sql.append(", ");
            sql.append(dialect.columnName(c.name));
        }
        if (!first) sql.append(')');
    }

    private void execute(Connection c, String sql) throws SQLException { if (c == null) throw new IllegalArgumentException("connection must not be null"); try (Statement s = c.createStatement()) { s.executeUpdate(sql); } }
    private static void require(TableMetaData t) { if (t == null || t.name == null || t.name.isBlank()) throw new IllegalArgumentException("table is required"); }
    private static void require(ColumnMetaData c) { if (c == null || c.name == null || c.name.isBlank()) throw new IllegalArgumentException("column is required"); }
}
