package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLOrderBy extends QLExpr {
    public List<Item> items = new ArrayList<>();

    public static class Item {
        public QLExpr expression;
        public String direction = "ASC";
        public Item() {}
        public Item(QLExpr expression, String direction) {
            this.expression = expression;
            this.direction = direction;
        }
    }

    public QLOrderBy add(QLExpr expression) { return add(expression, "ASC"); }
    public QLOrderBy add(QLExpr expression, String direction) {
        items.add(new Item(expression, direction));
        return this;
    }
    public QLOrderBy asc(QLExpr expression) { return add(expression, "ASC"); }
    public QLOrderBy desc(QLExpr expression) { return add(expression, "DESC"); }

    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
