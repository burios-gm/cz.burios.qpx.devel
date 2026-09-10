package cz.burios.qpx.darwin.db.dao;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Renders the QL AST to SQL with JDBC parameters. */
public final class QLSql implements QLVisitor {
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> parameters = new ArrayList<>();

    public static Result render(QLExpr expression) {
        Objects.requireNonNull(expression, "expression");
        QLSql renderer = new QLSql();
        expression.accept(renderer);
        return new Result(renderer.sql.toString(), List.copyOf(renderer.parameters));
    }

    public record Result(String sql, List<Object> parameters) {}

    private void append(QLExpr expr) { if (expr != null) expr.accept(this); }
    private void commaSeparated(List<? extends QLExpr> expressions) {
        for (int i = 0; i < expressions.size(); i++) {
            if (i > 0) sql.append(", ");
            append(expressions.get(i));
        }
    }

    @Override public void visit(QLSelect e) {
        sql.append("SELECT ");
        if (e.isDistinct()) sql.append("DISTINCT ");
        if (e.getColumns().isEmpty()) sql.append('*'); else commaSeparated(e.getColumns());
        if (e.getFrom() == null) throw new IllegalArgumentException("SELECT requires FROM");
        sql.append(" FROM "); append(e.getFrom());
        for (QLJoin join : e.getJoins()) { sql.append(' '); append(join); }
        if (e.getWhere() != null) { sql.append(' '); append(e.getWhere()); }
        if (e.getGroupBy() != null) { sql.append(' '); append(e.getGroupBy()); }
        if (e.getOrderBy() != null) { sql.append(' '); append(e.getOrderBy()); }
        if (e.getLimit() != null) { sql.append(' '); append(e.getLimit()); }
        if (e.getOffset() != null) { sql.append(' '); append(e.getOffset()); }
    }

    @Override public void visit(QLColumn e) {
        sql.append(identifier(e.getName()));
        if (e.getAlias() != null && !e.getAlias().isBlank()) sql.append(" AS ").append(identifier(e.getAlias()));
    }
    @Override public void visit(QLTable e) {
        sql.append(identifier(e.getName()));
        if (e.getAlias() != null && !e.getAlias().isBlank()) sql.append(" AS ").append(identifier(e.getAlias()));
    }
    @Override public void visit(QLJoin e) {
        sql.append(switch (e.getType()) { case INNER -> "INNER JOIN "; case LEFT -> "LEFT JOIN "; case RIGHT -> "RIGHT JOIN "; case FULL -> "FULL JOIN "; case CROSS -> "CROSS JOIN "; });
        append(e.getTable());
        if (e.getType() != QLJoin.Type.CROSS) { if (e.getOn() == null) throw new IllegalArgumentException("JOIN requires ON"); sql.append(" ON "); append(e.getOn()); }
    }
    @Override public void visit(QLWhere e) {
        if (e.getConditions().isEmpty()) return;
        sql.append("WHERE ");
        for (int i = 0; i < e.getConditions().size(); i++) { if (i > 0) sql.append(" AND "); append(e.getConditions().get(i)); }
    }
    @Override public void visit(QLCondition e) {
        sql.append('('); append(e.getLeft()); sql.append(' ').append(operator(e.getOperator())).append(' '); append(e.getRight()); sql.append(')');
    }
    @Override public void visit(QLValue e) { sql.append('?'); parameters.add(e.getValue()); }
    @Override public void visit(QLGroupBy e) { if (!e.getColumns().isEmpty()) { sql.append("GROUP BY "); commaSeparated(e.getColumns()); } }
    @Override public void visit(QLOrderBy e) {
        if (e.getItems().isEmpty()) return;
        sql.append("ORDER BY ");
        for (int i = 0; i < e.getItems().size(); i++) { if (i > 0) sql.append(", "); ItemVisitor(e.getItems().get(i)); }
    }
    private void ItemVisitor(QLOrderBy.Item item) { append(item.getExpression()); sql.append(' ').append(item.getDirection() == null ? QLOrderBy.Direction.ASC : item.getDirection()); }
    @Override public void visit(QLLimit e) { if (e.getValue() < 0) throw new IllegalArgumentException("LIMIT must be >= 0"); sql.append("LIMIT ").append(e.getValue()); }
    @Override public void visit(QLOffset e) { if (e.getValue() < 0) throw new IllegalArgumentException("OFFSET must be >= 0"); sql.append("OFFSET ").append(e.getValue()); }

    private static String operator(String value) {
        String op = Objects.requireNonNull(value, "operator").trim().toUpperCase();
        return switch (op) {
            case "=", "<>", "!=", "<", "<=", ">", ">=", "LIKE", "NOT LIKE", "IS", "IS NOT" -> op;
            default -> throw new IllegalArgumentException("Unsupported SQL operator: " + value);
        };
    }
    private static String identifier(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("SQL identifier is empty");
        // Qualified names are accepted, e.g. u.id. Each part is quoted independently.
        String[] parts = value.split("\\.", -1);
        for (String part : parts) if (!part.matches("[A-Za-z_][A-Za-z0-9_$]*|\\*")) throw new IllegalArgumentException("Invalid SQL identifier: " + value);
        return String.join(".", parts);
    }
}
