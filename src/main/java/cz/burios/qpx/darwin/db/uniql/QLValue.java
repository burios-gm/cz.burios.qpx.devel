package cz.burios.qpx.darwin.db.uniql;

public class QLValue extends QLExpr {
    public Object value;
    public QLValue() {}
    public QLValue(Object value) { this.value = value; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
