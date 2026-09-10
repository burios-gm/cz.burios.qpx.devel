package cz.burios.qpx.darwin.db.uniql;

public class QLJoin extends QLExpr {
    public String type = "INNER";
    public QLExpr table;
    public QLCondition on;

    public QLJoin() {}
    public QLJoin(String type, QLExpr table, QLCondition on) {
        this.type = type;
        this.table = table;
        this.on = on;
    }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
