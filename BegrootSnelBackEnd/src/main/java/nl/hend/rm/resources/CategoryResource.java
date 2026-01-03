package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
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
        return Response.ok(cs.getAll()).build();
    }

    @Path("/root-categories")
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getRootCategories() {
        return Response.ok(cs.getRootCategories()).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response postCategory() {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response putCategory() {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

    @DELETE
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteCategory() {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

}
