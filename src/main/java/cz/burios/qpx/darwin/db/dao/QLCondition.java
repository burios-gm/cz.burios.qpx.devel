package cz.burios.qpx.darwin.db.dao;

public final class QLCondition extends QLExpr {
    private QLExpr left;
    private String operator;
    private QLExpr right;

    public QLCondition() {}
    public QLCondition(QLExpr left, String operator, QLExpr right) {
        this.left = left; this.operator = operator; this.right = right;
    }
    public QLExpr getLeft() { return left; }
    public void setLeft(QLExpr left) { this.left = left; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public QLExpr getRight() { return right; }
    public void setRight(QLExpr right) { this.right = right; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
