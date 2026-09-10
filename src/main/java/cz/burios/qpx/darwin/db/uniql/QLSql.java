package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public final class QLSql implements QLVisitor {
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> parameters = new ArrayList<>();

    public static Result render(QLSelect select) {
        QLSql v = new QLSql();
        select.accept(v);
        return new Result(v.sql.toString(), List.copyOf(v.parameters));
    }
    public record Result(String sql, List<Object> parameters) {}

    private void expr(QLExpr e) { if (e != null) e.accept(this); }
    public void visit(QLSelect e) {
        sql.append("SELECT "); if (e.distinct) sql.append("DISTINCT ");
        if (e.columns.isEmpty()) sql.append('*'); else for (int i=0;i<e.columns.size();i++){ if(i>0)sql.append(", "); expr(e.columns.get(i)); }
        if(e.from==null) throw new IllegalStateException("SELECT requires FROM"); sql.append(" FROM "); expr(e.from);
        for(QLJoin j:e.joins){sql.append(' ');expr(j);} if(e.where!=null){sql.append(" WHERE ");expr(e.where);}
        if(e.groupBy!=null){sql.append(" GROUP BY ");expr(e.groupBy);} if(e.orderBy!=null){sql.append(" ORDER BY ");expr(e.orderBy);}
        if(e.limit!=null){sql.append(" LIMIT ");expr(e.limit);} if(e.offset!=null){sql.append(" OFFSET ");expr(e.offset);}
    }
    public void visit(QLColumn e){sql.append(e.name);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    public void visit(QLTable e){sql.append(e.name);if(e.alias!=null&&!e.alias.isBlank())sql.append(" AS ").append(e.alias);}
    public void visit(QLJoin e){sql.append(e.type).append(" JOIN ");expr(e.table);if(e.on!=null){sql.append(" ON ");expr(e.on);}}
    public void visit(QLWhere e){for(int i=0;i<e.conditions.size();i++){if(i>0)sql.append(" AND ");sql.append('(');expr(e.conditions.get(i));sql.append(')');}}
    public void visit(QLCondition e){expr(e.left);sql.append(' ').append(e.operator).append(' ');expr(e.right);}
    public void visit(QLValue e){sql.append('?');parameters.add(e.value);}
    public void visit(QLGroupBy e){for(int i=0;i<e.columns.size();i++){if(i>0)sql.append(", ");expr(e.columns.get(i));}}
    public void visit(QLOrderBy e){for(int i=0;i<e.items.size();i++){if(i>0)sql.append(", ");expr(e.items.get(i).expression);sql.append(' ').append(e.items.get(i).direction);}}
    public void visit(QLLimit e){sql.append(e.value);}
    public void visit(QLOffset e){sql.append(e.value);}
}
