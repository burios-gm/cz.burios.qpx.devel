package cz.burios.qpx.darwin.db.uniql;

import java.util.ArrayList;
import java.util.List;

public class QLGroupBy extends QLExpr {
    public List<QLColumn> columns = new ArrayList<>();
    public void accept(QLVisitor visitor) { visitor.visit(this); }
}
