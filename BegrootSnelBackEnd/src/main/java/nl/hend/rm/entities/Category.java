package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
public class Category extends PanacheEntity {

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public boolean assignable;

    public String color;

    @JsonBackReference
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    public Category parent;

    @Column(name = "level")
    public int level;

    @JsonManagedReference
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    public List<Category> children = new ArrayList<>();

    @JsonProperty("parentId")
    public Long getParentId() {
        return parent != null ? parent.id : null;
    }

    public Category retrieveNode() {
        if (this.parent == null) {
            return this;
        }
        return this.parent.retrieveNode();
    }

    public boolean isRoot() {
        return parent == null;
    }

    public boolean hasChildren() {
        return children != null && !children.isEmpty();
    }

    public int getLevel() {
        int level = 0;
        Category current = this.parent;
        while (current != null) {
            level++;
            current = current.parent;
        }
        return level;
    }

    public static List<Category> getRootCategories() {
        return list("level", 0);
    }

    public static List<Category> getAssignableCategories() {
        return list("assignable", true);
    }
}