package cz.burios.qpx.darwin.db.dao;

import cz.burios.qpx.darwin.db.uniql.QLSql;

/** Simple executable smoke test; kept dependency-free. */
public final class QLJsonTest {
    public static void main(String[] args) throws Exception {
        String json = """
            {"type":"select","distinct":true,
             "columns":[{"type":"column","name":"u.id"},{"type":"column","name":"u.name","alias":"userName"}],
             "from":{"type":"table","name":"users","alias":"u"},
             "where":{"type":"where","conditions":[
                {"type":"condition","left":{"type":"column","name":"u.active"},"operator":"=","right":{"type":"value","value":true}},
                {"type":"condition","left":{"type":"column","name":"u.age"},"operator":">=","right":{"type":"value","value":18}}
             ]},
             "orderBy":{"type":"orderBy","items":[{"expression":{"type":"column","name":"u.name"},"direction":"ASC"}]},
             "limit":{"type":"limit","value":50},"offset":{"type":"offset","value":10}}
            """;
        QLSql.Result result = QLJson.toSql(json);
        String expected = "SELECT DISTINCT u.id, u.name AS userName FROM users AS u WHERE (u.active = ?) AND (u.age >= ?) ORDER BY u.name ASC LIMIT 50 OFFSET 10";
        if (!expected.equals(result.sql()) || !java.util.List.of(true, 18).equals(result.parameters())) {
            throw new AssertionError(result);
        }
        System.out.println(result.sql());
        System.out.println(result.parameters());
    }
}
