package cz.burios.qpx.darwin.db.dao;

public final class QLValue extends QLExpr {
    private Object value;
    public QLValue() {}
    public QLValue(Object value) { this.value = value; }
    public Object getValue() { return value; }
    public void setValue(Object value) { this.value = value; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
