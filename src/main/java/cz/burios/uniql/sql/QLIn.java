package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLIn extends QLExpr {
    public QLExpr expression;
    public List<QLExpr> values = new ArrayList<>();
    public QLExpr subSelect;
    public boolean negated;
    public QLIn() {}
    public QLIn(QLExpr expression, Object... values) {
        this.expression = expression;
        if (values != null) for (Object value : values) this.values.add(QLExprs.expr(value));
    }
    public QLIn not() { negated = true; return this; }
    public QLIn select(QLExpr subSelect) { this.subSelect = subSelect; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
