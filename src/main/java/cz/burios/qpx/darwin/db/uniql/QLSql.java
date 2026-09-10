package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class QLSql implements QLVisitor {
    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*(\\.[A-Za-z_][A-Za-z0-9_$]*|\\.\\*)*");
    private static final Pattern ALIAS = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> parameters = new ArrayList<>();

    public static Result render(QLSelect select) {
        if (select == null) throw new IllegalArgumentException("select must not be null");
        QLSql visitor = new QLSql();
        select.accept(visitor);
        return new Result(visitor.sql.toString(), List.copyOf(visitor.parameters));
    }

    public record Result(String sql, List<Object> parameters) {}

    private void expr(QLExpr expression) {
        if (expression == null) throw new IllegalArgumentException("SQL expression must not be null");
        expression.accept(this);
    }

    private static void identifier(String value, String kind) {
        if (value == null || !IDENTIFIER.matcher(value).matches())
            throw new IllegalArgumentException("Invalid " + kind + ": " + value);
    }

    private static void alias(String value) {
        if (value != null && !ALIAS.matcher(value).matches())
            throw new IllegalArgumentException("Invalid SQL alias: " + value);
    }

    private static String operator(String value) {
        if (value == null) throw new IllegalArgumentException("Condition operator is required");
        String op = value.trim().toUpperCase();
        return switch (op) {
            case "=", "<>", "!=", "<", "<=", ">", ">=", "LIKE", "NOT LIKE", "IS", "IS NOT", "IN", "NOT IN", "BETWEEN", "NOT BETWEEN", "AND", "OR" -> op;
            default -> throw new IllegalArgumentException("Unsupported SQL operator: " + value);
        };
    }

    public void visit(QLSelect e) {
        sql.append("SELECT ");
        if (e.distinct) sql.append("DISTINCT ");
        if (e.columns.isEmpty()) sql.append('*');
        else for (int i = 0; i < e.columns.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.columns.get(i));
        }
        if (e.from == null) throw new IllegalStateException("SELECT requires FROM");
        sql.append(" FROM ");
        expr(e.from);
        for (QLJoin join : e.joins) { sql.append(' '); expr(join); }
        if (e.where != null && !e.where.expressions.isEmpty()) { sql.append(" WHERE "); expr(e.where); }
        if (e.groupBy != null && !e.groupBy.expressions.isEmpty()) { sql.append(" GROUP BY "); expr(e.groupBy); }
        if (e.orderBy != null && !e.orderBy.items.isEmpty()) { sql.append(" ORDER BY "); expr(e.orderBy); }
        if (e.limit != null) { sql.append(" LIMIT "); expr(e.limit); }
        if (e.offset != null) { sql.append(" OFFSET "); expr(e.offset); }
    }

    public void visit(QLColumn e) {
        identifier(e.name, "column");
        sql.append(e.name);
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    public void visit(QLTable e) {
        identifier(e.name, "table");
        sql.append(e.name);
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    public void visit(QLJoin e) {
        String type = e.type == null ? "INNER" : e.type.trim().toUpperCase();
        if (!switch (type) { case "INNER", "LEFT", "RIGHT", "FULL", "CROSS" -> true; default -> false; })
            throw new IllegalArgumentException("Unsupported JOIN type: " + e.type);
        sql.append(type).append(" JOIN ");
        expr(e.table);
        if (e.on != null) { sql.append(" ON "); expr(e.on); }
    }

    public void visit(QLWhere e) {
        for (int i = 0; i < e.expressions.size(); i++) {
            if (i > 0) sql.append(" AND ");
            sql.append('('); expr(e.expressions.get(i)); sql.append(')');
        }
    }

    public void visit(QLCondition e) {
        sql.append('(');
        expr(e.left);
        sql.append(' ').append(operator(e.operator)).append(' ');
        expr(e.right);
        sql.append(')');
    }

    public void visit(QLValue e) { sql.append('?'); parameters.add(e.value); }

    public void visit(QLFunction e) {
        identifier(e.name, "function");
        sql.append(e.name).append('(');
        for (int i = 0; i < e.arguments.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.arguments.get(i));
        }
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    public void visit(QLSubSelect e) {
        if (e.select == null) throw new IllegalStateException("Subselect requires SELECT");
        sql.append('(');
        e.select.accept(this);
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    public void visit(QLGroupBy e) {
        for (int i = 0; i < e.expressions.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.expressions.get(i));
        }
    }

    public void visit(QLOrderBy e) {
        for (int i = 0; i < e.items.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.items.get(i).expression);
            String direction = e.items.get(i).direction == null ? "ASC" : e.items.get(i).direction.trim().toUpperCase();
            if (!direction.equals("ASC") && !direction.equals("DESC")) throw new IllegalArgumentException("Unsupported ORDER BY direction: " + direction);
            sql.append(' ').append(direction);
        }
    }

    public void visit(QLLimit e) {
        if (e.value < 0) throw new IllegalArgumentException("LIMIT must not be negative");
        sql.append(e.value);
    }

    public void visit(QLOffset e) {
        if (e.value < 0) throw new IllegalArgumentException("OFFSET must not be negative");
        sql.append(e.value);
    }
}
