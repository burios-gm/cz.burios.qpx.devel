package cz.burios.qpx.darwin.db.dao;

public final class QLOffset extends QLExpr {
    private int value;
    public QLOffset() {}
    public QLOffset(int value) { this.value = value; }
    public int getValue() { return value; }
    public void setValue(int value) { this.value = value; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
