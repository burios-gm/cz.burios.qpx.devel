package cz.burios.qpx.darwin.db.uniql;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = QLSelect.class, name = "select"),
    @JsonSubTypes.Type(value = QLColumn.class, name = "column"),
    @JsonSubTypes.Type(value = QLTable.class, name = "table"),
    @JsonSubTypes.Type(value = QLJoin.class, name = "join"),
    @JsonSubTypes.Type(value = QLWhere.class, name = "where"),
    @JsonSubTypes.Type(value = QLCondition.class, name = "condition"),
    @JsonSubTypes.Type(value = QLLogical.class, name = "logical"),
    @JsonSubTypes.Type(value = QLValue.class, name = "value"),
    @JsonSubTypes.Type(value = QLFunction.class, name = "function"),
    @JsonSubTypes.Type(value = QLExpression.class, name = "expression"),
    @JsonSubTypes.Type(value = QLBrackets.class, name = "brackets"),
    @JsonSubTypes.Type(value = QLSubSelect.class, name = "subSelect"),
    @JsonSubTypes.Type(value = QLIn.class, name = "in"),
    @JsonSubTypes.Type(value = QLBetween.class, name = "between"),
    @JsonSubTypes.Type(value = QLIsNull.class, name = "isNull"),
    @JsonSubTypes.Type(value = QLExists.class, name = "exists"),
    @JsonSubTypes.Type(value = QLCase.class, name = "case"),
    @JsonSubTypes.Type(value = QLGroupBy.class, name = "groupBy"),
    @JsonSubTypes.Type(value = QLOrderBy.class, name = "orderBy"),
    @JsonSubTypes.Type(value = QLLimit.class, name = "limit"),
    @JsonSubTypes.Type(value = QLOffset.class, name = "offset")
})
public abstract class QLExpr {
    public abstract void accept(QLVisitor visitor);

    public QLExpression add(Object x) { return binary("+", x); }
    public QLExpression sub(Object x) { return binary("-", x); }
    public QLExpression mul(Object x) { return binary("*", x); }
    public QLExpression div(Object x) { return binary("/", x); }
    public QLExpression mod(Object x) { return binary("%", x); }
    public QLBrackets brackets() { return new QLBrackets(this); }

    public QLCondition eq(Object x) { return condition("=", x); }
    public QLCondition ne(Object x) { return condition("<>", x); }
    public QLCondition gt(Object x) { return condition(">", x); }
    public QLCondition ge(Object x) { return condition(">=", x); }
    public QLCondition lt(Object x) { return condition("<", x); }
    public QLCondition le(Object x) { return condition("<=", x); }
    public QLCondition like(Object x) { return condition("LIKE", x); }
    public QLIn in(Object... values) { return new QLIn(this, values); }
    public QLBetween between(Object lower, Object upper) { return new QLBetween(this, lower, upper); }
    public QLIsNull isNull() { return new QLIsNull(this, false); }
    public QLIsNull isNotNull() { return new QLIsNull(this, true); }
    public QLCondition and(Object x) { return new QLLogical("AND", this, QLExprs.expr(x)); }
    public QLCondition or(Object x) { return new QLLogical("OR", this, QLExprs.expr(x)); }

    protected QLExpression binary(String op, Object x) { return new QLExpression(this, op, QLExprs.expr(x)); }
    protected QLCondition condition(String op, Object x) { return new QLCondition(this, op, QLExprs.expr(x)); }
}

final class QLExprs {
    private QLExprs() {}
    static QLExpr expr(Object value) {
        return value instanceof QLExpr ? (QLExpr) value : new QLValue(value);
    }
}
