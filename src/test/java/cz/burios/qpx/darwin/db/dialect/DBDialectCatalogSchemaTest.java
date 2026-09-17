package cz.burios.qpx.darwin.db.dialect;

import java.lang.reflect.Proxy;
import java.sql.Connection;

import cz.burios.uniql.dialect.*;
import cz.burios.uniql.metadata.TableMetaData;

/** Executable test for dialect-specific JDBC catalog/schema semantics. */
public final class DBDialectCatalogSchemaTest {
    public static void main(String[] args) throws Exception {
        verify("my_catalog", "public", new MySQLDialect(),
                new TableMetaData().database("depo_cz").name("store"),
                "`depo_cz`.`store`");

        verify("my_database", "public", new PostgreSQLDialect(),
                new TableMetaData().schema("depo_cz").name("store"),
                "\"depo_cz\".\"store\"");

        verify("my_database", "dbo", new MSSQLDialect(),
                new TableMetaData().database("depo_cz").schema("dbo").name("store"),
                "[depo_cz].[dbo].[store]");

        System.out.println("DBDialectCatalogSchemaTest: OK");
    }

    private static void verify(String catalog, String schema, DBDialect dialect,
            TableMetaData table, String expectedTableName) throws Exception {
        Connection connection = connection(catalog, schema);

        if (!catalog.equals(dialect.catalog(connection)))
            throw new AssertionError(dialect.name() + " must use JDBC catalog as catalog");
        if (!schema.equals(dialect.schema(connection)))
            throw new AssertionError(dialect.name() + " must use JDBC schema as schema");
        if (!expectedTableName.equals(dialect.tableName(table)))
            throw new AssertionError(dialect.name() + " table qualification mismatch: "
                    + dialect.tableName(table) + " != " + expectedTableName);
    }

    private static Connection connection(String catalog, String schema) {
        return (Connection) Proxy.newProxyInstance(
                DBDialectCatalogSchemaTest.class.getClassLoader(),
                new Class<?>[] { Connection.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "getCatalog" -> catalog;
                    case "getSchema" -> schema;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }
}
