package cz.burios.qpx.darwin.db.uniql;

public class QLCondition extends QLExpr {
    public QLExpr left;
    public String operator;
    public QLExpr right;
    public QLCondition() {}
    public QLCondition(QLExpr left, String operator, QLExpr right) { this.left=left; this.operator=operator; this.right=right; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
