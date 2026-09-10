package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class QLSql implements QLVisitor {
    private static final Pattern IDENTIFIER = Pattern.compile("(?:\\*|[A-Za-z_][A-Za-z0-9_$]*(\\.[A-Za-z_][A-Za-z0-9_$]*|\\.\\*)*)");
    private static final Pattern ALIAS = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> parameters = new ArrayList<>();
    public static Result render(QLSelect select) { if(select==null)throw new IllegalArgumentException("select must not be null");QLSql v=new QLSql();select.accept(v);return new Result(v.sql.toString(),List.copyOf(v.parameters)); }
    public record Result(String sql,List<Object> parameters){}
    private void expr(QLExpr e){if(e==null)throw new IllegalArgumentException("SQL expression must not be null");e.accept(this);}
    private static void identifier(String v,String kind){if(v==null||!IDENTIFIER.matcher(v).matches())throw new IllegalArgumentException("Invalid "+kind+": "+v);}
    private static void alias(String v){if(v!=null&&!ALIAS.matcher(v).matches())throw new IllegalArgumentException("Invalid SQL alias: "+v);}
    private static String op(String v){if(v==null)throw new IllegalArgumentException("SQL operator is required");String x=v.trim().toUpperCase();return switch(x){case"=","<>","!=","<","<=",">",">=","LIKE","NOT LIKE","IS","IS NOT","AND","OR"->x;default->throw new IllegalArgumentException("Unsupported SQL operator: "+v);};}
    private static String arithmetic(String v){return switch(v==null?"":v.trim()){case"+","-","*","/","%"->v.trim();default->throw new IllegalArgumentException("Unsupported arithmetic operator: "+v);};}
    @Override public void visit(QLSelect e){sql.append("SELECT ");if(e.distinct)sql.append("DISTINCT ");if(e.columns.isEmpty())sql.append('*');else for(int i=0;i<e.columns.size();i++){if(i>0)sql.append(", ");expr(e.columns.get(i));}if(e.from==null)throw new IllegalStateException("SELECT requires FROM");sql.append(" FROM ");expr(e.from);for(QLJoin j:e.joins){sql.append(' ');expr(j);}if(e.where!=null&&!e.where.expressions.isEmpty()){sql.append(" WHERE ");expr(e.where);}if(e.groupBy!=null&&!e.groupBy.expressions.isEmpty()){sql.append(" GROUP BY ");expr(e.groupBy);}if(e.orderBy!=null&&!e.orderBy.items.isEmpty()){sql.append(" ORDER BY ");expr(e.orderBy);}if(e.limit!=null){sql.append(" LIMIT ");expr(e.limit);}if(e.offset!=null){sql.append(" OFFSET ");expr(e.offset);}}
    @Override public void visit(QLColumn e){identifier(e.name,"column");sql.append(e.name);alias(e.alias);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLTable e){identifier(e.name,"table");sql.append(e.name);alias(e.alias);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLJoin e){String t=e.type==null?"INNER":e.type.trim().toUpperCase();if(!switch(t){case"INNER","LEFT","RIGHT","FULL","CROSS"->true;default->false;})throw new IllegalArgumentException("Unsupported JOIN type: "+e.type);sql.append(t).append(" JOIN ");expr(e.table);if(e.on!=null){sql.append(" ON ");expr(e.on);}}
    @Override public void visit(QLWhere e){for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(" AND ");sql.append('(');expr(e.expressions.get(i));sql.append(')');}}
    @Override public void visit(QLCondition e){sql.append('(');expr(e.left);sql.append(' ').append(op(e.operator)).append(' ');expr(e.right);sql.append(')');}
    @Override public void visit(QLLogical e){String x=op(e.operator);if(!x.equals("AND")&&!x.equals("OR"))throw new IllegalArgumentException("Logical operator must be AND or OR");sql.append('(');for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(' ').append(x).append(' ');expr(e.expressions.get(i));}sql.append(')');}
    @Override public void visit(QLValue e){sql.append('?');parameters.add(e.value);}
    @Override public void visit(QLFunction e){identifier(e.name,"function");sql.append(e.name).append('(');for(int i=0;i<e.arguments.size();i++){if(i>0)sql.append(", ");expr(e.arguments.get(i));}sql.append(')');alias(e.alias);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLExpression e){sql.append('(');expr(e.left);sql.append(' ').append(arithmetic(e.operator)).append(' ');expr(e.right);sql.append(')');}
    @Override public void visit(QLBrackets e){sql.append('(');expr(e.expression);sql.append(')');}
    @Override public void visit(QLSubSelect e){if(e.select==null)throw new IllegalStateException("Subselect requires SELECT");sql.append('(');e.select.accept(this);sql.append(')');alias(e.alias);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    @Override public void visit(QLIn e){sql.append('(');expr(e.expression);sql.append(e.negated?" NOT IN (":" IN (");if(e.subSelect!=null)expr(e.subSelect);else for(int i=0;i<e.values.size();i++){if(i>0)sql.append(", ");expr(e.values.get(i));}sql.append("))");}
    @Override public void visit(QLBetween e){sql.append('(');expr(e.expression);sql.append(e.negated?" NOT BETWEEN ":" BETWEEN ");expr(e.lower);sql.append(" AND ");expr(e.upper);sql.append(')');}
    @Override public void visit(QLIsNull e){sql.append('(');expr(e.expression);sql.append(e.negated?" IS NOT NULL)":" IS NULL)");}
    @Override public void visit(QLGroupBy e){for(int i=0;i<e.expressions.size();i++){if(i>0)sql.append(", ");expr(e.expressions.get(i));}}
    @Override public void visit(QLOrderBy e){for(int i=0;i<e.items.size();i++){if(i>0)sql.append(", ");expr(e.items.get(i).expression);String d=e.items.get(i).direction==null?"ASC":e.items.get(i).direction.trim().toUpperCase();if(!d.equals("ASC")&&!d.equals("DESC"))throw new IllegalArgumentException("Unsupported ORDER BY direction: "+d);sql.append(' ').append(d);}}
    @Override public void visit(QLLimit e){if(e.value<0)throw new IllegalArgumentException("LIMIT must not be negative");sql.append(e.value);}
    @Override public void visit(QLOffset e){if(e.value<0)throw new IllegalArgumentException("OFFSET must not be negative");sql.append(e.value);}
}
