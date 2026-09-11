package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.model.BasicRecord;
import cz.burios.qpx.darwin.db.model.DynamicRecord;
import cz.burios.qpx.darwin.db.metadata.ColumnMetaData;
import cz.burios.qpx.darwin.db.metadata.QLRecordMetadata;
import cz.burios.qpx.darwin.db.metadata.TableMetaData;
import cz.burios.qpx.darwin.db.uniql.*;
import java.sql.*;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Unified SQL-like fluent DSL facade for SELECT and CRUD statements. */
public final class DSL {
    private DSL() {}

    public static Select select(QLExpr... expressions) { Select b=new Select(); if(expressions!=null)b.select.columns.addAll(Arrays.asList(expressions)); return b; }
    public static Select select(String... columnNames) { Select b=new Select(); if(columnNames!=null)for(String n:columnNames)b.select.columns.add(col(n)); return b; }
    public static Select select() { return new Select(); }
    public static Select select(Class<? extends BasicRecord> type) { return select().from(QLRecordMetadata.table(type)); }

    public static QLSchema schema(String database, String table) { return new QLSchema(database, table); }
    public static QLSchema schema(String database, String table, String column) { return new QLSchema(database, table, column); }
    public static QLSchema schema(String qualifiedName) { return QLSchema.parse(qualifiedName); }
    public static QLColumn col(String name) { return new QLColumn(name); }
    public static QLColumn col(String name, String alias) { return new QLColumn(name, alias); }
    public static QLColumn col(QLSchema schema) { return new QLColumn(schema); }
    public static QLColumn column(String name) { return col(name); }
    public static QLColumn column(QLSchema schema) { return col(schema); }
    public static QLTable table(String name) { return new QLTable(name); }
    public static QLTable table(QLSchema schema) { return new QLTable(schema); }
    public static QLTable table(String database, String table) { return table(schema(database, table)); }
    public static QLValue val(Object value) { return new QLValue(value); }
    public static QLValue value(Object value) { return val(value); }
    public static QLFunction fn(String name, QLExpr... args) { return new QLFunction(name, args); }
    public static QLFunction function(String name, QLExpr... args) { return fn(name, args); }
    public static QLSubSelect subSelect(QLSelect select) { return new QLSubSelect(select); }
    public static QLExpression expression(QLExpr left,String operator,Object right){return new QLExpression(left,operator,QLExpr.toExpr(right));}
    public static QLBrackets brackets(QLExpr expression){return new QLBrackets(expression);}
    public static QLCondition condition(QLExpr left,String operator,Object right){return new QLCondition(left,operator,QLExpr.toExpr(right));}
    public static QLWhere where(QLExpr... expressions){return new QLWhere(expressions);}
    public static QLGroupBy groupBy(QLExpr... expressions){return new QLGroupBy(expressions);}
    public static QLOrderBy orderBy(QLExpr expression,String direction){return new QLOrderBy().add(expression,direction);}
    public static QLCase caseExpr(){return new QLCase();}
    public static QLExists exists(QLSelect select){return new QLExists(select);}
    public static QLCondition eq(QLExpr left,Object right){return left.eq(right);}
    public static QLCondition ne(QLExpr left,Object right){return left.ne(right);}
    public static QLCondition gt(QLExpr left,Object right){return left.gt(right);}
    public static QLCondition ge(QLExpr left,Object right){return left.ge(right);}
    public static QLCondition lt(QLExpr left,Object right){return left.lt(right);}
    public static QLCondition le(QLExpr left,Object right){return left.le(right);}
    public static QLCondition like(QLExpr left,Object right){return left.like(right);}

    public static Insert insertInto(String table){return new Insert(table);} public static Insert insertInto(QLSchema schema){return new Insert(schema);}
    public static Insert insertInto(Class<? extends BasicRecord> type){return new Insert(QLRecordMetadata.table(type));}
    public static Update update(String table){return new Update(table);} public static Update update(QLSchema schema){return new Update(schema);}
    public static Update update(Class<? extends BasicRecord> type){return new Update(QLRecordMetadata.table(type));}
    public static Delete deleteFrom(String table){return new Delete(table);} public static Delete deleteFrom(QLSchema schema){return new Delete(schema);}
    public static Delete deleteFrom(Class<? extends BasicRecord> type){return new Delete(QLRecordMetadata.table(type));}

    public static int insert(Connection c,String table,BasicRecord r)throws SQLException{requireRecord(r);return insertInto(table).row(r).execute(c);}
    public static int insert(Connection c,BasicRecord r)throws SQLException{
        requireRecord(r);
        if (r instanceof DynamicRecord d) return insertDynamic(c,d);
        return insert(c,QLRecordMetadata.table(recordType(r)),r);
    }
    public static int update(Connection c,String table,BasicRecord r,String keyColumn)throws SQLException{requireRecord(r);requireKeyColumn(keyColumn);Object key=r.get(keyColumn);if(key==null)throw new IllegalArgumentException("record key must not be null: "+keyColumn);Update u=update(table).where(col(keyColumn).eq(key));for(Map.Entry<String,Object> e:r.entrySet())if(!keyColumn.equals(e.getKey()))u.set(e.getKey(),e.getValue());return u.execute(c);}
    public static int update(Connection c,BasicRecord r)throws SQLException{
        requireRecord(r);
        if (r instanceof DynamicRecord d) return updateDynamic(c,d);
        Class<? extends BasicRecord> type=recordType(r);String id=QLRecordMetadata.idColumn(type);return update(c,QLRecordMetadata.table(type),r,id);
    }
    public static int delete(Connection c,String table,BasicRecord r,String keyColumn)throws SQLException{requireRecord(r);requireKeyColumn(keyColumn);Object key=r.get(keyColumn);if(key==null)throw new IllegalArgumentException("record key must not be null: "+keyColumn);return deleteFrom(table).where(col(keyColumn).eq(key)).execute(c);}
    public static int delete(Connection c,BasicRecord r)throws SQLException{
        requireRecord(r);
        if (r instanceof DynamicRecord d) return deleteDynamic(c,d);
        Class<? extends BasicRecord> type=recordType(r);String id=QLRecordMetadata.idColumn(type);return delete(c,QLRecordMetadata.table(type),r,id);
    }
    private static int insertDynamic(Connection c, DynamicRecord r)throws SQLException{
        TableMetaData meta=requireMetadata(r); validateColumns(meta,r); return insertInto(meta.qualifiedName()).row(r).execute(c);
    }
    private static int updateDynamic(Connection c, DynamicRecord r)throws SQLException{
        TableMetaData meta=requireMetadata(r); validateColumns(meta,r); ColumnMetaData key=meta.primaryKey();
        if(key==null)throw new IllegalArgumentException("No primary key metadata for "+meta.qualifiedName());
        Object value=r.get(key.name); if(value==null)throw new IllegalArgumentException("record key must not be null: "+key.name);
        Update u=update(meta.qualifiedName()).where(col(key.name).eq(value));
        for(Map.Entry<String,Object> e:r.entrySet())if(!key.name.equalsIgnoreCase(e.getKey()))u.set(e.getKey(),e.getValue());
        return u.execute(c);
    }
    private static int deleteDynamic(Connection c, DynamicRecord r)throws SQLException{
        TableMetaData meta=requireMetadata(r); validateColumns(meta,r); ColumnMetaData key=meta.primaryKey();
        if(key==null)throw new IllegalArgumentException("No primary key metadata for "+meta.qualifiedName());
        Object value=r.get(key.name); if(value==null)throw new IllegalArgumentException("record key must not be null: "+key.name);
        return deleteFrom(meta.qualifiedName()).where(col(key.name).eq(value)).execute(c);
    }
    private static TableMetaData requireMetadata(DynamicRecord r){if(r.getTableMetaData()==null)throw new IllegalArgumentException("DynamicRecord table metadata must not be null");return r.getTableMetaData();}
    private static void validateColumns(TableMetaData meta,BasicRecord r){for(String name:r.keySet())if(meta.column(name)==null)throw new IllegalArgumentException("Unknown column '"+name+"' for table "+meta.qualifiedName());}
    private static Class<? extends BasicRecord> recordType(BasicRecord r){@SuppressWarnings("unchecked") Class<? extends BasicRecord> type=(Class<? extends BasicRecord>)r.getClass();return type;}
    private static void requireRecord(BasicRecord r){if(r==null)throw new IllegalArgumentException("record must not be null");}
    private static void requireKeyColumn(String c){if(c==null||c.isBlank())throw new IllegalArgumentException("keyColumn must not be blank");}

    public static final class Select {
        private final QLSelect select=new QLSelect();
        public Select column(QLExpr e){select.columns.add(e);return this;} public Select column(String n){return column(col(n));}
        public Select column(String n,String alias){return column(col(n,alias));}
        public Select column(QLSchema s){return column(col(s));}
        public Select columns(QLExpr... e){if(e!=null)select.columns.addAll(Arrays.asList(e));return this;} public Select columns(String... e){if(e!=null)for(String n:e)column(n);return this;}
        public Select distinct(){select.distinct=true;return this;}
        public Select from(QLExpr s){select.from=s;return this;} public Select from(String n){return from(table(n));} public Select from(QLSchema s){return from(table(s));}
        public Select from(Class<? extends BasicRecord> type){return from(QLRecordMetadata.table(type));}
        public Select from(QLSelect s){return from(new QLSubSelect(s));} public Select from(QLSelect s,String alias){return from(new QLSubSelect(s,alias));}
        public Select join(QLExpr s,QLExpr on){return join("INNER",s,on);} public Select join(String t,QLExpr s,QLExpr on){select.joins.add(new QLJoin(t,s,on));return this;}
        public Select join(String table,QLExpr on){return join("INNER",table(table),on);} public Select join(String type,String table,QLExpr on){return join(type,table(table),on);}
        public Select join(QLSelect s,String alias,QLExpr on){return join("INNER",new QLSubSelect(s,alias),on);} public Select join(String type,QLSelect s,String alias,QLExpr on){return join(type,new QLSubSelect(s,alias),on);}
        public Select leftJoin(QLExpr s,QLExpr on){return join("LEFT",s,on);} public Select leftJoin(String s,QLExpr on){return join("LEFT",table(s),on);} public Select rightJoin(QLExpr s,QLExpr on){return join("RIGHT",s,on);} public Select rightJoin(String s,QLExpr on){return join("RIGHT",table(s),on);}
        public Select fullJoin(QLExpr s,QLExpr on){return join("FULL",s,on);} public Select fullJoin(String s,QLExpr on){return join("FULL",table(s),on);} public Select crossJoin(QLExpr s){return join("CROSS",s,null);} public Select crossJoin(String s){return crossJoin(table(s));}
        public Select where(QLExpr e){if(select.where==null)select.where=new QLWhere();select.where.add(e);return this;} public Select and(QLExpr e){return where(e);} public Select or(QLExpr e){return where(e);}
        public Select groupBy(QLExpr... e){if(select.groupBy==null)select.groupBy=new QLGroupBy();if(e!=null)select.groupBy.expressions.addAll(Arrays.asList(e));return this;} public Select groupBy(String... e){if(e!=null)for(String n:e)groupBy(col(n));return this;}
        public Select having(QLExpr e){select.having=e;return this;} public Select orderBy(QLExpr e,String d){if(select.orderBy==null)select.orderBy=new QLOrderBy();select.orderBy.add(e,d);return this;} public Select orderBy(String n,String d){return orderBy(col(n),d);}
        public Select orderByAsc(QLExpr e){return orderBy(e,"ASC");} public Select orderByDesc(QLExpr e){return orderBy(e,"DESC");} public Select orderByAsc(String e){return orderByAsc(col(e));} public Select orderByDesc(String e){return orderByDesc(col(e));}
        public Select limit(int v){select.limit=new QLLimit(v);return this;} public Select offset(int v){select.offset=new QLOffset(v);return this;}
        public QLSelect build(){return select;} public QLSql.Result sql(){return QLSql.render(select);}
        public List<BasicRecord> list(Connection c)throws SQLException{return execute(c,BasicRecord.class);} public <T extends BasicRecord>List<T> list(Connection c,Class<T> t)throws SQLException{return execute(c,t);}
        public <T extends BasicRecord>T one(Connection c,Class<T> t)throws SQLException{List<T> r=execute(c,t);if(r.isEmpty())return null;if(r.size()>1)throw new SQLException("Expected one row, got "+r.size());return r.get(0);}
        public <T extends BasicRecord>List<T> execute(Connection c,Class<T> t)throws SQLException{if(c==null)throw new IllegalArgumentException("connection must not be null");QLSql.Result r=sql();try(PreparedStatement s=c.prepareStatement(r.sql())){bind(s,r);try(ResultSet rs=s.executeQuery()){return QLRowMapper.map(rs,t);}}}
    }

    public static final class Insert { private final QLInsert statement; private Insert(String t){statement=new QLInsert(new QLTable(t));} private Insert(QLSchema s){statement=new QLInsert(new QLTable(s));} public Insert columns(String... c){statement.columns(c);return this;} public Insert values(Object... v){statement.values(v);return this;} public Insert row(Map<String,?> v){statement.row(v);return this;} public QLInsert build(){return statement;} public QLSql.Result sql(){return QLSql.render(statement);} public int execute(Connection c)throws SQLException{return executeUpdate(c,sql());} }
    public static final class Update { private final QLUpdate statement; private Update(String t){statement=new QLUpdate(new QLTable(t));} private Update(QLSchema s){statement=new QLUpdate(new QLTable(s));} public Update set(String c,Object v){statement.set(c,v);return this;} public Update set(Map<String,?> v){v.forEach(statement::set);return this;} public Update where(QLExpr e){statement.where(e);return this;} public QLUpdate build(){return statement;} public QLSql.Result sql(){return QLSql.render(statement);} public int execute(Connection c)throws SQLException{return executeUpdate(c,sql());} }
    public static final class Delete { private final QLDelete statement; private Delete(String t){statement=new QLDelete(new QLTable(t));} private Delete(QLSchema s){statement=new QLDelete(new QLTable(s));} public Delete where(QLExpr e){statement.where(e);return this;} public QLDelete build(){return statement;} public QLSql.Result sql(){return QLSql.render(statement);} public int execute(Connection c)throws SQLException{return executeUpdate(c,sql());} }
    private static int executeUpdate(Connection c,QLSql.Result r)throws SQLException{if(c==null)throw new IllegalArgumentException("connection must not be null");try(PreparedStatement s=c.prepareStatement(r.sql())){bind(s,r);return s.executeUpdate();}}
    private static void bind(PreparedStatement s,QLSql.Result r)throws SQLException{for(int i=0;i<r.parameters().size();i++)s.setObject(i+1,r.parameters().get(i));}
}
