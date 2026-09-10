package cz.burios.qpx.darwin.db.uniql;

/** Explicit parentheses around any SQL expression. */
public class QLBrackets extends QLExpr {
    public QLExpr expression;
    public String alias;
    public QLBrackets() {}
    public QLBrackets(QLExpr expression) { this.expression = expression; }
    public QLBrackets as(String alias) { this.alias = alias; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
