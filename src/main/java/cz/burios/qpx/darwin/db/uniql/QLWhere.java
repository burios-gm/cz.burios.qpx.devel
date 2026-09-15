package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class QLWhere extends QLExpr {
    public List<QLExpr> expressions = new ArrayList<>();

    public QLWhere() {}
    public QLWhere(QLExpr... expressions) {
        if (expressions != null) this.expressions.addAll(Arrays.asList(expressions));
    }
    public QLWhere add(QLExpr expression) {
        if (expression == null) throw new IllegalArgumentException("WHERE expression must not be null");
        expressions.add(expression);
        return this;
    }
    public QLWhere and(QLExpr expression) { return add(expression); }
    public QLWhere or(QLExpr expression) {
        if (expression == null) throw new IllegalArgumentException("WHERE expression must not be null");
        if (expressions.isEmpty()) {
            expressions.add(expression);
            return this;
        }
        QLExpr left = expressions.size() == 1
                ? expressions.get(0)
                : new QLLogical("AND", expressions.toArray(new QLExpr[0]));
        expressions.clear();
        expressions.add(new QLLogical("OR", left, expression));
        return this;
    }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
