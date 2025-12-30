package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import nl.hend.rm.entities.Category;

import java.util.List;

@ApplicationScoped
public class CategoryService {

    public List<Category> getAll() {
        return Category.listAll();
    }
}
