package cz.burios.qpx.darwin.db.metadata;

import java.util.Objects;

/** One executable database schema change produced by {@link SchemaDiff}. */
public final class SchemaChange {
    public enum Type {
        CREATE_TABLE,
        DROP_TABLE,
        ADD_COLUMN,
        ALTER_COLUMN,
        DROP_COLUMN
    }

    private final Type type;
    private final TableMetaData table;
    private final ColumnMetaData column;
    private final String columnName;

    private SchemaChange(Type type, TableMetaData table, ColumnMetaData column, String columnName) {
        this.type = Objects.requireNonNull(type, "type");
        this.table = table;
        this.column = column;
        this.columnName = columnName;
    }

    public static SchemaChange createTable(TableMetaData table) {
        return new SchemaChange(Type.CREATE_TABLE, table, null, null);
    }

    public static SchemaChange dropTable(TableMetaData table) {
        return new SchemaChange(Type.DROP_TABLE, table, null, null);
    }

    public static SchemaChange addColumn(TableMetaData table, ColumnMetaData column) {
        return new SchemaChange(Type.ADD_COLUMN, table, column, null);
    }

    public static SchemaChange alterColumn(TableMetaData table, ColumnMetaData column) {
        return new SchemaChange(Type.ALTER_COLUMN, table, column, null);
    }

    public static SchemaChange dropColumn(TableMetaData table, String columnName) {
        return new SchemaChange(Type.DROP_COLUMN, table, null, columnName);
    }

    public Type type() { return type; }
    public TableMetaData table() { return table; }
    public ColumnMetaData column() { return column; }
    public String columnName() { return columnName; }

    @Override
    public String toString() {
        return switch (type) {
            case CREATE_TABLE -> "CREATE_TABLE " + table.name;
            case DROP_TABLE -> "DROP_TABLE " + table.name;
            case ADD_COLUMN -> "ADD_COLUMN " + table.name + "." + column.name;
            case ALTER_COLUMN -> "ALTER_COLUMN " + table.name + "." + column.name;
            case DROP_COLUMN -> "DROP_COLUMN " + table.name + "." + columnName;
        };
    }
}
