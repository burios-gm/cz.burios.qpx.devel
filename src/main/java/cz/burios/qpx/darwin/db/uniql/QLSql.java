package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Visitor which renders the SELECT AST to parameterized SQL. */
public final class QLSql implements QLVisitor {
    private static final Pattern IDENTIFIER = Pattern.compile("(?:\\*|[A-Za-z_][A-Za-z0-9_$]*(\\.[A-Za-z_][A-Za-z0-9_$]*|\\.\\*)*)");
    private static final Pattern NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");
    private static final Pattern ALIAS = NAME;

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
        if (value == null || !IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("Invalid " + kind + ": " + value);
        }
    }

    private static void name(String value, String kind) {
        if (value == null || !NAME.matcher(value).matches()) {
            throw new IllegalArgumentException("Invalid " + kind + ": " + value);
        }
    }

    private static void alias(String value) {
        if (value != null && !ALIAS.matcher(value).matches()) {
            throw new IllegalArgumentException("Invalid SQL alias: " + value);
        }
    }

    private static String arithmetic(String value) {
        return switch (value == null ? "" : value.trim()) {
            case "+", "-", "*", "/", "%" -> value.trim();
            default -> throw new IllegalArgumentException("Unsupported arithmetic operator: " + value);
        };
    }

    private static String comparison(String value) {
        return switch (value == null ? "" : value.trim().toUpperCase()) {
            case "=", "<>", "!=", ">", ">=", "<", "<=", "LIKE", "NOT LIKE" -> value.trim().toUpperCase();
            default -> throw new IllegalArgumentException("Unsupported comparison operator: " + value);
        };
    }

    @Override public void visit(QLSelect e) {
        sql.append("SELECT ");
        if (e.distinct) sql.append("DISTINCT ");
        if (e.columns.isEmpty()) sql.append('*');
        else for (int i = 0; i < e.columns.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.columns.get(i));
        }
        if (e.from != null) {
            sql.append(" FROM ");
            expr(e.from);
        }
        for (QLJoin join : e.joins) {
            sql.append(' ');
            expr(join);
        }
        if (e.where != null && !e.where.expressions.isEmpty()) {
            sql.append(" WHERE ");
            expr(e.where);
        }
        if (e.groupBy != null && !e.groupBy.expressions.isEmpty()) {
            sql.append(" GROUP BY ");
            expr(e.groupBy);
        }
        if (e.having != null) {
            sql.append(" HAVING ");
            expr(e.having);
        }
        if (e.orderBy != null && !e.orderBy.items.isEmpty()) {
            sql.append(" ORDER BY ");
            expr(e.orderBy);
        }
        if (e.limit != null) {
            sql.append(" LIMIT ");
            expr(e.limit);
        }
        if (e.offset != null) {
            sql.append(" OFFSET ");
            expr(e.offset);
        }
    }

    @Override public void visit(QLColumn e) {
        identifier(e.name, "column");
        sql.append(e.name);
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLTable e) {
        identifier(e.name, "table");
        sql.append(e.name);
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLJoin e) {
        String type = e.type == null ? "INNER" : e.type.trim().toUpperCase();
        if (!switch (type) { case "INNER", "LEFT", "RIGHT", "FULL", "CROSS" -> true; default -> false; }) {
            throw new IllegalArgumentException("Unsupported JOIN type: " + e.type);
        }
        sql.append(type).append(" JOIN ");
        expr(e.table);
        if (e.on != null) {
            sql.append(" ON ");
            expr(e.on);
        }
    }

    @Override public void visit(QLWhere e) {
        for (int i = 0; i < e.expressions.size(); i++) {
            if (i > 0) sql.append(" AND ");
            expr(e.expressions.get(i));
        }
    }

    @Override public void visit(QLCondition e) {
        sql.append('(');
        expr(e.left);
        sql.append(' ').append(comparison(e.operator)).append(' ');
        expr(e.right);
        sql.append(')');
    }

    @Override public void visit(QLLogical e) {
        String operator = e.operator == null ? "" : e.operator.trim().toUpperCase();
        if (operator.equals("NOT")) {
            if (e.expressions.size() != 1) throw new IllegalArgumentException("NOT requires one expression");
            sql.append("(NOT ");
            expr(e.expressions.get(0));
            sql.append(')');
            return;
        }
        if (!operator.equals("AND") && !operator.equals("OR")) {
            throw new IllegalArgumentException("Logical operator must be AND, OR or NOT");
        }
        sql.append('(');
        for (int i = 0; i < e.expressions.size(); i++) {
            if (i > 0) sql.append(' ').append(operator).append(' ');
            expr(e.expressions.get(i));
        }
        sql.append(')');
    }

    @Override public void visit(QLValue e) {
        sql.append('?');
        parameters.add(e.value);
    }

    @Override public void visit(QLFunction e) {
        name(e.name, "function");
        sql.append(e.name).append('(');
        if (e.distinct) sql.append("DISTINCT ");
        for (int i = 0; i < e.arguments.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.arguments.get(i));
        }
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLExpression e) {
        sql.append('(');
        expr(e.left);
        sql.append(' ').append(arithmetic(e.operator)).append(' ');
        expr(e.right);
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLBrackets e) {
        sql.append('(');
        expr(e.expression);
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLSubSelect e) {
        if (e.select == null) throw new IllegalStateException("Subselect requires SELECT");
        sql.append('(');
        e.select.accept(this);
        sql.append(')');
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLIn e) {
        sql.append('(');
        expr(e.expression);
        sql.append(e.negated ? " NOT IN (" : " IN (");
        if (e.subSelect != null) expr(e.subSelect);
        else for (int i = 0; i < e.values.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.values.get(i));
        }
        sql.append("))");
    }

    @Override public void visit(QLBetween e) {
        sql.append('(');
        expr(e.expression);
        sql.append(e.negated ? " NOT BETWEEN " : " BETWEEN ");
        expr(e.lower);
        sql.append(" AND ");
        expr(e.upper);
        sql.append(')');
    }

    @Override public void visit(QLIsNull e) {
        sql.append('(');
        expr(e.expression);
        sql.append(e.negated ? " IS NOT NULL)" : " IS NULL)");
    }

    @Override public void visit(QLExists e) {
        sql.append('(').append(e.negated ? "NOT EXISTS " : "EXISTS ");
        expr(e.subSelect);
        sql.append(')');
    }

    @Override public void visit(QLCase e) {
        sql.append("CASE");
        if (e.operand != null) {
            sql.append(' ');
            expr(e.operand);
        }
        for (QLCase.When w : e.whens) {
            sql.append(" WHEN ");
            expr(w.condition);
            sql.append(" THEN ");
            expr(w.result);
        }
        if (e.otherwise != null) {
            sql.append(" ELSE ");
            expr(e.otherwise);
        }
        sql.append(" END");
        alias(e.alias);
        if (e.alias != null && !e.alias.isBlank()) sql.append(" AS ").append(e.alias);
    }

    @Override public void visit(QLGroupBy e) {
        for (int i = 0; i < e.expressions.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.expressions.get(i));
        }
    }

    @Override public void visit(QLOrderBy e) {
        for (int i = 0; i < e.items.size(); i++) {
            if (i > 0) sql.append(", ");
            expr(e.items.get(i).expression);
            String direction = e.items.get(i).direction == null ? "ASC" : e.items.get(i).direction.trim().toUpperCase();
            if (!direction.equals("ASC") && !direction.equals("DESC")) {
                throw new IllegalArgumentException("Unsupported ORDER BY direction: " + direction);
            }
            sql.append(' ').append(direction);
        }
    }

    @Override public void visit(QLLimit e) {
        if (e.value < 0) throw new IllegalArgumentException("LIMIT must not be negative");
        sql.append(e.value);
    }

    @Override public void visit(QLOffset e) {
        if (e.value < 0) throw new IllegalArgumentException("OFFSET must not be negative");
        sql.append(e.value);
    }
}
