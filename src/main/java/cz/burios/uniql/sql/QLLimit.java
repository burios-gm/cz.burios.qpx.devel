package cz.burios.uniql.sql;

public class QLLimit extends QLExpr {
    public int value;
    public QLLimit() {}
    public QLLimit(int value) { this.value = value; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
