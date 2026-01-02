package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import nl.hend.rm.dto.RootCategoryDto;
import nl.hend.rm.entities.Category;

import java.util.List;

@ApplicationScoped
public class CategoryService {

    public List<Category> getAll() {
        return Category.listAll();
    }

    public List<RootCategoryDto> getRootCategories() {
        return Category.getRootCategories().stream()
                .map(c -> new RootCategoryDto(c.name, c.assignable, c.color, c.level)).toList();
    }
}
