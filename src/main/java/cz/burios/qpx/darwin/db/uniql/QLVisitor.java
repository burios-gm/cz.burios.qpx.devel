package cz.burios.qpx.darwin.db.uniql;

public interface QLVisitor {
    void visit(QLSelect expr);
    void visit(QLColumn expr);
    void visit(QLTable expr);
    void visit(QLJoin expr);
    void visit(QLWhere expr);
    void visit(QLCondition expr);
    void visit(QLValue expr);
    void visit(QLGroupBy expr);
    void visit(QLOrderBy expr);
    void visit(QLLimit expr);
    void visit(QLOffset expr);
}
