package cz.burios.qpx.darwin.db.uniql.dsl;

import cz.burios.qpx.darwin.db.uniql.*;

public final class DSLSelect {
    private DSLSelect() {}

    public static Builder select(QLColumn... columns) {
        Builder b = new Builder();
        if (columns != null) java.util.Collections.addAll(b.select.columns, columns);
        return b;
    }

    public static QLColumn column(String name) { return new QLColumn(name); }
    public static QLTable table(String name) { return new QLTable(name); }
    public static QLValue value(Object value) { return new QLValue(value); }
    public static QLCondition condition(QLExpr left, String operator, QLExpr right) { return new QLCondition(left, operator, right); }

    public static final class Builder {
        private final QLSelect select = new QLSelect();
        public Builder distinct() { select.distinct = true; return this; }
        public Builder from(QLTable table) { select.from = table; return this; }
        public Builder where(QLWhere where) { select.where = where; return this; }
        public Builder groupBy(QLGroupBy groupBy) { select.groupBy = groupBy; return this; }
        public Builder orderBy(QLOrderBy orderBy) { select.orderBy = orderBy; return this; }
        public Builder limit(int value) { select.limit = new QLLimit(value); return this; }
        public Builder offset(int value) { select.offset = new QLOffset(value); return this; }
        public QLSelect build() { return select; }
    }
}
