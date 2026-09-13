package cz.burios.qpx.darwin.db.dialect;

import java.util.List;

import cz.burios.qpx.darwin.db.metadata.ColumnGeneration;
import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.IndexMetaData;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** Executable cross-dialect DDL contract test; no live database required. */
public class DialectDdlTest {
    public static void main(String[] args) {
        testMySql(); testPostgreSql(); testH2(); testMssql();
        System.out.println("DialectDdlTest: OK");
    }
    private static TableMetaData table() { return new TableMetaData("STORE").database("depo_cz").schema("dbo"); }
    private static ColumnMetaData name() { return new ColumnMetaData("NAME").string(80).nullable(false); }
    private static IndexMetaData index() { return new IndexMetaData("IX_STORE_NAME").unique(true).method("BTREE").column("NAME").column("ID"); }
    private static void testMySql() {
        MySQLDialect d=new MySQLDialect(); TableMetaData t=table();
        if(!"`depo_cz`.`STORE`".equals(d.tableName(t)))throw new AssertionError("MySQL table name: "+d.tableName(t));
        ColumnMetaData c=name().collation("utf8_czech_ci");
        if(!"`NAME` VARCHAR(80) NOT NULL COLLATE utf8_czech_ci".equals(d.columnDefinition(c)))throw new AssertionError("MySQL column: "+d.columnDefinition(c));
        c=new ColumnMetaData("UPDATED_AT").datetime().nullable(false).generation(ColumnGeneration.INSERT_UPDATE_TIMESTAMP);
        if(!"`UPDATED_AT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".equals(d.columnDefinition(c)))throw new AssertionError("MySQL generated column: "+d.columnDefinition(c));
        if(!"CREATE UNIQUE INDEX `IX_STORE_NAME` ON `depo_cz`.`STORE` (`NAME`, `ID`) USING BTREE".equals(d.createIndex(t,index())))throw new AssertionError("MySQL index: "+d.createIndex(t,index()));
        if(!"DROP INDEX `IX_STORE_NAME` ON `depo_cz`.`STORE`".equals(d.dropIndex(t,index().name)))throw new AssertionError("MySQL drop index");
    }
    private static void testPostgreSql() {
        PostgreSQLDialect d=new PostgreSQLDialect(); TableMetaData t=table();
        if(!"\"dbo\".\"STORE\"".equals(d.tableName(t)))throw new AssertionError("PostgreSQL table name: "+d.tableName(t));
        if(!"\"NAME\" VARCHAR(80) NOT NULL".equals(d.columnDefinition(name())))throw new AssertionError("PostgreSQL column: "+d.columnDefinition(name()));
        if(!"CREATE UNIQUE INDEX \"IX_STORE_NAME\" ON \"dbo\".\"STORE\" USING BTREE (\"NAME\", \"ID\")".equals(d.createIndex(t,index())))throw new AssertionError("PostgreSQL index: "+d.createIndex(t,index()));
        if(!"DROP INDEX \"IX_STORE_NAME\"".equals(d.dropIndex(t,index().name)))throw new AssertionError("PostgreSQL drop index");
        ColumnMetaData generated=new ColumnMetaData("CREATED_AT").datetime().generation(ColumnGeneration.INSERT_TIMESTAMP);
        if(!"\"CREATED_AT\" TIMESTAMP DEFAULT CURRENT_TIMESTAMP".equals(d.columnDefinition(generated)))throw new AssertionError("PostgreSQL generated column: "+d.columnDefinition(generated));
    }
    private static void testH2() {
        H2Dialect d=new H2Dialect(); TableMetaData t=table();
        if(!"\"dbo\".\"STORE\"".equals(d.tableName(t)))throw new AssertionError("H2 table name: "+d.tableName(t));
        if(!"\"NAME\" VARCHAR(80) NOT NULL".equals(d.columnDefinition(name())))throw new AssertionError("H2 column: "+d.columnDefinition(name()));
        List<String> alter=d.alterColumnStatements(t,name());
        if(alter.size()!=3)throw new AssertionError("H2 alter statement count: "+alter.size());
        if(!"ALTER TABLE \"dbo\".\"STORE\" ALTER COLUMN \"NAME\" VARCHAR(80)".equals(alter.get(0)))throw new AssertionError("H2 type alter: "+alter.get(0));
        if(!"ALTER TABLE \"dbo\".\"STORE\" ALTER COLUMN \"NAME\" SET NOT NULL".equals(alter.get(1)))throw new AssertionError("H2 nullability alter: "+alter.get(1));
        if(!"ALTER TABLE \"dbo\".\"STORE\" ALTER COLUMN \"NAME\" DROP DEFAULT".equals(alter.get(2)))throw new AssertionError("H2 default alter: "+alter.get(2));
    }
    private static void testMssql() {
        MSSQLDialect d=new MSSQLDialect(); TableMetaData t=table();
        if(!"[depo_cz].[dbo].[STORE]".equals(d.tableName(t)))throw new AssertionError("MSSQL table name: "+d.tableName(t));
        ColumnMetaData id=new ColumnMetaData("ID").longType().nullable(false).primaryKey(true).autoIncrement(true);
        if(!"[ID] BIGINT IDENTITY(1,1) NOT NULL".equals(d.columnDefinition(id)))throw new AssertionError("MSSQL PK column: "+d.columnDefinition(id));
        if(!"CREATE UNIQUE INDEX [IX_STORE_NAME] ON [depo_cz].[dbo].[STORE] ([NAME], [ID])".equals(d.createIndex(t,index())))throw new AssertionError("MSSQL index: "+d.createIndex(t,index()));
        if(!"DROP INDEX [IX_STORE_NAME] ON [depo_cz].[dbo].[STORE]".equals(d.dropIndex(t,index().name)))throw new AssertionError("MSSQL drop index");
        if(!"ALTER TABLE [depo_cz].[dbo].[STORE] ALTER COLUMN [NAME] VARCHAR(80) NOT NULL".equals(d.alterColumn(t,name())))throw new AssertionError("MSSQL alter: "+d.alterColumn(t,name()));
    }
}
