package cz.burios.qpx.darwin.db.dialect;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.IndexMetaData;

/** Executable test for dialect-specific index method loading; no JUnit required. */
public class DialectIndexMetaDataTest {
    public static void main(String[] args) throws Exception {
        testMySql();
        testPostgreSql();
        testMssql();
        System.out.println("DialectIndexMetaDataTest: OK");
    }

    private static void testMySql() throws Exception {
        IndexMetaData index = new IndexMetaData("IX_STORE_NAME");
        new MySQLDialect().loadIndexOptions(connection(List.of(row("INDEX_TYPE", "btree"))), "depo_cz", null, "STORE", index);
        assertEquals("BTREE", index.method, "MySQL method");
    }

    private static void testPostgreSql() throws Exception {
        IndexMetaData index = new IndexMetaData("ix_store_name");
        new PostgreSQLDialect().loadIndexOptions(connection(List.of(row("amname", "hash"))), "depo_cz", "public", "store", index);
        assertEquals("HASH", index.method, "PostgreSQL method");
    }

    private static void testMssql() throws Exception {
        IndexMetaData index = new IndexMetaData("IX_STORE_NAME");
        new MSSQLDialect().loadIndexOptions(connection(List.of(row("type_desc", "NONCLUSTERED"))), "depo_cz", "dbo", "STORE", index);
        assertEquals("NONCLUSTERED", index.method, "SQL Server method");
    }

    private static Connection connection(List<Map<String, Object>> rows) {
        return proxy(Connection.class, (proxy, method, args) -> {
            if (method.getName().equals("prepareStatement")) return preparedStatement(rows);
            return defaultValue(method.getReturnType());
        });
    }

    private static PreparedStatement preparedStatement(List<Map<String, Object>> rows) {
        return proxy(PreparedStatement.class, new java.lang.reflect.InvocationHandler() {
            private final Map<Integer, String> parameters = new HashMap<>();

            @Override public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
                if (method.getName().equals("setString")) {
                    parameters.put((Integer) args[0], (String) args[1]);
                    return null;
                }
                if (method.getName().equals("executeQuery")) return result(rows);
                if (method.getName().equals("close")) return null;
                return defaultValue(method.getReturnType());
            }
        });
    }

    private static ResultSet result(List<Map<String, Object>> rows) {
        Iterator<Map<String, Object>> iterator = rows.iterator();
        return proxy(ResultSet.class, new java.lang.reflect.InvocationHandler() {
            private Map<String, Object> current;

            @Override public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
                return switch (method.getName()) {
                    case "next" -> { boolean has = iterator.hasNext(); if (has) current = iterator.next(); yield has; }
                    case "getString" -> current.get(String.valueOf(args[0]));
                    case "close" -> null;
                    default -> defaultValue(method.getReturnType());
                };
            }
        });
    }

    private static Map<String, Object> row(String key, Object value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put(key, value);
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

    private static void assertEquals(String expected, String actual, String label) {
        if (!expected.equals(actual)) throw new AssertionError(label + ": expected " + expected + ", got " + actual);
    }
}
