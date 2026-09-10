package cz.burios.qpx.darwin.db.uniql;

import com.fasterxml.jackson.databind.ObjectMapper;

public final class QLJson {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private QLJson() {}
    public static QLSelect fromJson(String json) throws Exception { return MAPPER.readValue(json, QLSelect.class); }
    public static String toJson(QLSelect select) throws Exception { return MAPPER.writeValueAsString(select); }
    public static QLSql.Result toSql(String json) throws Exception { return QLSql.render(fromJson(json)); }
}
