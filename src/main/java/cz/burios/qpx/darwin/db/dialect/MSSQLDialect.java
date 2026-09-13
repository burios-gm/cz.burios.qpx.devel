package cz.burios.qpx.darwin.db.dialect;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Locale;

import cz.burios.qpx.darwin.db.metadata.ColumnGeneration;
import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.ColumnType;
import cz.burios.qpx.darwin.db.metadata.IndexMetaData;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;

/** Microsoft SQL Server dialect: catalog is the database, schema is the SQL schema. */
public class MSSQLDialect implements DBDialect {
    @Override public String name() { return "mssql"; }
    @Override public String catalog(Connection connection) throws SQLException { return connection.getCatalog(); }
    @Override public String schema(Connection connection) throws SQLException { return connection.getSchema(); }
    @Override public String tableName(TableMetaData table) { StringBuilder sql=new StringBuilder(); if(table.database!=null&&!table.database.isBlank())sql.append(quote(table.database)).append('.'); if(table.schema!=null&&!table.schema.isBlank())sql.append(quote(table.schema)).append('.'); return sql.append(quote(table.name)).toString(); }
    @Override public String quote(String name) { if(name==null||!name.matches("[A-Za-z_][A-Za-z0-9_$]*"))throw new IllegalArgumentException("Invalid SQL identifier: "+name); return "["+name+"]"; }
    @Override public ColumnType logicalType(ColumnMetaData c) { String n=c.jdbcTypeName!=null?c.jdbcTypeName:c.type; if(n!=null){String t=n.toUpperCase(Locale.ROOT); if(t.contains("CHAR")||t.contains("VARCHAR"))return ColumnType.STRING; if(t.contains("TEXT")||t.contains("NTEXT"))return ColumnType.TEXT; if(t.equals("BIT"))return ColumnType.BOOLEAN; if(t.equals("BIGINT"))return ColumnType.LONG; if(t.equals("INT")||t.equals("INTEGER")||t.equals("SMALLINT")||t.equals("TINYINT"))return ColumnType.INTEGER; if(t.contains("DECIMAL")||t.contains("NUMERIC")||t.equals("MONEY")||t.equals("SMALLMONEY"))return ColumnType.DECIMAL; if(t.contains("FLOAT")||t.equals("REAL"))return ColumnType.DOUBLE; if(t.equals("DATETIME")||t.equals("DATETIME2")||t.equals("SMALLDATETIME"))return ColumnType.DATETIME; if(t.equals("DATETIMEOFFSET"))return ColumnType.TIMESTAMP; if(t.equals("DATE"))return ColumnType.DATE; if(t.equals("TIME"))return ColumnType.TIME; if(t.contains("BINARY")||t.contains("IMAGE"))return ColumnType.BINARY;} return DBDialect.super.logicalType(c); }
    @Override public String columnDefinition(ColumnMetaData c) { StringBuilder sql=new StringBuilder(columnName(c.name)).append(' ').append(type(c)); if(c.autoIncrement)sql.append(" IDENTITY(1,1)"); if(!c.nullable)sql.append(" NOT NULL"); String g=columnGeneration(c); if(!g.isBlank())sql.append(' ').append(g); else if(c.defaultValue!=null)sql.append(" DEFAULT ").append(c.defaultValue); return sql.toString(); }
    @Override public String columnGeneration(ColumnMetaData c) { return switch(c.generation==null?ColumnGeneration.NONE:c.generation){case NONE->""; case INSERT_TIMESTAMP,INSERT_UPDATE_TIMESTAMP->"DEFAULT CURRENT_TIMESTAMP";}; }
    @Override public String alterColumn(TableMetaData table,ColumnMetaData c) { return "ALTER TABLE "+tableName(table)+" ALTER COLUMN "+columnName(c.name)+" "+type(c)+(c.nullable?" NULL":" NOT NULL"); }
    @Override public String createIndex(TableMetaData table,IndexMetaData index) { return DBDialect.super.createIndex(table,index); }
    @Override public String dropIndex(TableMetaData table,String name) { return "DROP INDEX "+indexName(name)+" ON "+tableName(table); }
    private String type(ColumnMetaData c) { if(c.logicalType!=null)return switch(c.logicalType){case STRING->c.length>0?"VARCHAR("+c.length+")":"VARCHAR(255)";case TEXT->"NVARCHAR(MAX)";case BOOLEAN->"BIT";case INTEGER->"INT";case LONG->"BIGINT";case DECIMAL->c.precision>0?"DECIMAL("+c.precision+","+Math.max(c.scale,0)+")":"DECIMAL(18,2)";case DOUBLE->"FLOAT";case DATE->"DATE";case TIME->"TIME";case DATETIME->"DATETIME2";case TIMESTAMP->"DATETIME2";case BINARY->c.length>0?"VARBINARY("+c.length+")":"VARBINARY(MAX)";}; if(c.type!=null&&!c.type.isBlank()&&c.type.matches("[A-Za-z][A-Za-z0-9_]*(\\s*\\(\\s*[0-9]+(?:\\s*,\\s*[0-9]+)?\\s*\\))?"))return c.type.trim(); return switch(c.jdbcType){case Types.BIGINT->"BIGINT";case Types.INTEGER->"INT";case Types.SMALLINT->"SMALLINT";case Types.TINYINT->"TINYINT";case Types.DECIMAL,Types.NUMERIC->"DECIMAL";case Types.DOUBLE->"FLOAT";case Types.FLOAT->"REAL";case Types.BOOLEAN,Types.BIT->"BIT";case Types.DATE->"DATE";case Types.TIME->"TIME";case Types.TIMESTAMP->"DATETIME2";case Types.BINARY,Types.VARBINARY,Types.LONGVARBINARY->"VARBINARY(MAX)";case Types.LONGVARCHAR->"NVARCHAR(MAX)";case Types.CHAR->c.length>0?"CHAR("+c.length+")":"CHAR";case Types.VARCHAR->c.length>0?"VARCHAR("+c.length+")":"VARCHAR(255)";default->"NVARCHAR(MAX)";}; }
}
