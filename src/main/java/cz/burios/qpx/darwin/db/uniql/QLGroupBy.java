package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class QLGroupBy extends QLExpr {
    public List<QLExpr> expressions = new ArrayList<>();
    public QLGroupBy() {}
    public QLGroupBy(QLExpr... expressions) {
        if (expressions != null) this.expressions.addAll(Arrays.asList(expressions));
    }
    public QLGroupBy add(QLExpr expression) { expressions.add(expression); return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
