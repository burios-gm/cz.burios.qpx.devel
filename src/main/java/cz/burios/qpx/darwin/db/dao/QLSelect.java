package cz.burios.qpx.darwin.db.dao;

import java.util.ArrayList;
import java.util.List;

public final class QLSelect extends QLExpr {
    private boolean distinct;
    private List<QLColumn> columns = new ArrayList<>();
    private QLTable from;
    private List<QLJoin> joins = new ArrayList<>();
    private QLWhere where;
    private QLGroupBy groupBy;
    private QLOrderBy orderBy;
    private QLLimit limit;
    private QLOffset offset;

    public QLSelect() {}
    public QLSelect(QLTable from) { this.from = from; }
    public boolean isDistinct() { return distinct; }
    public void setDistinct(boolean distinct) { this.distinct = distinct; }
    public List<QLColumn> getColumns() { return columns; }
    public void setColumns(List<QLColumn> columns) { this.columns = columns == null ? new ArrayList<>() : columns; }
    public QLTable getFrom() { return from; }
    public void setFrom(QLTable from) { this.from = from; }
    public List<QLJoin> getJoins() { return joins; }
    public void setJoins(List<QLJoin> joins) { this.joins = joins == null ? new ArrayList<>() : joins; }
    public QLWhere getWhere() { return where; }
    public void setWhere(QLWhere where) { this.where = where; }
    public QLGroupBy getGroupBy() { return groupBy; }
    public void setGroupBy(QLGroupBy groupBy) { this.groupBy = groupBy; }
    public QLOrderBy getOrderBy() { return orderBy; }
    public void setOrderBy(QLOrderBy orderBy) { this.orderBy = orderBy; }
    public QLLimit getLimit() { return limit; }
    public void setLimit(QLLimit limit) { this.limit = limit; }
    public QLOffset getOffset() { return offset; }
    public void setOffset(QLOffset offset) { this.offset = offset; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
