package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLWhere extends QLExpr {
    public List<QLCondition> conditions = new ArrayList<>();
    public QLWhere() {}
    public QLWhere(List<QLCondition> conditions) { if (conditions != null) this.conditions.addAll(conditions); }
    public QLWhere add(QLCondition condition) { conditions.add(condition); return this; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
