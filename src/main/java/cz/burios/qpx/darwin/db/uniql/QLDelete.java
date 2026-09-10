package cz.burios.qpx.darwin.db.uniql;

public class QLDelete extends QLStatement {
    public QLExpr table;
    public QLExpr where;
    public QLDelete() {}
    public QLDelete(QLExpr table) { this.table = table; }
    public QLDelete where(QLExpr expression) { this.where = expression; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
