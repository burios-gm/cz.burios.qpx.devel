package cz.burios.qpx.darwin.db.dao;

public final class QLLimit extends QLExpr {
    private int value;
    public QLLimit() {}
    public QLLimit(int value) { this.value = value; }
    public int getValue() { return value; }
    public void setValue(int value) { this.value = value; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
