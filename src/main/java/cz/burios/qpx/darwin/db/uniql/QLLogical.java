package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** SQL boolean expression with arbitrary nesting: AND, OR or NOT. */
public class QLLogical extends QLCondition {
    public List<QLExpr> expressions = new ArrayList<>();

    public QLLogical() {}
    public QLLogical(String operator, QLExpr... expressions) {
        this.operator = operator;
        this.expressions.addAll(Arrays.asList(expressions));
    }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
