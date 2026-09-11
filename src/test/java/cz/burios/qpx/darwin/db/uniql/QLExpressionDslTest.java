package cz.burios.qpx.darwin.db.uniql;

import static cz.burios.qpx.darwin.db.uniql.dsl.DSL.*;

/** Executable tests for SQL-like expressions and function calls. */
public final class QLExpressionDslTest {
    public static void main(String[] args) {
        arithmeticAndAliases();
        functions();
        predicates();
        complexWhere();
        caseExpression();
        System.out.println("QLExpressionDslTest: OK");
    }

    private static void arithmeticAndAliases() {
        QLSql.Result r = select(
                col("s.NAME"),
                col("s.QUANTITY").mul(col("s.PRICE")).as("TOTAL")
        ).from(table("store").as("s")).sql();
        assert "SELECT s.NAME, (s.QUANTITY * s.PRICE) AS TOTAL FROM store AS s".equals(r.sql()) : r.sql();
    }

    private static void functions() {
        QLSql.Result r = select(
                fn("COUNT", col("s.ID")).as("CNT"),
                fn("COALESCE", col("s.NAME"), val("unknown")).as("NAME")
        ).from(table("store").as("s")).sql();
        assert "SELECT COUNT(s.ID) AS CNT, COALESCE(s.NAME, ?) AS NAME FROM store AS s".equals(r.sql()) : r.sql();
        assert r.parameters().size() == 1 && "unknown".equals(r.parameters().get(0));
    }

    private static void predicates() {
        QLSql.Result r = select().column(col("ID"))
                .from("store")
                .where(col("PRICE").ge(10).and(col("PRICE").lt(100)))
                .sql();
        assert "SELECT ID FROM store WHERE ((PRICE >= ?) AND (PRICE < ?))".equals(r.sql()) : r.sql();
        assert r.parameters().size() == 2;
    }

    private static void complexWhere() {
        QLSql.Result r = select(col("ID")).from("store")
                .where(col("STATUS").eq("ACTIVE").or(col("STATUS").eq("NEW")))
                .sql();
        assert "SELECT ID FROM store WHERE ((STATUS = ?) OR (STATUS = ?))".equals(r.sql()) : r.sql();
        assert r.parameters().size() == 2;
    }

    private static void caseExpression() {
        QLSql.Result r = select(
                caseExpr()
                        .when(col("ACTIVE").eq(true), "yes")
                        .elseValue("no")
                        .as("LABEL")
        ).from("store").sql();
        assert "SELECT CASE WHEN (ACTIVE = ?) THEN ? ELSE ? END AS LABEL FROM store".equals(r.sql()) : r.sql();
        assert r.parameters().size() == 3;
    }
}
