package cz.burios.qpx.darwin.db.uniql;

/** SQL EXISTS / NOT EXISTS predicate. */
public class QLExists extends QLExpr {
    public QLExpr subSelect;
    public boolean negated;

    public QLExists() {}
    public QLExists(QLExpr subSelect) { this.subSelect = subSelect; }
    public QLExists(QLSelect select) { this.subSelect = new QLSubSelect(select); }
    public QLExists not() { this.negated = true; return this; }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
