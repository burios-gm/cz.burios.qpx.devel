package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.DBDialects;

/** Database metadata cache containing JDBC catalog/schema and discovered tables. */
public class DBMetaData {
    /** JDBC catalog; for MySQL this is the database name. */
    public String catalog;
    /** JDBC schema; used by databases such as PostgreSQL and Oracle. */
    public String schema;
    /** Legacy alias retained for compatibility; normally equal to catalog. */
    public String databaseName;
    public String productName;
    public String productVersion;
    public String dialectName;
    public final Map<String, TableMetaData> tables = new LinkedHashMap<>();

    public DBMetaData() {}
    public DBMetaData(String databaseName) {
        this.catalog = databaseName;
        this.databaseName = databaseName;
    }

    public TableMetaData table(String name) { return tables.get(name); }
    public DBMetaData add(TableMetaData table) { tables.put(table.name, table); return this; }
    public DBMetaData remove(String name) { tables.remove(name); return this; }

    public static DBMetaData load(Connection connection) throws SQLException {
        if (connection == null) throw new IllegalArgumentException("connection must not be null");
        DatabaseMetaData db = connection.getMetaData();
        DBDialect dialect = DBDialects.forConnection(connection);
        String catalog = dialect.catalog(connection);
        String schema = dialect.schema(connection);

        DBMetaData result = new DBMetaData();
        result.catalog = catalog;
        result.schema = schema;
        result.databaseName = catalog;
        result.productName = db.getDatabaseProductName();
        result.productVersion = db.getDatabaseProductVersion();
        result.dialectName = dialect.name();

        try (ResultSet tables = db.getTables(catalog, schema, "%", new String[] {"TABLE"})) {
            while (tables.next()) {
                String tableSchema = tables.getString("TABLE_SCHEM");
                String name = tables.getString("TABLE_NAME");
                TableMetaData table = new TableMetaData(name)
                        .schema(tableSchema)
                        .database(catalog);
                loadColumns(db, catalog, tableSchema, name, table);
                dialect.loadTableOptions(connection, catalog, tableSchema, table);
                result.add(table);
            }
        }
        return result;
    }

    private static void loadColumns(DatabaseMetaData db, String catalog, String schema, String tableName,
            TableMetaData table) throws SQLException {
        Map<String, ColumnMetaData> columns = new LinkedHashMap<>();
        try (ResultSet rs = db.getColumns(catalog, schema, tableName, "%")) {
            while (rs.next()) {
                ColumnMetaData c = new ColumnMetaData();
                c.name = rs.getString("COLUMN_NAME");
                c.label = c.name;
                c.type = rs.getString("TYPE_NAME");
                c.jdbcType = rs.getInt("DATA_TYPE");
                c.jdbcTypeName = rs.getString("TYPE_NAME");
                c.length = rs.getInt("COLUMN_SIZE");
                c.precision = c.length;
                c.scale = rs.getInt("DECIMAL_DIGITS");
                c.nullable = "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE"));
                c.ordinalPosition = rs.getInt("ORDINAL_POSITION");
                c.defaultValue = rs.getString("COLUMN_DEF");
                c.autoIncrement = "YES".equalsIgnoreCase(rs.getString("IS_AUTOINCREMENT"));
                columns.put(c.name, c);
            }
        }
        try (ResultSet rs = db.getPrimaryKeys(catalog, schema, tableName)) {
            while (rs.next()) {
                ColumnMetaData c = columns.get(rs.getString("COLUMN_NAME"));
                if (c != null) c.primaryKey = true;
            }
        }
        table.columns.clear();
        table.columns.addAll(columns.values());
    }
}
