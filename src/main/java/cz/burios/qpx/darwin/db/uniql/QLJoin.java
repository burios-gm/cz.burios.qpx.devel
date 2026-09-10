package cz.burios.qpx.darwin.db.uniql;

public class QLJoin extends QLExpr {
    public String type = "INNER";
    public QLTable table;
    public QLCondition on;
    public QLJoin() {}
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
