package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class QLWhere extends QLExpr {
    public List<QLExpr> expressions = new ArrayList<>();

    public QLWhere() {}
    public QLWhere(QLExpr... expressions) {
        if (expressions != null) this.expressions.addAll(Arrays.asList(expressions));
    }
    public QLWhere add(QLExpr expression) { expressions.add(expression); return this; }
    public QLWhere and(QLExpr expression) { return add(expression); }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
