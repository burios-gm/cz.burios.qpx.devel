package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class QLFunction extends QLExpr {
    public String name;
    public List<QLExpr> arguments = new ArrayList<>();
    public String alias;

    public QLFunction() {}
    public QLFunction(String name, QLExpr... arguments) {
        this.name = name;
        if (arguments != null) this.arguments.addAll(Arrays.asList(arguments));
    }
    public QLFunction as(String alias) { this.alias = alias; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
