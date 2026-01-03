package nl.hend.rm.resources;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.dto.SplitCategoryDto;
import nl.hend.rm.service.TransactionService;

import java.util.List;

@Path("/splits")
public class TransactionSplitResource {

    @Inject
    TransactionService ts;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAllSplits() {
        return Response.status(Response.Status.NOT_IMPLEMENTED).build();
    }

    @Path("/{year}/{month}/{category_id}")
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSplitsByYearMonthAndCategoryId(@PathParam("year") int year, @PathParam("month") int month,
                                                      @PathParam("category_id") long id) {
        List<SplitCategoryDto> transactionSplitList = ts.getTransactionsByYearMonthAndCategoryId(year, month, id);
        return Response.ok(transactionSplitList).build();
    }
}
