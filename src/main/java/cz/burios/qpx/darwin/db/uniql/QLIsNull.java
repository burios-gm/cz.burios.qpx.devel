package cz.burios.qpx.darwin.db.uniql;

public class QLIsNull extends QLExpr {
    public QLExpr expression;
    public boolean negated;
    public QLIsNull() {}
    public QLIsNull(QLExpr expression, boolean negated) { this.expression = expression; this.negated = negated; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
