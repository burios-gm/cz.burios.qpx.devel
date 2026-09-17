package cz.burios.qpx.darwin.db.dialect;

import java.sql.Types;

import cz.burios.uniql.dialect.MSSQLDialect;
import cz.burios.uniql.metadata.ColumnGeneration;
import cz.burios.uniql.metadata.ColumnMetaData;
import cz.burios.uniql.metadata.ColumnType;
import cz.burios.uniql.metadata.IndexMetaData;
import cz.burios.uniql.metadata.TableMetaData;

/** Executable SQL-generation test for Microsoft SQL Server; no live server required. */
public class MSSQLDialectTest {
    public static void main(String[] args) {
        MSSQLDialect dialect = new MSSQLDialect();

        TableMetaData table = new TableMetaData("STORE").database("depo_cz").schema("dbo");
        if (!"[depo_cz].[dbo].[STORE]".equals(dialect.tableName(table))) throw new AssertionError("Unexpected table name");
        if (!"[NAME]".equals(dialect.columnName("NAME"))) throw new AssertionError("Unexpected column quoting");

        ColumnMetaData id = new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true);
        String idSql = dialect.columnDefinition(id);
        if (!"[ID] BIGINT IDENTITY(1,1) NOT NULL".equals(idSql)) throw new AssertionError("Unexpected ID SQL: " + idSql);

        ColumnMetaData name = new ColumnMetaData("NAME").string(80).nullable(false);
        String nameSql = dialect.columnDefinition(name);
        if (!"[NAME] VARCHAR(80) NOT NULL".equals(nameSql)) throw new AssertionError("Unexpected NAME SQL: " + nameSql);

        ColumnMetaData created = new ColumnMetaData("CREATED_AT").datetime().generation(ColumnGeneration.INSERT_TIMESTAMP);
        if (!"[CREATED_AT] DATETIME2 DEFAULT CURRENT_TIMESTAMP".equals(dialect.columnDefinition(created))) throw new AssertionError("Unexpected INSERT timestamp SQL");

        ColumnMetaData updated = new ColumnMetaData("UPDATED_AT").datetime().generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
        boolean unsupported = false;
        try {
            dialect.columnGeneration(updated);
        } catch (UnsupportedOperationException expected) {
            unsupported = true;
        }
        if (!unsupported) throw new AssertionError("INSERT_UPDATE_TIMESTAMP should be rejected by MSSQL");

        ColumnMetaData active = new ColumnMetaData("ACTIVE");
        active.jdbcType = Types.BIT;
        active.jdbcTypeName = "bit";
        if (dialect.logicalType(active) != ColumnType.BOOLEAN) throw new AssertionError("BIT was not mapped to BOOLEAN");

        IndexMetaData index = new IndexMetaData("IX_STORE_NAME").unique(true).column("NAME").column("ID");
        String create = dialect.createIndex(table, index);
        if (!"CREATE UNIQUE INDEX [IX_STORE_NAME] ON [depo_cz].[dbo].[STORE] ([NAME], [ID])".equals(create)) throw new AssertionError("Unexpected CREATE INDEX SQL: " + create);
        String drop = dialect.dropIndex(table, index.name);
        if (!"DROP INDEX [IX_STORE_NAME] ON [depo_cz].[dbo].[STORE]".equals(drop)) throw new AssertionError("Unexpected DROP INDEX SQL: " + drop);

        String alter = dialect.alterColumn(table, name);
        if (!"ALTER TABLE [depo_cz].[dbo].[STORE] ALTER COLUMN [NAME] VARCHAR(80) NULL".equals(alter)) throw new AssertionError("Unexpected ALTER COLUMN SQL: " + alter);

        if (!"mssql".equals(dialect.name())) throw new AssertionError("Unexpected dialect name");
        System.out.println("MSSQLDialectTest: OK");
    }
}
