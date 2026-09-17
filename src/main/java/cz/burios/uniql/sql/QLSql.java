package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Visitor which renders parameterized SQL for SELECT and CRUD statements. */
public final class QLSql implements QLVisitor {
    private static final Pattern IDENTIFIER = Pattern.compile("(?:\\*|[A-Za-z_][A-Za-z0-9_$]*(\\.[A-Za-z_][A-Za-z0-9_$]*|\\.[\\*])*)");
    private static final Pattern NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> parameters = new ArrayList<>();
    public static Result render(QLSelect s){return renderExpr(s);}
    public static Result render(QLStatement s){return renderStatement(s);}
    public static Result renderExpr(QLExpr s){if(s==null)throw new IllegalArgumentException("expression must not be null");QLSql v=new QLSql();s.accept(v);return v.result();}
    public static Result renderStatement(QLStatement s){if(s==null)throw new IllegalArgumentException("statement must not be null");QLSql v=new QLSql();s.accept(v);return v.result();}
    private Result result(){return new Result(sql.toString(),List.copyOf(parameters));}
    public record Result(String sql,List<Object> parameters){}
    private void expr(QLExpr e){if(e==null)throw new IllegalArgumentException("SQL expression must not be null");e.accept(this);}
    private static void identifier(String v,String kind){if(v==null||!IDENTIFIER.matcher(v).matches())throw new IllegalArgumentException("Invalid "+kind+": "+v);}
    private static void name(String v,String kind){if(v==null||!NAME.matcher(v).matches())throw new IllegalArgumentException("Invalid "+kind+": "+v);}
    private static void alias(String v){if(v!=null&&!NAME.matcher(v).matches())throw new IllegalArgumentException("Invalid SQL alias: "+v);}
    private static String comparison(String v){return switch(v==null?"":v.trim().toUpperCase()){case"=","<>","!=",">",">=","<","<=","LIKE","NOT LIKE"->v.trim().toUpperCase();default->throw new IllegalArgumentException("Unsupported comparison operator: "+v);};}
    private static String arithmetic(String v){return switch(v==null?"":v.trim()){case"+","-","*","/","%"->v.trim();default->throw new IllegalArgumentException("Unsupported arithmetic operator: "+v);};}

    @Override public void visit(QLSelect e){sql.append("SELECT ");if(e.distinct)sql.append("DISTINCT ");if(e.columns.isEmpty())sql.append('*');else for(int i=0;i<e.columns.size();i++){if(i>0)sql.append(", ");expr(e.columns.get(i));}if(e.from!=null){sql.append(" FROM ");expr(e.from);}for(QLJoin j:e.joins){sql.append(' ');expr(j);}if(e.where!=null&&!e.where.expressions.isEmpty()){sql.append(" WHERE ");expr(e.where);}if(e.groupBy!=null&&!e.groupBy.expressions.isEmpty()){sql.append(" GROUP BY ");expr(e.groupBy);}if(e.having!=null){sql.append(" HAVING ");expr(e.having);}if(e.orderBy!=null&&!e.orderBy.items.isEmpty()){sql.append(" ORDER BY ");expr(e.orderBy);}if(e.limit!=null){sql.append(" LIMIT ");expr(e.limit);}if(e.offset!=null){sql.append(" OFFSET ");expr(e.offset);}}
    @Override public void visit(QLSchema e){sql.append(e.sqlName());}
    @Override public void visit(QLColumn e){identifier(e.name,"column");sql.append(e.name);alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLTable e){identifier(e.name,"table");sql.append(e.name);alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLJoin e){String t=e.type==null?"INNER":e.type.trim().toUpperCase();if(!switch(t){case"INNER","LEFT","RIGHT","FULL","CROSS"->true;default->false;})throw new IllegalArgumentException("Unsupported JOIN type: "+e.type);sql.append(t).append(" JOIN ");expr(e.table);if(e.on!=null){sql.append(" ON ");expr(e.on);}}
    @Override public void visit(QLWhere e){for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(" AND ");expr(e.expressions.get(i));}}
    @Override public void visit(QLCondition e){sql.append('(');expr(e.left);sql.append(' ').append(comparison(e.operator)).append(' ');expr(e.right);sql.append(')');}
    @Override public void visit(QLLogical e){String o=e.operator==null?"":e.operator.trim().toUpperCase();if(o.equals("NOT")){if(e.expressions.size()!=1)throw new IllegalArgumentException("NOT requires one expression");sql.append("(NOT ");expr(e.expressions.get(0));sql.append(')');return;}if(!o.equals("AND")&&!o.equals("OR"))throw new IllegalArgumentException("Logical operator must be AND, OR or NOT");sql.append('(');for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(' ').append(o).append(' ');expr(e.expressions.get(i));}sql.append(')');}
    @Override public void visit(QLValue e){sql.append('?');parameters.add(e.value);}
    @Override public void visit(QLFunction e){name(e.name,"function");sql.append(e.name).append('(');if(e.distinct)sql.append("DISTINCT ");for(int i=0;i<e.arguments.size();i++){if(i>0)sql.append(", ");expr(e.arguments.get(i));}sql.append(')');alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLExpression e){sql.append('(');expr(e.left);sql.append(' ').append(arithmetic(e.operator)).append(' ');expr(e.right);sql.append(')');alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLBrackets e){sql.append('(');expr(e.expression);sql.append(')');alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLSubSelect e){if(e.select==null)throw new IllegalStateException("Subselect requires SELECT");sql.append('(');e.select.accept(this);sql.append(')');alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLIn e){sql.append('(');expr(e.expression);sql.append(e.negated?" NOT IN ":" IN ");if(e.subSelect!=null){expr(e.subSelect);}else{if(e.values.isEmpty())throw new IllegalStateException("IN requires values or subselect");sql.append('(');for(int i=0;i<e.values.size();i++){if(i>0)sql.append(", ");expr(e.values.get(i));}sql.append(')');}sql.append(')');}
    @Override public void visit(QLBetween e){sql.append('(');expr(e.expression);sql.append(e.negated?" NOT BETWEEN ":" BETWEEN ");expr(e.lower);sql.append(" AND ");expr(e.upper);sql.append(')');}
    @Override public void visit(QLIsNull e){sql.append('(');expr(e.expression);sql.append(e.negated?" IS NOT NULL)":" IS NULL)");}
    @Override public void visit(QLExists e){sql.append('(').append(e.negated?"NOT EXISTS ":"EXISTS ");expr(e.subSelect);sql.append(')');}
    @Override public void visit(QLCase e){sql.append("CASE");if(e.operand!=null){sql.append(' ');expr(e.operand);}for(QLCase.When w:e.whens){sql.append(" WHEN ");expr(w.condition);sql.append(" THEN ");expr(w.result);}if(e.otherwise!=null){sql.append(" ELSE ");expr(e.otherwise);}sql.append(" END");alias(e.alias);if(e.alias!=null)sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLGroupBy e){for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(", ");expr(e.expressions.get(i));}}
    @Override public void visit(QLOrderBy e){for(int i=0;i<e.items.size();i++){if(i>0)sql.append(", ");expr(e.items.get(i).expression);String d=e.items.get(i).direction==null?"ASC":e.items.get(i).direction.trim().toUpperCase();if(!d.equals("ASC")&&!d.equals("DESC"))throw new IllegalArgumentException("Unsupported ORDER BY direction: "+d);sql.append(' ').append(d);}}
    @Override public void visit(QLLimit e){if(e.value<0)throw new IllegalArgumentException("LIMIT must not be negative");sql.append(e.value);}
    @Override public void visit(QLOffset e){if(e.value<0)throw new IllegalArgumentException("OFFSET must not be negative");sql.append(e.value);}
    @Override public void visit(QLInsert e){if(!(e.table instanceof QLTable))throw new IllegalArgumentException("INSERT table must be QLTable");sql.append("INSERT INTO ");expr(e.table);if(!e.columns.isEmpty()){sql.append(" (");for(int i=0;i<e.columns.size();i++){if(i>0)sql.append(", ");identifier(e.columns.get(i),"column");sql.append(e.columns.get(i));}sql.append(')');}if(!e.values.isEmpty()){sql.append(" VALUES (");for(int i=0;i<e.values.size();i++){if(i>0)sql.append(", ");expr(e.values.get(i));}sql.append(')');}else if(!e.rows.isEmpty()){List<String> cols=new ArrayList<>(e.rows.get(0).keySet());if(e.columns.isEmpty()){sql.append(" (");for(int i=0;i<cols.size();i++){if(i>0)sql.append(", ");identifier(cols.get(i),"column");sql.append(cols.get(i));}sql.append(')');}sql.append(" VALUES ");for(int r=0;r<e.rows.size();r++){if(r>0)sql.append(", ");sql.append('(');for(int i=0;i<cols.size();i++){if(i>0)sql.append(", ");expr(e.rows.get(r).get(cols.get(i)));}sql.append(')');}}else throw new IllegalStateException("INSERT requires values");}
    @Override public void visit(QLUpdate e){if(!(e.table instanceof QLTable))throw new IllegalArgumentException("UPDATE table must be QLTable");if(e.values.isEmpty())throw new IllegalStateException("UPDATE requires SET values");sql.append("UPDATE ");expr(e.table);sql.append(" SET ");int i=0;for(var entry:e.values.entrySet()){if(i++>0)sql.append(", ");identifier(entry.getKey(),"column");sql.append(entry.getKey()).append(" = ");expr(entry.getValue());}if(e.where!=null){sql.append(" WHERE ");expr(e.where);}}
    @Override public void visit(QLDelete e){if(!(e.table instanceof QLTable))throw new IllegalArgumentException("DELETE table must be QLTable");sql.append("DELETE FROM ");expr(e.table);if(e.where!=null){sql.append(" WHERE ");expr(e.where);}}
}
