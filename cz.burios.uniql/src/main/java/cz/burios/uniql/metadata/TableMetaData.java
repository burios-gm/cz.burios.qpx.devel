package cz.burios.uniql.metadata;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Metadata of one database table; mutable so runtime-defined tables can evolve. */
public class TableMetaData {
    public String database;
    public String schema;
    public String name;
    public String label;
    /** Database constraint name of the primary key, when known. */
    public String primaryKeyName;
    public final List<ColumnMetaData> columns = new ArrayList<>();
    /** Non-primary indexes belonging to this table. */
    public final List<IndexMetaData> indexes = new ArrayList<>();

    /** Desired database-specific table options. */
    public final Map<String, Object> params = new LinkedHashMap<>();
    /** Options actually discovered in the database by the dialect. */
    public final Map<String, Object> actualParams = new LinkedHashMap<>();

    public TableMetaData() {}
    public TableMetaData(String name) { this.name = name; this.label = name; }
    public TableMetaData(String name, List<ColumnMetaData> columns) { this(name); if (columns != null) this.columns.addAll(columns); }

    public TableMetaData database(String value) { this.database = value; return this; }
    public TableMetaData schema(String value) { this.schema = value; return this; }
    public TableMetaData name(String value) { this.name = value; return this; }
    public TableMetaData label(String value) { this.label = value; return this; }
    public TableMetaData primaryKeyName(String value) { this.primaryKeyName = value; return this; }
    public TableMetaData param(String name, Object value) { params.put(name, value); return this; }
    public TableMetaData params(Map<String, Object> values) { if (values != null) params.putAll(values); return this; }
    public TableMetaData removeParam(String name) { params.remove(name); return this; }
    public TableMetaData actualParam(String name, Object value) { actualParams.put(name, value); return this; }

    public TableMetaData addColumn(ColumnMetaData column) { columns.add(column); return this; }
    public TableMetaData addIndex(IndexMetaData index) { indexes.add(index); return this; }
    public ColumnMetaData column(String columnName) {
        for (ColumnMetaData c : columns) if (c.name != null && c.name.equalsIgnoreCase(columnName)) return c;
        return null;
    }
    public IndexMetaData index(String indexName) {
        for (IndexMetaData i : indexes) if (i.name != null && i.name.equalsIgnoreCase(indexName)) return i;
        return null;
    }
    public ColumnMetaData primaryKey() {
        for (ColumnMetaData c : columns) if (c.primaryKey) return c;
        return null;
    }

    /** Returns all primary-key columns in their JDBC KEY_SEQ order when known. */
    public List<ColumnMetaData> primaryKeys() {
        List<ColumnMetaData> result = new ArrayList<>();
        for (ColumnMetaData c : columns) if (c.primaryKey) result.add(c);
        boolean hasPositions = result.stream().anyMatch(c -> c.primaryKeyPosition > 0);
        if (hasPositions) result.sort(java.util.Comparator.comparingInt(c -> c.primaryKeyPosition));
        return result;
    }
    public String qualifiedName() {
        // SQL dialects treat JDBC catalog and schema differently. For a connection-local
        // table reference the schema is the first SQL namespace; use the catalog only
        // when no schema is available (e.g. MySQL databases).
        if (schema != null && !schema.isBlank()) return schema + "." + name;
        if (database != null && !database.isBlank()) return database + "." + name;
        return name;
    }
}
