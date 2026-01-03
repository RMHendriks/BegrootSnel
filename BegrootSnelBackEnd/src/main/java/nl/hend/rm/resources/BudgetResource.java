package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.dto.BudgetDto;
import nl.hend.rm.service.BudgetService;

import java.util.List;

@Path("/budgets")
public class BudgetResource {

    @Inject
    BudgetService bs;

    @GET
    @Path("/{year}/{month}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getBudgetsByYearAndMonth(@PathParam("year") int year, @PathParam("month") int month) {
        List<BudgetDto> dto = bs.getBudgetByYearAndMonth(year, month);
        return Response.ok(dto).build();
    }

    @GET
    @Path("/{year}/{month}/{category_id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response getBudgetsByYearMonthAndCategoryId(@PathParam("year") int year, @PathParam("month") int month,
                                                     @PathParam("category_id") long categoryId) {
        BudgetDto dto = bs.getBudgetByYearMonthAndCategory(year, month, categoryId);
        return Response.ok(dto).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response postBudgetsByYearAndMonth(BudgetDto dto) {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

    @PUT
    @Path("/{year}/{month}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response putBudgetsByYearAndMonth(@PathParam("year") int year, @PathParam("month") int month, BudgetDto dto) {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

    @DELETE
    @Path("/{year}/{month}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteBudgetsByYearAndMonth(@PathParam("year") int year, @PathParam("month") int month, BudgetDto dto) {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }
}
