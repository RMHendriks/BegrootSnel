package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
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

    @JsonManagedReference
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    public List<Category> children = new ArrayList<>();

    @Column(name = "level")
    public Integer level = 0;

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

    public Integer getLevel() {
        int level = 0;
        Category current = this.parent;
        while (current != null) {
            level++;
            current = current.parent;
        }
        return level;
    }
}