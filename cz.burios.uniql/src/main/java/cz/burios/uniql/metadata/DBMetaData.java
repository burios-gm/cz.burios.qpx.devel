package cz.burios.uniql.metadata;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import cz.burios.uniql.dialect.DBDialect;
import cz.burios.uniql.dialect.DBDialects;

/** Database metadata cache containing JDBC catalog/schema and discovered tables. */
public class DBMetaData {
    private static final ObjectMapper CANONICAL_JSON = new ObjectMapper()
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

    public String catalog;
    public String schema;
    public String databaseName;
    public String productName;
    public String productVersion;
    public String dialectName;
    public final Map<String, TableMetaData> tables = new LinkedHashMap<>();
    public DBMetaData() {}
    public DBMetaData(String databaseName) { this.catalog = databaseName; this.databaseName = databaseName; }
    public TableMetaData table(String name) { if (name == null) return null; TableMetaData table = tables.get(name.toLowerCase(Locale.ROOT)); if (table != null) return table; TableMetaData found = null; for (TableMetaData candidate : tables.values()) if (candidate.name != null && candidate.name.equalsIgnoreCase(name)) { if (found != null) return null; found = candidate; } return found; }
    public DBMetaData add(TableMetaData table) { if (table == null || table.name == null || table.name.isBlank()) throw new IllegalArgumentException("table is required"); tables.put(key(table), table); return this; }
    public DBMetaData remove(String name) { if (name == null) return this; String normalized = name.toLowerCase(Locale.ROOT); if (tables.remove(normalized) != null) return this; String found = null; for (Map.Entry<String, TableMetaData> entry : tables.entrySet()) if (key(entry.getValue()).equals(normalized)) { found = entry.getKey(); break; } if (found != null) tables.remove(found); return this; }
    private static String key(TableMetaData table) { StringBuilder key = new StringBuilder(); if (table.database != null && !table.database.isBlank()) key.append(table.database).append('.'); if (table.schema != null && !table.schema.isBlank()) key.append(table.schema).append('.'); key.append(table.name); return key.toString().toLowerCase(Locale.ROOT); }

    /** Returns a deterministic SHA-256 fingerprint of this metadata snapshot. */
    public String fingerprint() {
        try {
            byte[] bytes = CANONICAL_JSON.writeValueAsBytes(this);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder result = new StringBuilder(64);
            for (byte value : digest) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return result.toString();
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("Unable to calculate database metadata fingerprint", e);
        }
    }

    public static DBMetaData load(Connection connection) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        DatabaseMetaData db = connection.getMetaData(); DBDialect dialect = DBDialects.forConnection(connection); String catalog = dialect.catalog(connection), schema = dialect.schema(connection);
        DBMetaData result = new DBMetaData(); result.catalog = catalog; result.schema = schema; result.databaseName = catalog; result.productName = db.getDatabaseProductName(); result.productVersion = db.getDatabaseProductVersion(); result.dialectName = dialect.name();
        try (ResultSet tables = db.getTables(catalog, schema, "%", new String[] {"TABLE"})) {
            while (tables.next()) { String tableSchema = tables.getString("TABLE_SCHEM"), name = tables.getString("TABLE_NAME"); TableMetaData table = new TableMetaData(name).schema(tableSchema).database(catalog); loadColumns(db, connection, dialect, catalog, tableSchema, name, table); loadIndexes(db, connection, dialect, catalog, tableSchema, name, table); dialect.loadTableOptions(connection, catalog, tableSchema, table); result.add(table); }
        }
        return result;
    }
    private static void loadColumns(DatabaseMetaData db, Connection connection, DBDialect dialect, String catalog, String schema, String tableName, TableMetaData table) throws SQLException {
        Map<String, ColumnMetaData> columns = new LinkedHashMap<>();
        try (ResultSet rs = db.getColumns(catalog, schema, tableName, "%")) { while (rs.next()) { ColumnMetaData c = new ColumnMetaData(); c.name = rs.getString("COLUMN_NAME"); c.label = c.name; c.type = rs.getString("TYPE_NAME"); c.jdbcType = rs.getInt("DATA_TYPE"); c.jdbcTypeName = rs.getString("TYPE_NAME"); c.length = rs.getInt("COLUMN_SIZE"); c.precision = c.length; c.scale = rs.getInt("DECIMAL_DIGITS"); c.nullable = "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")); c.ordinalPosition = rs.getInt("ORDINAL_POSITION"); c.defaultValue = rs.getString("COLUMN_DEF"); c.autoIncrement = "YES".equalsIgnoreCase(rs.getString("IS_AUTOINCREMENT")); c.logicalType = dialect.logicalType(c); dialect.loadColumnOptions(connection, catalog, schema, tableName, c); columns.put(c.name, c); } }
        try (ResultSet rs = db.getPrimaryKeys(catalog, schema, tableName)) { while (rs.next()) { ColumnMetaData c = columns.get(rs.getString("COLUMN_NAME")); if (c != null) { c.primaryKey = true; String pkName = rs.getString("PK_NAME"); if (pkName != null && !pkName.isBlank()) table.primaryKeyName = pkName; } } }
        table.columns.clear(); table.columns.addAll(columns.values());
    }
    /** Loads secondary indexes from JDBC and then lets the dialect enrich each index with non-portable attributes. */
    private static void loadIndexes(DatabaseMetaData db, Connection connection, DBDialect dialect, String catalog, String schema, String tableName, TableMetaData table) throws SQLException {
        Set<String> primaryIndexNames = new HashSet<>();
        try (ResultSet rs = db.getPrimaryKeys(catalog, schema, tableName)) { while (rs.next()) { String name = rs.getString("PK_NAME"); if (name != null && !name.isBlank()) primaryIndexNames.add(name.toLowerCase(Locale.ROOT)); } }
        Map<String, IndexRows> indexes = new LinkedHashMap<>();
        try (ResultSet rs = db.getIndexInfo(catalog, schema, tableName, false, false)) {
            while (rs.next()) {
                short jdbcType = rs.getShort("TYPE"); String name = rs.getString("INDEX_NAME"), column = rs.getString("COLUMN_NAME"); int ordinal = rs.getInt("ORDINAL_POSITION");
                if (jdbcType == DatabaseMetaData.tableIndexStatistic || name == null || name.isBlank() || column == null || column.isBlank() || ordinal <= 0) continue;
                if (primaryIndexNames.contains(name.toLowerCase(Locale.ROOT))) continue;
                String key = name.toLowerCase(Locale.ROOT); IndexRows index = indexes.get(key);
                if (index == null) { index = new IndexRows(new IndexMetaData(name).unique(!rs.getBoolean("NON_UNIQUE")).type(String.valueOf(jdbcType))); indexes.put(key, index); }
                index.rows.add(new IndexColumn(ordinal, column));
            }
        }
        table.indexes.clear();
        for (IndexRows rows : indexes.values()) { rows.rows.sort(Comparator.comparingInt(IndexColumn::position)); for (IndexColumn column : rows.rows) rows.index.column(column.name()); dialect.loadIndexOptions(connection, catalog, schema, tableName, rows.index); table.indexes.add(rows.index); }
    }
    private record IndexColumn(int position, String name) {}
    private static final class IndexRows { final IndexMetaData index; final List<IndexColumn> rows = new ArrayList<>(); IndexRows(IndexMetaData index) { this.index = index; } }
}
