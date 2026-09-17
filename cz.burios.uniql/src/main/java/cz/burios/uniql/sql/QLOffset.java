package cz.burios.uniql.sql;

public class QLOffset extends QLExpr {
    public int value;
    public QLOffset() {}
    public QLOffset(int value) { this.value = value; }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
