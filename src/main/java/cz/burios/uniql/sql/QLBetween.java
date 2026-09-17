package cz.burios.qpx.darwin.db.uniql;

public class QLBetween extends QLExpr {
    public QLExpr expression;
    public QLExpr lower;
    public QLExpr upper;
    public boolean negated;
    public QLBetween() {}
    public QLBetween(QLExpr expression, Object lower, Object upper) {
        this.expression = expression; this.lower = QLExprs.expr(lower); this.upper = QLExprs.expr(upper);
    }
    public QLBetween not() { negated = true; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
