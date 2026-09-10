package cz.burios.qpx.darwin.db.uniql;

import java.util.LinkedHashMap;
import java.util.Map;

public class QLUpdate extends QLStatement {
    public QLExpr table;
    public Map<String, QLExpr> values = new LinkedHashMap<>();
    public QLExpr where;
    public QLUpdate() {}
    public QLUpdate(QLExpr table) { this.table = table; }
    public QLUpdate set(String column, Object value) { values.put(column, QLExpr.toExpr(value)); return this; }
    public QLUpdate where(QLExpr expression) { this.where = expression; return this; }

    /** Render this UPDATE statement as SQL with '?' parameter placeholders. */
    public String toSQL() { return QLSql.render(this).sql(); }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
