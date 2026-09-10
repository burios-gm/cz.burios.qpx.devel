package cz.burios.qpx.darwin.db.dao;

import java.util.ArrayList;
import java.util.List;

public final class QLOrderBy extends QLExpr {
    public enum Direction { ASC, DESC }
    public static final class Item {
        private QLExpr expression;
        private Direction direction = Direction.ASC;
        public Item() {}
        public Item(QLExpr expression, Direction direction) { this.expression = expression; this.direction = direction; }
        public QLExpr getExpression() { return expression; }
        public void setExpression(QLExpr expression) { this.expression = expression; }
        public Direction getDirection() { return direction; }
        public void setDirection(Direction direction) { this.direction = direction; }
    }
    private List<Item> items = new ArrayList<>();
    public QLOrderBy() {}
    public QLOrderBy add(QLExpr expression, Direction direction) { items.add(new Item(expression, direction)); return this; }
    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = items == null ? new ArrayList<>() : items; }
    @Override public void accept(QLVisitor visitor) { visitor.visit(this); }
}
