package cz.burios.qpx.darwin.db.metadata;

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
    public final List<ColumnMetaData> columns = new ArrayList<>();

    /**
     * Desired database-specific table options used when creating or altering a table.
     * These are part of the table definition and may be supplied by an administrator
     * or by an application-specific table-definition service.
     */
    public final Map<String, Object> params = new LinkedHashMap<>();

    /**
     * Options actually discovered in the database by the dialect.
     * Kept separate from {@link #params}: params describe the desired state,
     * while actualParams describe the observed state.
     */
    public final Map<String, Object> actualParams = new LinkedHashMap<>();

    public TableMetaData() {}
    public TableMetaData(String name) { this.name = name; this.label = name; }
    public TableMetaData(String name, List<ColumnMetaData> columns) { this(name); if (columns != null) this.columns.addAll(columns); }

    public TableMetaData database(String value) { this.database = value; return this; }
    public TableMetaData schema(String value) { this.schema = value; return this; }
    public TableMetaData name(String value) { this.name = value; return this; }
    public TableMetaData label(String value) { this.label = value; return this; }

    /** Adds or replaces a desired table option. */
    public TableMetaData param(String name, Object value) { params.put(name, value); return this; }
    public TableMetaData params(Map<String, Object> values) { if (values != null) params.putAll(values); return this; }
    public TableMetaData removeParam(String name) { params.remove(name); return this; }

    /** Adds or replaces an option observed in the actual database. Intended for dialects. */
    public TableMetaData actualParam(String name, Object value) { actualParams.put(name, value); return this; }

    public TableMetaData addColumn(ColumnMetaData column) { columns.add(column); return this; }
    public ColumnMetaData column(String columnName) {
        for (ColumnMetaData c : columns) if (c.name != null && c.name.equalsIgnoreCase(columnName)) return c;
        return null;
    }
    public ColumnMetaData primaryKey() {
        for (ColumnMetaData c : columns) if (c.primaryKey) return c;
        return null;
    }
    public String qualifiedName() {
        if (database != null && !database.isBlank()) return database + "." + name;
        if (schema != null && !schema.isBlank()) return schema + "." + name;
        return name;
    }
}
