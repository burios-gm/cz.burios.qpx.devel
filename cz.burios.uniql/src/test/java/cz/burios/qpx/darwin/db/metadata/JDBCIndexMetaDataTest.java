package cz.burios.qpx.darwin.db.metadata;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import cz.burios.uniql.metadata.*;

/** Executable test for DatabaseMetaData.getIndexInfo() loading; no JUnit required. */
public class JDBCIndexMetaDataTest {
    public static void main(String[] args) throws Exception {
        Connection connection = connection();
        DBMetaData metadata = DBMetaData.load(connection);
        TableMetaData table = metadata.table("STORE");
        if (table == null) throw new AssertionError("STORE was not discovered");
        if (table.indexes.size() != 2) throw new AssertionError("Expected two secondary indexes: " + table.indexes);

        IndexMetaData unique = table.indexes.get(0);
        if (!"UX_STORE_CODE".equals(unique.name)) throw new AssertionError("Unexpected first index: " + unique.name);
        if (!unique.unique) throw new AssertionError("UX_STORE_CODE should be unique");
        if (!unique.columns.equals(List.of("CODE", "NAME"))) throw new AssertionError("Column order was not loaded: " + unique.columns);

        IndexMetaData normal = table.indexes.get(1);
        if (!"IX_STORE_NAME".equals(normal.name)) throw new AssertionError("Unexpected second index: " + normal.name);
        if (normal.unique) throw new AssertionError("IX_STORE_NAME should not be unique");
        if (!normal.columns.equals(List.of("NAME", "ID"))) throw new AssertionError("Column order was not loaded: " + normal.columns);

        System.out.println("JDBCIndexMetaDataTest: OK");
    }

    private static Connection connection() {
        DatabaseMetaData db = proxy(DatabaseMetaData.class, new DBHandler());
        return proxy(Connection.class, new ConnectionHandler(db));
    }

    private static final class ConnectionHandler implements java.lang.reflect.InvocationHandler {
        private final DatabaseMetaData metadata;
        ConnectionHandler(DatabaseMetaData metadata) { this.metadata = metadata; }
        @Override public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
            if (method.getName().equals("getMetaData")) return metadata;
            if (method.getName().equals("getCatalog")) return "depo_cz";
            if (method.getName().equals("getSchema")) return null;
            return defaultValue(method.getReturnType());
        }
    }

    private static final class DBHandler implements java.lang.reflect.InvocationHandler {
        @Override public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
            return switch (method.getName()) {
                case "getDatabaseProductName" -> "H2";
                case "getDatabaseProductVersion" -> "2.x";
                case "getTables" -> result(List.of(row("TABLE_SCHEM", "PUBLIC", "TABLE_NAME", "STORE")));
                case "getColumns" -> result(List.of());
                case "getPrimaryKeys" -> result(List.of());
                case "getIndexInfo" -> result(List.of(
                    row("TYPE", (short) 3, "INDEX_NAME", "IX_STAT", "COLUMN_NAME", null, "NON_UNIQUE", false, "ORDINAL_POSITION", 0),
                    row("TYPE", (short) 3, "INDEX_NAME", "UX_STORE_CODE", "COLUMN_NAME", "NAME", "NON_UNIQUE", false, "ORDINAL_POSITION", 2),
                    row("TYPE", (short) 3, "INDEX_NAME", "UX_STORE_CODE", "COLUMN_NAME", "CODE", "NON_UNIQUE", false, "ORDINAL_POSITION", 1),
                    row("TYPE", (short) 3, "INDEX_NAME", "IX_STORE_NAME", "COLUMN_NAME", "ID", "NON_UNIQUE", true, "ORDINAL_POSITION", 2),
                    row("TYPE", (short) 3, "INDEX_NAME", "IX_STORE_NAME", "COLUMN_NAME", "NAME", "NON_UNIQUE", true, "ORDINAL_POSITION", 1)
                ));
                default -> defaultValue(method.getReturnType());
            };
        }
    }

    private static ResultSet result(List<Map<String, Object>> rows) {
        Iterator<Map<String, Object>> iterator = rows.iterator();
        return proxy(ResultSet.class, new java.lang.reflect.InvocationHandler() {
            Map<String, Object> current;
            @Override public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) throws SQLException {
                return switch (method.getName()) {
                    case "next" -> { boolean has = iterator.hasNext(); if (has) current = iterator.next(); yield has; }
                    case "getString" -> value(args[0], String.class);
                    case "getInt" -> number(args[0]).intValue();
                    case "getShort" -> number(args[0]).shortValue();
                    case "getBoolean" -> booleanValue(args[0]);
                    case "close" -> null;
                    default -> defaultValue(method.getReturnType());
                };
            }
            private Object value(Object key, Class<?> type) {
                Object value = current.get(String.valueOf(key));
                return value == null ? null : type.cast(value);
            }
            private Number number(Object key) { Object value = current.get(String.valueOf(key)); return value instanceof Number n ? n : 0; }
            private boolean booleanValue(Object key) { Object value = current.get(String.valueOf(key)); return Boolean.TRUE.equals(value); }
        });
    }

    private static Map<String, Object> row(Object... values) {
        java.util.LinkedHashMap<String, Object> row = new java.util.LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) row.put(String.valueOf(values[i]), values[i + 1]);
        return row;
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, handler);
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == byte.class) return (byte) 0;
        if (type == short.class) return (short) 0;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == float.class) return 0f;
        if (type == double.class) return 0d;
        if (type == char.class) return '\0';
        return null;
    }
}
