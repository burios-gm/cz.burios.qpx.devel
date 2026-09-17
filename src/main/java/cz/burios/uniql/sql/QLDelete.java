package cz.burios.qpx.darwin.db.uniql;

public class QLDelete extends QLStatement {
    public QLExpr table;
    public QLExpr where;
    public QLDelete() {}
    public QLDelete(QLExpr table) { this.table = table; }
    public QLDelete where(QLExpr expression) { this.where = expression; return this; }

    /** Render this DELETE statement as SQL with '?' parameter placeholders. */
    public String toSQL() { return QLSql.render(this).sql(); }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
