package cz.burios.qpx.darwin.db.metadata;

import cz.burios.qpx.darwin.db.model.BasicRecord;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

/** Reads table and column metadata from JPA annotations without requiring a JPA runtime. */
public final class QLRecordMetadata {
    private QLRecordMetadata() {}

    public static String table(Class<? extends BasicRecord> type) {
        String name = annotationValue(type, "jakarta.persistence.Table", "name");
        if (name == null || name.isBlank()) name = annotationValue(type, "javax.persistence.Table", "name");
        return name == null || name.isBlank() ? type.getSimpleName() : name;
    }

    public static String idColumn(Class<? extends BasicRecord> type) {
        for (Field field : fields(type)) {
            if (hasAnnotation(field, "jakarta.persistence.Id") || hasAnnotation(field, "javax.persistence.Id")) return column(field);
        }
        throw new IllegalArgumentException("No @Id field found on " + type.getName());
    }

    public static String column(Field field) {
        String name = annotationValue(field, "jakarta.persistence.Column", "name");
        if (name == null || name.isBlank()) name = annotationValue(field, "javax.persistence.Column", "name");
        return name == null || name.isBlank() ? field.getName() : name;
    }

    public static List<Field> fields(Class<? extends BasicRecord> type) {
        List<Field> result = new ArrayList<>();
        for (Class<?> c = type; c != null && c != Object.class && c != BasicRecord.class; c = c.getSuperclass()) {
            for (Field field : c.getDeclaredFields()) {
                int modifiers = field.getModifiers();
                if (Modifier.isStatic(modifiers) || Modifier.isTransient(modifiers)) continue;
                if (hasAnnotation(field, "jakarta.persistence.Transient") || hasAnnotation(field, "javax.persistence.Transient")) continue;
                result.add(field);
            }
        }
        return result;
    }

    public static String columnForField(Class<? extends BasicRecord> type, String fieldName) {
        for (Field field : fields(type)) if (field.getName().equals(fieldName)) return column(field);
        return fieldName;
    }

    private static boolean hasAnnotation(Field field, String className) {
        for (var annotation : field.getAnnotations()) if (annotation.annotationType().getName().equals(className)) return true;
        return false;
    }

    private static String annotationValue(Class<?> type, String className, String member) {
        for (var annotation : type.getAnnotations()) {
            if (!annotation.annotationType().getName().equals(className)) continue;
            try { return String.valueOf(annotation.annotationType().getMethod(member).invoke(annotation)); }
            catch (ReflectiveOperationException ignored) { return null; }
        }
        return null;
    }

    private static String annotationValue(Field field, String className, String member) {
        for (var annotation : field.getAnnotations()) {
            if (!annotation.annotationType().getName().equals(className)) continue;
            try { return String.valueOf(annotation.annotationType().getMethod(member).invoke(annotation)); }
            catch (ReflectiveOperationException ignored) { return null; }
        }
        return null;
    }
}
