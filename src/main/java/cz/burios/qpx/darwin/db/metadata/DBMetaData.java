package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.DBDialects;

/** Database metadata cache containing JDBC catalog/schema and discovered tables. */
public class DBMetaData {
    public String catalog;
    public String schema;
    public String databaseName;
    public String productName;
    public String productVersion;
    public String dialectName;
    public final Map<String, TableMetaData> tables = new LinkedHashMap<>();
    public DBMetaData() {}
    public DBMetaData(String databaseName) { this.catalog = databaseName; this.databaseName = databaseName; }

    /** Returns a table by its exact metadata key or, for compatibility, by an unambiguous simple name. */
    public TableMetaData table(String name) {
        TableMetaData table = tables.get(name);
        if (table != null) return table;
        TableMetaData found = null;
        for (TableMetaData candidate : tables.values()) if (candidate.name != null && candidate.name.equalsIgnoreCase(name)) {
            if (found != null) return null;
            found = candidate;
        }
        return found;
    }

    public DBMetaData add(TableMetaData table) {
        if (table == null || table.name == null || table.name.isBlank()) throw new IllegalArgumentException("table is required");
        tables.put(key(table), table);
        return this;
    }

    public DBMetaData remove(String name) {
        if (name == null) return this;
        if (tables.remove(name) != null) return this;
        String key = name.toLowerCase(Locale.ROOT);
        String found = null;
        for (Map.Entry<String, TableMetaData> entry : tables.entrySet()) if (key(entry.getValue()).equals(key)) { found = entry.getKey(); break; }
        if (found != null) tables.remove(found);
        return this;
    }

    private static String key(TableMetaData table) {
        StringBuilder key = new StringBuilder();
        if (table.database != null && !table.database.isBlank()) key.append(table.database).append('.');
        if (table.schema != null && !table.schema.isBlank()) key.append(table.schema).append('.');
        key.append(table.name);
        return key.toString().toLowerCase(Locale.ROOT);
    }

    public static DBMetaData load(Connection connection) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        DatabaseMetaData db = connection.getMetaData();
        DBDialect dialect = DBDialects.forConnection(connection);
        String catalog = dialect.catalog(connection), schema = dialect.schema(connection);
        DBMetaData result = new DBMetaData();
        result.catalog = catalog; result.schema = schema; result.databaseName = catalog;
        result.productName = db.getDatabaseProductName(); result.productVersion = db.getDatabaseProductVersion(); result.dialectName = dialect.name();
        try (ResultSet tables = db.getTables(catalog, schema, "%", new String[] {"TABLE"})) {
            while (tables.next()) {
                String tableSchema = tables.getString("TABLE_SCHEM"), name = tables.getString("TABLE_NAME");
                TableMetaData table = new TableMetaData(name).schema(tableSchema).database(catalog);
                loadColumns(db, connection, dialect, catalog, tableSchema, name, table);
                loadIndexes(db, catalog, tableSchema, name, table);
                dialect.loadTableOptions(connection, catalog, tableSchema, table);
                result.add(table);
            }
        }
        return result;
    }
    private static void loadColumns(DatabaseMetaData db, Connection connection, DBDialect dialect, String catalog, String schema, String tableName, TableMetaData table) throws SQLException {
        Map<String, ColumnMetaData> columns = new LinkedHashMap<>();
        try (ResultSet rs = db.getColumns(catalog, schema, tableName, "%")) {
            while (rs.next()) {
                ColumnMetaData c = new ColumnMetaData();
                c.name = rs.getString("COLUMN_NAME"); c.label = c.name; c.type = rs.getString("TYPE_NAME"); c.jdbcType = rs.getInt("DATA_TYPE"); c.jdbcTypeName = rs.getString("TYPE_NAME");
                c.length = rs.getInt("COLUMN_SIZE"); c.precision = c.length; c.scale = rs.getInt("DECIMAL_DIGITS"); c.nullable = "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")); c.ordinalPosition = rs.getInt("ORDINAL_POSITION");
                c.defaultValue = rs.getString("COLUMN_DEF"); c.autoIncrement = "YES".equalsIgnoreCase(rs.getString("IS_AUTOINCREMENT")); c.logicalType = dialect.logicalType(c);
                dialect.loadColumnOptions(connection, catalog, schema, tableName, c); columns.put(c.name, c);
            }
        }
        try (ResultSet rs = db.getPrimaryKeys(catalog, schema, tableName)) {
            while (rs.next()) { ColumnMetaData c = columns.get(rs.getString("COLUMN_NAME")); if (c != null) c.primaryKey = true; }
        }
        table.columns.clear(); table.columns.addAll(columns.values());
    }
    private static void loadIndexes(DatabaseMetaData db, String catalog, String schema, String tableName, TableMetaData table) throws SQLException {
        Set<String> primaryIndexNames = new HashSet<>();
        try (ResultSet rs = db.getPrimaryKeys(catalog, schema, tableName)) {
            while (rs.next()) {
                String name = rs.getString("PK_NAME");
                if (name != null && !name.isBlank()) primaryIndexNames.add(name.toLowerCase(Locale.ROOT));
            }
        }
        Map<String, IndexMetaData> indexes = new LinkedHashMap<>();
        try (ResultSet rs = db.getIndexInfo(catalog, schema, tableName, false, false)) {
            while (rs.next()) {
                String name = rs.getString("INDEX_NAME"), column = rs.getString("COLUMN_NAME");
                if (name == null || column == null || primaryIndexNames.contains(name.toLowerCase(Locale.ROOT))) continue;
                IndexMetaData index = indexes.get(name);
                if (index == null) {
                    index = new IndexMetaData(name).unique(!rs.getBoolean("NON_UNIQUE")).type(rs.getString("TYPE"));
                    indexes.put(name, index);
                }
                index.column(column);
            }
        }
        table.indexes.clear(); table.indexes.addAll(indexes.values());
    }
}
