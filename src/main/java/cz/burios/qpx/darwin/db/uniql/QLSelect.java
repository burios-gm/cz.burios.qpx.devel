package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLSelect extends QLExpr {
    public boolean distinct;
    public List<QLColumn> columns = new ArrayList<>();
    public QLTable from;
    public List<QLJoin> joins = new ArrayList<>();
    public QLWhere where;
    public QLGroupBy groupBy;
    public QLOrderBy orderBy;
    public QLLimit limit;
    public QLOffset offset;
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
