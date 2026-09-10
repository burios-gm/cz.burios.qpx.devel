package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLSelect extends QLExpr {
    public boolean distinct;
    public List<QLExpr> columns = new ArrayList<>();
    public QLExpr from;
    public List<QLJoin> joins = new ArrayList<>();
    public QLWhere where;
    public QLGroupBy groupBy;
    public QLExpr having;
    public QLOrderBy orderBy;
    public QLLimit limit;
    public QLOffset offset;
    public String alias;

    public QLSelect as(String alias) { this.alias = alias; return this; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
