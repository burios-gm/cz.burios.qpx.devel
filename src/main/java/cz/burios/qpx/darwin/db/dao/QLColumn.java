package cz.burios.qpx.darwin.db.dao;

import java.util.Objects;

public final class QLColumn extends QLExpr {
    private String name;
    private String alias;

    public QLColumn() {}
    public QLColumn(String name) { this.name = Objects.requireNonNull(name); }
    public QLColumn(String name, String alias) { this(name); this.alias = alias; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
