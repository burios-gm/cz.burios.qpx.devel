package cz.burios.uniql.model;

import cz.burios.uniql.metadata.TableMetaData;

/** Runtime record whose table definition comes from DB metadata rather than a Java POJO. */
public class DynamicRecord extends BasicRecord {
    private transient TableMetaData tableMetaData;

    public DynamicRecord() {}

    public DynamicRecord(TableMetaData tableMetaData) {
        this.tableMetaData = tableMetaData;
    }

    public TableMetaData getTableMetaData() { return tableMetaData; }
    public void setTableMetaData(TableMetaData tableMetaData) { this.tableMetaData = tableMetaData; }

    /** Stores values under the physical metadata column name, case-insensitively. */
    @Override public Object put(String key, Object value) {
        String canonical = canonicalColumnName(key);
        return super.put(canonical, value);
    }

    /** Reads values using case-insensitive metadata column names. */
    @Override public Object get(Object key) {
        if (key instanceof String name) {
            String canonical = canonicalColumnName(name);
            Object value = super.get(canonical);
            if (value != null || super.containsKey(canonical)) return value;
        }
        return super.get(key);
    }

    private String canonicalColumnName(String name) {
        if (name == null || tableMetaData == null) return name;
        var column = tableMetaData.column(name);
        return column == null ? name : column.name;
    }
}
