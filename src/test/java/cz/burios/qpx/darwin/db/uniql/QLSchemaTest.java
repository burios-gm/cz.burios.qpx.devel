package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

/** Executable smoke tests; run with assertions enabled. */
public final class QLSchemaTest {
    public static void main(String[] args) {
        tableAndColumnNames();
        dslIntegration();
        jsonRoundTrip();
        System.out.println("QLSchemaTest: OK");
    }

    private static void tableAndColumnNames() {
        QLSchema table = schema("depo_cz", "store");
        QLSchema column = schema("depo_cz", "store", "NAME");
        assert "depo_cz.store".equals(table.sqlName());
        assert "depo_cz.store.NAME".equals(column.sqlName());
        assert "depo_sk.store".equals(schema("depo_sk.store").sqlName());
        assert "depo_sk.store.NAME".equals(schema("depo_sk.store.NAME").sqlName());
    }

    private static void dslIntegration() {
        QLSql.Result r = select(col(schema("depo_cz", "store", "NAME")))
                .from(schema("depo_cz", "store"))
                .where(col(schema("depo_cz", "store", "ID")).eq(7))
                .sql();
        assert "SELECT depo_cz.store.NAME FROM depo_cz.store WHERE (depo_cz.store.ID = ?)".equals(r.sql()) : r.sql();
        assert r.parameters().size() == 1 && Integer.valueOf(7).equals(r.parameters().get(0));
    }

    private static void jsonRoundTrip() {
        try {
            QLSelect select = select(col(schema("depo_sk", "store", "NAME")))
                    .from(schema("depo_sk", "store"))
                    .build();
            String json = QLJson.toJson(select);
            QLSelect restored = QLJson.fromJson(json);
            assert select.toSQL().equals(restored.toSQL());
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }
}
