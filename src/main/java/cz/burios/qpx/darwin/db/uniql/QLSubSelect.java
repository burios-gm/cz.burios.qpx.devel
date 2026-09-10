package cz.burios.qpx.darwin.db.uniql;

public class QLSubSelect extends QLExpr {
    public QLSelect select;
    public String alias;

    public QLSubSelect() {}
    public QLSubSelect(QLSelect select) { this.select = select; }
    public QLSubSelect(QLSelect select, String alias) { this.select = select; this.alias = alias; }
    public QLSubSelect as(String alias) { this.alias = alias; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
