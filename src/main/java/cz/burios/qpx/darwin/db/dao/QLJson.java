package cz.burios.qpx.darwin.db.dao;

import com.fasterxml.jackson.databind.ObjectMapper;

/** JSON boundary for QL expression trees. */
public final class QLJson {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private QLJson() {}

    public static QLSelect readSelect(String json) throws Exception {
        QLSelect select = MAPPER.readValue(json, QLSelect.class);
        return select;
    }

    public static String write(QLExpr expression) throws Exception {
        return MAPPER.writeValueAsString(expression);
    }

    public static QLSql.Result toSql(String json) throws Exception {
        return QLSql.render(readSelect(json));
    }

    public static String toSqlString(String json) throws Exception {
        return toSql(json).sql();
    }
}
