package cz.burios.qpx.darwin.db.uniql;

public class QLColumn extends QLExpr {
    public String name;
    public String alias;
    public QLColumn() {}
    public QLColumn(String name) { this.name = name; }
    public QLColumn(QLSchema schema) { this.name = schema.asColumn(schema.column).sqlName(); }
    public QLColumn(String name, String alias) { this.name = name; this.alias = alias; }
    public QLColumn as(String alias) { this.alias = alias; return this; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
