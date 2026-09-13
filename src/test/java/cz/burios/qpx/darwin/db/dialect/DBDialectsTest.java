package cz.burios.qpx.darwin.db.dialect;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

/** Executable dialect-factory test; no live database required. */
public class DBDialectsTest {
    public static void main(String[] args) throws Exception {
        assertDialect("MySQL", "mysql", MySQLDialect.class);
        assertDialect("PostgreSQL", "postgresql", PostgreSQLDialect.class);
        assertDialect("H2", "h2", H2Dialect.class);
        assertDialect("Microsoft SQL Server", "mssql", MSSQLDialect.class);
        assertDialect("Microsoft SQL Server 2022", "mssql", MSSQLDialect.class);
        System.out.println("DBDialectsTest: OK");
    }

    private static void assertDialect(String productName, String expectedName, Class<? extends DBDialect> expectedType) throws Exception {
        DatabaseMetaData metadata = (DatabaseMetaData) Proxy.newProxyInstance(
                DBDialectsTest.class.getClassLoader(),
                new Class<?>[] {DatabaseMetaData.class},
                (proxy, method, args) -> {
                    if ("getDatabaseProductName".equals(method.getName())) return productName;
                    return defaultValue(method.getReturnType());
                });
        Connection connection = (Connection) Proxy.newProxyInstance(
                DBDialectsTest.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (proxy, method, args) -> {
                    if ("getMetaData".equals(method.getName())) return metadata;
                    return defaultValue(method.getReturnType());
                });

        DBDialect dialect = DBDialects.forConnection(connection);
        if (!expectedName.equals(dialect.name())) throw new AssertionError(productName + " -> " + dialect.name());
        if (!expectedType.isInstance(dialect)) throw new AssertionError(productName + " -> " + dialect.getClass().getName());
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == byte.class) return (byte) 0;
        if (type == short.class) return (short) 0;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == float.class) return 0F;
        if (type == double.class) return 0D;
        if (type == char.class) return '\0';
        return null;
    }
}
