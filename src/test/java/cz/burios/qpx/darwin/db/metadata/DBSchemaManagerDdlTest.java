package cz.burios.qpx.darwin.db.metadata;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import cz.burios.qpx.darwin.db.dialect.DBDialect;
import cz.burios.qpx.darwin.db.dialect.H2Dialect;
import cz.burios.qpx.darwin.db.dialect.MSSQLDialect;
import cz.burios.qpx.darwin.db.dialect.MySQLDialect;
import cz.burios.qpx.darwin.db.dialect.PostgreSQLDialect;

/** Integration-level DDL test: verifies DBSchemaManager composes dialect SQL correctly. */
public class DBSchemaManagerDdlTest {
    public static void main(String[] args) throws Exception {
        test("mysql", new MySQLDialect(),
                "CREATE TABLE `depo_cz`.`STORE` (`ID` BIGINT NOT NULL, `CODE` VARCHAR(20) NOT NULL, PRIMARY KEY (`ID`, `CODE`)) ENGINE=MyISAM COLLATE=utf8_czech_ci",
                "CREATE INDEX `IX_STORE_CODE` ON `depo_cz`.`STORE` (`CODE`) USING BTREE");
        test("postgresql", new PostgreSQLDialect(),
                "CREATE TABLE \"dbo\".\"STORE\" (\"ID\" BIGINT NOT NULL, \"CODE\" VARCHAR(20) NOT NULL, PRIMARY KEY (\"ID\", \"CODE\"))",
                "CREATE INDEX \"IX_STORE_CODE\" ON \"dbo\".\"STORE\" (\"CODE\")");
        test("h2", new H2Dialect(),
                "CREATE TABLE \"dbo\".\"STORE\" (\"ID\" BIGINT NOT NULL, \"CODE\" VARCHAR(20) NOT NULL, PRIMARY KEY (\"ID\", \"CODE\"))",
                "CREATE INDEX \"IX_STORE_CODE\" ON \"dbo\".\"STORE\" (\"CODE\")");
        test("mssql", new MSSQLDialect(),
                "CREATE TABLE [depo_cz].[dbo].[STORE] ([ID] BIGINT NOT NULL, [CODE] VARCHAR(20) NOT NULL, PRIMARY KEY ([ID], [CODE]))",
                "CREATE INDEX [IX_STORE_CODE] ON [depo_cz].[dbo].[STORE] ([CODE])");
        System.out.println("DBSchemaManagerDdlTest: OK");
    }

    private static void test(String name, DBDialect dialect, String expectedCreate, String expectedIndex) throws Exception {
        TableMetaData table = new TableMetaData("STORE").database("depo_cz").schema("dbo");
        table.param("ENGINE", "MyISAM");
        table.param("COLLATE", "utf8_czech_ci");
        table.addColumn(new ColumnMetaData("ID").longType().nullable(false).primaryKey(true));
        table.addColumn(new ColumnMetaData("CODE").string(20).nullable(false).primaryKey(true));
        table.addIndex(new IndexMetaData("IX_STORE_CODE").column("CODE"));

        List<String> sql = new ArrayList<>();
        Connection connection = connection(sql);
        new DBSchemaManager(dialect).createTable(connection, table);

        if (dialect instanceof MySQLDialect) {
            // MySQL is the only dialect in this test where table options are asserted.
        } else {
            // Other dialects intentionally receive the same metadata to ensure unsupported
            // options do not leak into their generic table SQL.
        }
        if (sql.size() != 2) throw new AssertionError(name + " statement count: " + sql.size());
        if (!expectedCreate.equals(sql.get(0))) throw new AssertionError(name + " CREATE: " + sql.get(0));
        if (!expectedIndex.equals(sql.get(1))) throw new AssertionError(name + " INDEX: " + sql.get(1));
    }

    private static Connection connection(List<String> sql) {
        Statement statement = (Statement) Proxy.newProxyInstance(
                DBSchemaManagerDdlTest.class.getClassLoader(), new Class<?>[]{Statement.class},
                (proxy, method, args) -> {
                    if ("executeUpdate".equals(method.getName())) {
                        sql.add((String) args[0]);
                        return 0;
                    }
                    if ("close".equals(method.getName())) return null;
                    if ("isClosed".equals(method.getName())) return false;
                    return defaultValue(method.getReturnType());
                });
        return (Connection) Proxy.newProxyInstance(
                DBSchemaManagerDdlTest.class.getClassLoader(), new Class<?>[]{Connection.class},
                (proxy, method, args) -> {
                    if ("createStatement".equals(method.getName())) return statement;
                    if ("close".equals(method.getName())) return null;
                    if ("isClosed".equals(method.getName())) return false;
                    return defaultValue(method.getReturnType());
                });
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
