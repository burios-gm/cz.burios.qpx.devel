package cz.burios.qpx.darwin.db.uniql;

/** Binary SQL arithmetic expression: a + b, a * b, ... */
public class QLExpression extends QLExpr {
    public QLExpr left;
    public String operator;
    public QLExpr right;

    public QLExpression() {}
    public QLExpression(QLExpr left, String operator, QLExpr right) {
        this.left = left; this.operator = operator; this.right = right;
    }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
