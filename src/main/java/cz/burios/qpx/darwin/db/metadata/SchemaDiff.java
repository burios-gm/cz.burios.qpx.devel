package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Compares desired table metadata with runtime database metadata. */
public final class SchemaDiff {
    private final List<SchemaChange> changes;
    private SchemaDiff(List<SchemaChange> changes) { this.changes = List.copyOf(changes); }
    public static SchemaDiff compare(DBMetaData actual, DBMetaData desired) { return compare(actual, desired, false); }
    public static SchemaDiff compare(DBMetaData actual, DBMetaData desired, boolean includeDrops) {
        if (actual == null) throw new IllegalArgumentException("actual metadata must not be null");
        if (desired == null) throw new IllegalArgumentException("desired metadata must not be null");
        List<SchemaChange> result = new ArrayList<>();
        Map<String, TableMetaData> actualTables = indexTables(actual.tables);
        Map<String, TableMetaData> desiredTables = indexTables(desired.tables);
        for (TableMetaData wanted : desired.tables.values()) {
            TableMetaData existing = actualTables.get(key(wanted.name));
            if (existing == null) { result.add(SchemaChange.createTable(wanted)); continue; }
            diffColumns(result, existing, wanted, includeDrops);
            if (!sameParams(existing, wanted)) result.add(SchemaChange.alterTableParams(wanted));
        }
        if (includeDrops) for (TableMetaData existing : actual.tables.values())
            if (!desiredTables.containsKey(key(existing.name))) result.add(SchemaChange.dropTable(existing));
        return new SchemaDiff(result);
    }
    public List<SchemaChange> changes() { return Collections.unmodifiableList(changes); }
    public boolean isEmpty() { return changes.isEmpty(); }
    public int size() { return changes.size(); }
    public void apply(Connection connection, DBSchemaManager manager) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        if (manager == null) throw new IllegalArgumentException("manager must not be null");
        for (SchemaChange change : changes) switch (change.type()) {
            case CREATE_TABLE -> manager.createTable(connection, change.table());
            case ADD_COLUMN -> manager.addColumn(connection, change.table(), change.column());
            case ALTER_COLUMN -> manager.alterColumn(connection, change.table(), change.column());
            case DROP_COLUMN -> manager.dropColumn(connection, change.table(), change.columnName());
            case ALTER_TABLE_PARAMS -> manager.alterTableParams(connection, change.table());
            case DROP_TABLE -> manager.dropTable(connection, change.table());
        }
    }
    private static void diffColumns(List<SchemaChange> result, TableMetaData actual, TableMetaData desired, boolean includeDrops) {
        Map<String, ColumnMetaData> actualColumns = indexColumns(actual.columns);
        Map<String, ColumnMetaData> desiredColumns = indexColumns(desired.columns);
        for (ColumnMetaData wanted : desired.columns) {
            ColumnMetaData existing = actualColumns.get(key(wanted.name));
            if (existing == null) result.add(SchemaChange.addColumn(desired, wanted));
            else if (!sameColumn(existing, wanted)) result.add(SchemaChange.alterColumn(desired, wanted));
        }
        if (includeDrops) for (ColumnMetaData existing : actual.columns)
            if (!desiredColumns.containsKey(key(existing.name))) result.add(SchemaChange.dropColumn(desired, existing.name));
    }
    /** Compares properties explicitly represented by the desired metadata. */
    private static boolean sameColumn(ColumnMetaData actual, ColumnMetaData desired) {
        if (desired.logicalType != null && desired.logicalType != actual.logicalType) return false;
        if (desired.type != null && !desired.type.isBlank() && !equalIgnoreCase(actual.type, desired.type)) return false;
        if (desired.jdbcType != 0 && actual.jdbcType != desired.jdbcType) return false;
        if (desired.jdbcTypeName != null && !desired.jdbcTypeName.isBlank() && !equalIgnoreCase(actual.jdbcTypeName, desired.jdbcTypeName)) return false;
        if (desired.length > 0 && actual.length != desired.length) return false;
        if (desired.precision > 0 && actual.precision != desired.precision) return false;
        if (desired.scale != 0 && actual.scale != desired.scale) return false;
        if (actual.nullable != desired.nullable) return false;
        if (desired.autoIncrement && !actual.autoIncrement) return false;
        if (desired.primaryKey && !actual.primaryKey) return false;
        if (desired.defaultValue != null && !equal(actual.defaultValue, desired.defaultValue)) return false;
        ColumnGeneration desiredGeneration = desired.generation == null ? ColumnGeneration.NONE : desired.generation;
        ColumnGeneration actualGeneration = actual.generation == null ? ColumnGeneration.NONE : actual.generation;
        return desiredGeneration == actualGeneration;
    }
    private static boolean sameParams(TableMetaData actual, TableMetaData desired) {
        if (desired.params.isEmpty()) return true;
        for (Map.Entry<String, Object> wanted : desired.params.entrySet()) {
            Object actualValue = findParam(actual.actualParams, wanted.getKey());
            if (actualValue == null && wanted.getValue() != null) return false;
            if (wanted.getValue() != null && !String.valueOf(wanted.getValue()).equalsIgnoreCase(String.valueOf(actualValue))) return false;
        }
        return true;
    }
    private static Object findParam(Map<String, Object> params, String name) {
        for (Map.Entry<String, Object> entry : params.entrySet()) if (entry.getKey().equalsIgnoreCase(name)) return entry.getValue();
        return null;
    }
    private static Map<String, TableMetaData> indexTables(Map<String, TableMetaData> source) {
        Map<String, TableMetaData> result = new LinkedHashMap<>();
        for (TableMetaData table : source.values()) result.put(key(table.name), table);
        return result;
    }
    private static Map<String, ColumnMetaData> indexColumns(List<ColumnMetaData> source) {
        Map<String, ColumnMetaData> result = new LinkedHashMap<>();
        for (ColumnMetaData column : source) result.put(key(column.name), column);
        return result;
    }
    private static String key(String value) { return value == null ? "" : value.toLowerCase(Locale.ROOT); }
    private static boolean equal(String a, String b) { return a == null ? b == null : a.equals(b); }
    private static boolean equalIgnoreCase(String a, String b) { return a == null ? b == null : a.equalsIgnoreCase(b); }
    @Override public String toString() { return changes.toString(); }
}
