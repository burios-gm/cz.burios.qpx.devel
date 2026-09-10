package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

/** SQL CASE expression. */
public class QLCase extends QLExpr {
    public QLExpr operand;
    public List<When> whens = new ArrayList<>();
    public QLExpr otherwise;
    public String alias;

    public static class When {
        public QLExpr condition;
        public QLExpr result;
        public When() {}
        public When(QLExpr condition, QLExpr result) {
            this.condition = condition;
            this.result = result;
        }
    }

    public QLCase() {}
    public QLCase(QLExpr operand) { this.operand = operand; }

    public QLCase when(QLExpr condition, Object result) {
        whens.add(new When(condition, QLExprs.expr(result)));
        return this;
    }
    public QLCase elseValue(Object value) {
        otherwise = QLExprs.expr(value);
        return this;
    }
    public QLCase as(String alias) { this.alias = alias; return this; }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
