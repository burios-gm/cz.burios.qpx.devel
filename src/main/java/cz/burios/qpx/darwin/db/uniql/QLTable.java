package cz.burios.qpx.darwin.db.uniql;

public class QLTable extends QLExpr {
    public String name;
    public String alias;
    public QLTable() {}
    public QLTable(String name) { this.name = name; }
    public QLTable(QLSchema schema) { this.name = schema.asTable().sqlName(); }
    public QLTable as(String alias) { this.alias = alias; return this; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
