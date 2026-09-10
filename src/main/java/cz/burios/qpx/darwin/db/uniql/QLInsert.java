package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class QLInsert extends QLStatement {
    public QLExpr table;
    public List<String> columns = new ArrayList<>();
    public List<QLExpr> values = new ArrayList<>();
    public List<Map<String, QLExpr>> rows = new ArrayList<>();

    public QLInsert() {}
    public QLInsert(QLExpr table) { this.table = table; }
    public QLInsert columns(String... names) { if (names != null) for (String n : names) columns.add(n); return this; }
    public QLInsert values(Object... vals) { values.clear(); if (vals != null) for (Object v : vals) values.add(QLExpr.toExpr(v)); return this; }
    public QLInsert row(Map<String, ?> row) {
        Map<String, QLExpr> r = new LinkedHashMap<>();
        row.forEach((k,v) -> r.put(k, QLExpr.toExpr(v)));
        rows.add(r); return this;
    }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
