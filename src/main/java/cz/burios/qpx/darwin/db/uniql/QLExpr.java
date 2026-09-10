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
    @JsonSubTypes.Type(value = QLValue.class, name = "value"),
    @JsonSubTypes.Type(value = QLGroupBy.class, name = "groupBy"),
    @JsonSubTypes.Type(value = QLOrderBy.class, name = "orderBy"),
    @JsonSubTypes.Type(value = QLLimit.class, name = "limit"),
    @JsonSubTypes.Type(value = QLOffset.class, name = "offset")
})
public abstract class QLExpr {
    public abstract void accept(QLVisitor visitor);
}
