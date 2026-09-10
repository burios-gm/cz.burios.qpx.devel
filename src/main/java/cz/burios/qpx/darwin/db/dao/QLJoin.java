package cz.burios.qpx.darwin.db.dao;

public final class QLJoin extends QLExpr {
    public enum Type { INNER, LEFT, RIGHT, FULL, CROSS }
    private Type type = Type.INNER;
    private QLTable table;
    private QLExpr on;

    public QLJoin() {}
    public QLJoin(Type type, QLTable table, QLExpr on) { this.type = type; this.table = table; this.on = on; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public QLTable getTable() { return table; }
    public void setTable(QLTable table) { this.table = table; }
    public QLExpr getOn() { return on; }
    public void setOn(QLExpr on) { this.on = on; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
