package cz.burios.qpx.darwin.db.dao;

import java.util.ArrayList;
import java.util.List;

public final class QLWhere extends QLExpr {
    private List<QLExpr> conditions = new ArrayList<>();

    public QLWhere() {}
    public QLWhere(QLExpr condition) { conditions.add(condition); }
    public List<QLExpr> getConditions() { return conditions; }
    public void setConditions(List<QLExpr> conditions) { this.conditions = conditions == null ? new ArrayList<>() : conditions; }
    public QLWhere add(QLExpr condition) { conditions.add(condition); return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
