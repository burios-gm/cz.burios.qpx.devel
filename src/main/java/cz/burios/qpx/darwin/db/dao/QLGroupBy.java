package cz.burios.qpx.darwin.db.dao;

import java.util.ArrayList;
import java.util.List;

public final class QLGroupBy extends QLExpr {
    private List<QLExpr> columns = new ArrayList<>();
    public QLGroupBy() {}
    public QLGroupBy(QLExpr... columns) { for (QLExpr c : columns) this.columns.add(c); }
    public List<QLExpr> getColumns() { return columns; }
    public void setColumns(List<QLExpr> columns) { this.columns = columns == null ? new ArrayList<>() : columns; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
