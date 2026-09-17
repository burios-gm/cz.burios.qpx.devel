package cz.burios.uniql.metadata;

import java.util.Objects;

/** One executable database schema change produced by {@link SchemaDiff}. */
public final class SchemaChange {
    public enum Type {
        CREATE_TABLE,
        DROP_TABLE,
        ADD_COLUMN,
        ALTER_COLUMN,
        DROP_COLUMN,
        ALTER_TABLE_PARAMS,
        CREATE_INDEX,
        DROP_INDEX
    }

    private final Type type;
    private final TableMetaData table;
    private final ColumnMetaData column;
    private final String columnName;
    private final IndexMetaData index;
    private final String indexName;

    private SchemaChange(Type type, TableMetaData table, ColumnMetaData column, String columnName,
            IndexMetaData index, String indexName) {
        this.type = Objects.requireNonNull(type, "type");
        this.table = table;
        this.column = column;
        this.columnName = columnName;
        this.index = index;
        this.indexName = indexName;
    }

    public static SchemaChange createTable(TableMetaData table) { return new SchemaChange(Type.CREATE_TABLE, table, null, null, null, null); }
    public static SchemaChange dropTable(TableMetaData table) { return new SchemaChange(Type.DROP_TABLE, table, null, null, null, null); }
    public static SchemaChange addColumn(TableMetaData table, ColumnMetaData column) { return new SchemaChange(Type.ADD_COLUMN, table, column, null, null, null); }
    public static SchemaChange alterColumn(TableMetaData table, ColumnMetaData column) { return new SchemaChange(Type.ALTER_COLUMN, table, column, null, null, null); }
    public static SchemaChange dropColumn(TableMetaData table, String columnName) { return new SchemaChange(Type.DROP_COLUMN, table, null, columnName, null, null); }
    public static SchemaChange alterTableParams(TableMetaData table) { return new SchemaChange(Type.ALTER_TABLE_PARAMS, table, null, null, null, null); }
    public static SchemaChange createIndex(TableMetaData table, IndexMetaData index) { return new SchemaChange(Type.CREATE_INDEX, table, null, null, index, null); }
    public static SchemaChange dropIndex(TableMetaData table, String indexName) { return new SchemaChange(Type.DROP_INDEX, table, null, null, null, indexName); }

    public Type type() { return type; }
    public TableMetaData table() { return table; }
    public ColumnMetaData column() { return column; }
    public String columnName() { return columnName; }
    public IndexMetaData index() { return index; }
    public String indexName() { return indexName; }

    /* JavaBean accessors are intentionally provided for Jackson serialization. */
    public Type getType() { return type; }
    public TableMetaData getTable() { return table; }
    public ColumnMetaData getColumn() { return column; }
    public String getColumnName() { return columnName; }
    public IndexMetaData getIndex() { return index; }
    public String getIndexName() { return indexName; }

    @Override public String toString() {
        return switch (type) {
            case CREATE_TABLE -> "CREATE_TABLE " + table.name;
            case DROP_TABLE -> "DROP_TABLE " + table.name;
            case ADD_COLUMN -> "ADD_COLUMN " + table.name + "." + column.name;
            case ALTER_COLUMN -> "ALTER_COLUMN " + table.name + "." + column.name;
            case DROP_COLUMN -> "DROP_COLUMN " + table.name + "." + columnName;
            case ALTER_TABLE_PARAMS -> "ALTER_TABLE_PARAMS " + table.name;
            case CREATE_INDEX -> "CREATE_INDEX " + table.name + "." + index.name;
            case DROP_INDEX -> "DROP_INDEX " + table.name + "." + indexName;
        };
    }
}
