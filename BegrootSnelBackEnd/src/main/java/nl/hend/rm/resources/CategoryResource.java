package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.service.CategoryService;

@Path("/categories")
public class CategoryResource {

    @Inject
    CategoryService cs;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        return Response.accepted(cs.getAll()).build();
    }
}
