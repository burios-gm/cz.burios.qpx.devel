package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLOrderBy extends QLExpr {
    public List<Item> items = new ArrayList<>();
    public static class Item {
        public QLExpr expression;
        public String direction = "ASC";
    }
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
