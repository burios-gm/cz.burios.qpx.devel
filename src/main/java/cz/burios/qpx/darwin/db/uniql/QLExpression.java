package cz.burios.qpx.darwin.db.uniql;

/** Binary SQL arithmetic expression: a + b, a * b, ... */
public class QLExpression extends QLExpr {
    public QLExpr left;
    public String operator;
    public QLExpr right;
    public String alias;

    public QLExpression() {}
    public QLExpression(QLExpr left, String operator, QLExpr right) {
        this.left = left; this.operator = operator; this.right = right;
    }
    public QLExpression as(String alias) { this.alias = alias; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
