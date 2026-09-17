package cz.burios.qpx.darwin.db.uniql;

public interface QLVisitor {
    void visit(QLSelect expr);
    void visit(QLColumn expr);
    void visit(QLTable expr);
    void visit(QLSchema expr);
    void visit(QLJoin expr);
    void visit(QLWhere expr);
    void visit(QLCondition expr);
    void visit(QLLogical expr);
    void visit(QLValue expr);
    void visit(QLFunction expr);
    void visit(QLExpression expr);
    void visit(QLBrackets expr);
    void visit(QLSubSelect expr);
    void visit(QLIn expr);
    void visit(QLBetween expr);
    void visit(QLIsNull expr);
    void visit(QLExists expr);
    void visit(QLCase expr);
    void visit(QLGroupBy expr);
    void visit(QLOrderBy expr);
    void visit(QLLimit expr);
    void visit(QLOffset expr);
    void visit(QLInsert expr);
    void visit(QLUpdate expr);
    void visit(QLDelete expr);
}
