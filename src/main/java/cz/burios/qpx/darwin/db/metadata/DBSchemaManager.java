package cz.burios.qpx.darwin.db.metadata;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import cz.burios.qpx.darwin.db.dialect.DBDialect;

/** Runtime DDL facade. All database-specific SQL is delegated to the dialect. */
public class DBSchemaManager {
    private final DBDialect dialect;
    public DBSchemaManager(DBDialect dialect) { if (dialect == null) throw new IllegalArgumentException("dialect must not be null"); this.dialect = dialect; }
    public DBDialect dialect() { return dialect; }
    public void createTable(Connection connection, TableMetaData table) throws SQLException {
        require(table); StringBuilder sql = new StringBuilder("CREATE TABLE ").append(dialect.tableName(table)).append(" (");
        for (int i=0;i<table.columns.size();i++) { if(i>0)sql.append(", "); sql.append(dialect.columnDefinition(table.columns.get(i))); }
        appendPrimaryKey(sql,table); sql.append(')').append(dialect.tableOptions(table)); execute(connection,sql.toString());
        for(IndexMetaData index:table.indexes) createIndex(connection,table,index);
    }
    public void addColumn(Connection c,TableMetaData t,ColumnMetaData col)throws SQLException { require(t); require(col); execute(c,"ALTER TABLE "+dialect.tableName(t)+" ADD COLUMN "+dialect.columnDefinition(col)); }
    public void dropColumn(Connection c,TableMetaData t,String col)throws SQLException { require(t); execute(c,"ALTER TABLE "+dialect.tableName(t)+" DROP COLUMN "+dialect.columnName(col)); }
    public void dropTable(Connection c,TableMetaData t)throws SQLException { require(t); execute(c,"DROP TABLE "+dialect.tableName(t)); }
    public void alterColumn(Connection c,TableMetaData t,ColumnMetaData col)throws SQLException { require(t); require(col); execute(c,dialect.alterColumn(t,col)); }
    public void alterTableParams(Connection c,TableMetaData t)throws SQLException { require(t); String sql=dialect.alterTableOptions(t); if(sql!=null&&!sql.isBlank())execute(c,sql); }
    public void createIndex(Connection c,TableMetaData t,IndexMetaData index)throws SQLException { require(t); execute(c,dialect.createIndex(t,index)); }
    public void dropIndex(Connection c,TableMetaData t,String name)throws SQLException { require(t); execute(c,dialect.dropIndex(t,name)); }
    private void appendPrimaryKey(StringBuilder sql,TableMetaData t){ boolean first=true; for(ColumnMetaData c:t.columns)if(c.primaryKey){if(first){sql.append(", PRIMARY KEY (");first=false;}else sql.append(", ");sql.append(dialect.columnName(c.name));} if(!first)sql.append(')'); }
    private void execute(Connection c,String sql)throws SQLException { if(c==null)throw new IllegalArgumentException("connection must not be null"); try(Statement s=c.createStatement()){s.executeUpdate(sql);} }
    private static void require(TableMetaData t){if(t==null||t.name==null||t.name.isBlank())throw new IllegalArgumentException("table is required");}
    private static void require(ColumnMetaData c){if(c==null||c.name==null||c.name.isBlank())throw new IllegalArgumentException("column is required");}
}
