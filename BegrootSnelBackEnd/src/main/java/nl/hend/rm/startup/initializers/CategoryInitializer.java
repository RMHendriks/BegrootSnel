package nl.hend.rm.startup.initializers;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import nl.hend.rm.entities.Category;

import java.io.InputStream;
import java.util.List;
import java.util.Objects;

@ApplicationScoped
public class CategoryInitializer {

    @Inject
    ObjectMapper objectMapper;

    @Transactional
    void onStart(@Observes StartupEvent ev) {
        if (Category.count() == 0) {
            try {
                loadCategoriesFromJson();
            } catch (Exception e) {
                throw new RuntimeException(e.getMessage());
            }
        }
    }

    private void loadCategoriesFromJson() throws Exception {
        InputStream is = getClass().getResourceAsStream("/documents/categories/categories.json");
        if (is == null) {
            throw new IllegalStateException("categories.json not found in resources");
        }

        CategoryNode[] rootNodes = objectMapper.readValue(is, CategoryNode[].class);

        for (CategoryNode node : rootNodes) {
            createCategoryTree(node, null);
        }
    }

    private void createCategoryTree(CategoryNode node, Category parent) {
        Category category = new Category();
        category.name = node.name;
        category.parent = parent;
        category.assignable = Objects.requireNonNullElseGet(node.assignable, () -> (node.children == null || node.children.isEmpty()));
        category.color = category.isRoot() ? node.color : category.retrieveNode().color;
        category.level = category.getLevel();

        category.persist();

        if (node.children != null) {
            for (CategoryNode child : node.children) {
                createCategoryTree(child, category);
            }
        }
    }

    // Inner class for JSON deserialization
    public static class CategoryNode {
        public String name;
        public List<CategoryNode> children;
        public Boolean assignable;
        public String color;
    }
}