package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** SQL function call, e.g. COUNT(id) or COALESCE(name, 'unknown'). */
public class QLFunction extends QLExpr {
    public String name;
    public List<QLExpr> arguments = new ArrayList<>();
    public String alias;
    public boolean distinct;

    public QLFunction() {}
    public QLFunction(String name, QLExpr... arguments) {
        this.name = name;
        if (arguments != null) this.arguments.addAll(Arrays.asList(arguments));
    }
    public QLFunction as(String alias) { this.alias = alias; return this; }
    public QLFunction distinct() { this.distinct = true; return this; }
    public QLFunction arg(Object value) { this.arguments.add(QLExprs.expr(value)); return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
