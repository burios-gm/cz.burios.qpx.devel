package cz.burios.uniql.dialect;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

import cz.burios.uniql.metadata.ColumnMetaData;
import cz.burios.uniql.metadata.ColumnType;
import cz.burios.uniql.metadata.IndexMetaData;
import cz.burios.uniql.metadata.TableMetaData;

/** Database-specific SQL and JDBC metadata conventions. */
public interface DBDialect {
    String name();
    /** Whether the database can reliably roll back the DDL emitted by the schema manager. */
    default boolean supportsTransactionalDdl() { return true; }
    default String catalog(Connection connection) throws SQLException { return connection.getCatalog(); }
    default String schema(Connection connection) throws SQLException { return connection.getSchema(); }
    default void loadTableOptions(Connection connection, String catalog, String schema, TableMetaData table) throws SQLException {}
    default void loadColumnOptions(Connection connection, String catalog, String schema, String tableName, ColumnMetaData column) throws SQLException {}
    /** Loads database-specific index attributes not exposed portably by JDBC. */
    default void loadIndexOptions(Connection connection, String catalog, String schema, String tableName, IndexMetaData index) throws SQLException {}
    default ColumnType logicalType(ColumnMetaData column) { if (column == null) return null; return switch (column.jdbcType) { case java.sql.Types.BOOLEAN, java.sql.Types.BIT -> ColumnType.BOOLEAN; case java.sql.Types.BIGINT -> ColumnType.LONG; case java.sql.Types.INTEGER, java.sql.Types.SMALLINT, java.sql.Types.TINYINT -> ColumnType.INTEGER; case java.sql.Types.DECIMAL, java.sql.Types.NUMERIC -> ColumnType.DECIMAL; case java.sql.Types.DOUBLE, java.sql.Types.FLOAT -> ColumnType.DOUBLE; case java.sql.Types.DATE -> ColumnType.DATE; case java.sql.Types.TIMESTAMP -> ColumnType.TIMESTAMP; case java.sql.Types.TIME -> ColumnType.TIME; case java.sql.Types.BINARY, java.sql.Types.VARBINARY, java.sql.Types.LONGVARBINARY -> ColumnType.BINARY; case java.sql.Types.LONGVARCHAR -> ColumnType.TEXT; default -> ColumnType.STRING; }; }
    default String tableName(TableMetaData table) { if (table.schema != null && !table.schema.isBlank()) return quote(table.schema) + "." + quote(table.name); if (table.database != null && !table.database.isBlank()) return quote(table.database) + "." + quote(table.name); return quote(table.name); }
    /** Renders a table name from JDBC catalog/schema values using this dialect's namespace semantics. */
    default String tableName(String catalog, String schema, String tableName) {
        TableMetaData table = new TableMetaData(tableName);
        if (schema != null && !schema.isBlank()) table.schema(schema);
        if (catalog != null && !catalog.isBlank()) table.database(catalog);
        return tableName(table);
    }
    default String tableOptions(TableMetaData table) { if (table.params.isEmpty()) return ""; StringBuilder sql = new StringBuilder(); for (var entry : table.params.entrySet()) { if (entry.getKey() == null || entry.getKey().isBlank()) throw new IllegalArgumentException("Table option name must not be blank"); if (entry.getValue() == null) continue; if (sql.length() > 0) sql.append(' '); sql.append(entry.getKey()).append('=').append(entry.getValue()); } return sql.length() == 0 ? "" : " " + sql; }
    default String alterTableOptions(TableMetaData table) { throw new UnsupportedOperationException("Table option alteration is not supported by dialect: " + name()); }
    /** Renders a primary-key constraint using the name stored in table metadata. */
    default String addPrimaryKey(TableMetaData table) {
        String name = table.primaryKeyName;
        StringBuilder sql = new StringBuilder("ALTER TABLE ").append(tableName(table)).append(" ADD ");
        if (name != null && !name.isBlank()) sql.append("CONSTRAINT ").append(quote(name)).append(' ');
        sql.append("PRIMARY KEY (");
        boolean first = true;
        for (ColumnMetaData column : table.columns) if (column.primaryKey) {
            if (!first) sql.append(", ");
            sql.append(columnName(column.name));
            first = false;
        }
        if (first) throw new IllegalArgumentException("table has no primary-key columns");
        return sql.append(')').toString();
    }
    /** Renders dropping the existing primary-key constraint. */
    default String dropPrimaryKey(TableMetaData table) {
        String name = table.primaryKeyName;
        if (name == null || name.isBlank()) throw new IllegalArgumentException("primary-key constraint name is required");
        return "ALTER TABLE " + tableName(table) + " DROP CONSTRAINT " + quote(name);
    }

    default String alterColumn(TableMetaData table, ColumnMetaData column) { throw new UnsupportedOperationException("Column alteration is not supported by dialect: " + name()); }
    default List<String> alterColumnStatements(TableMetaData table, ColumnMetaData column) { return List.of(alterColumn(table, column)); }
    default String createIndex(TableMetaData table, IndexMetaData index) { if (index == null || index.name == null || index.name.isBlank()) throw new IllegalArgumentException("index is required"); if (index.columns.isEmpty()) throw new IllegalArgumentException("index must contain at least one column"); StringBuilder sql = new StringBuilder("CREATE "); if (index.unique) sql.append("UNIQUE "); sql.append("INDEX ").append(indexName(index.name)).append(" ON ").append(tableName(table)).append(" ("); for (int i = 0; i < index.columns.size(); i++) { if (i > 0) sql.append(", "); sql.append(columnName(index.columns.get(i))); } return sql.append(')').toString(); }
    default String dropIndex(TableMetaData table, String indexName) { return "DROP INDEX " + indexName(indexName); }
    default String indexName(String name) { return quote(name); }
    default String columnName(String name) { return quote(name); }
    default String quote(String name) { if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid SQL identifier: " + name); return "`" + name + "`"; }
    default String columnGeneration(ColumnMetaData column) { return ""; }
    String columnDefinition(ColumnMetaData column);
}
